import { ApiError } from '../lib/api'
import { announceChatChange } from "@aisley/ui/chat";
import { chatMedia } from '../lib/chat-media'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clearChatAttachments, ChatComposer, ChatHistory, clearChatPrivateState, readChatAttempt, readChatDraft, writeChatAttempt, writeChatDraft } from '@aisley/ui/chat'
import { logisticsMessages, logisticsMessageError as failure, type LogisticsMessage, type LogisticsThread } from '../lib/logisticsMessages'

function merge(current: LogisticsMessage[], incoming: LogisticsMessage[]): LogisticsMessage[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => byId.set(item.id, item))
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence)
}

export function LogisticsMessageThread({ accountId, contextId, selected, onSaved }: {
  accountId: string
  contextId: string | null
  selected: LogisticsThread | null
  onSaved: (thread: LogisticsThread) => void
}) {
  const selectedId = selected?.id ?? null
  const draftKey = `seller-logistics:${accountId}:${selectedId ?? contextId ?? 'inbox'}`
  const [thread, setThread] = useState<LogisticsThread | null>(selected)
  const [messages, setMessages] = useState<LogisticsMessage[]>([])
  const [older, setOlder] = useState<string | null>(null)
  const [draft, setDraft] = useState(() => readChatDraft(draftKey))
  const [pending, setPending] = useState(() => readChatAttempt(draftKey))
  const [uncertain, setUncertain] = useState(() => Boolean(readChatAttempt(draftKey)))
  const [busy, setBusy] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const activeId = useRef(selectedId)
  activeId.current = selectedId

  const refresh = useCallback(async (id: string) => {
    const [detail, history] = await Promise.all([logisticsMessages.show(id), logisticsMessages.history(id)])
    if (activeId.current !== id) return
    setThread(detail.data)
    setMessages((current) => merge(current, history.data))
    setOlder(history.meta.next_cursor)
    const last = history.data.at(-1)?.sequence ?? 0
      if (!document.hidden && last > detail.data.last_read_sequence) {
      const read = await logisticsMessages.read(id, last)
      if (activeId.current === id) setThread(read.data)
    }
  }, [])

  useEffect(() => {
    setThread(null)
    setMessages([])
    setOlder(null)
    setDraft(readChatDraft(draftKey))
    const attempt = readChatAttempt(draftKey)
    setPending(attempt)
    setUncertain(Boolean(attempt))
    setError('')

    if (selectedId) {
      setLoading(true)
      void refresh(selectedId).catch((reason) => {
        if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
          clearChatPrivateState(); setThread(null); setMessages([]); setDraft(''); setPending(null); setUncertain(false);
        }
        setError(failure(reason))
      }).finally(() => setLoading(false))
    }
  }, [draftKey, selectedId, refresh])
  useEffect(() => {
    if (!selectedId) return
    const poll = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh(selectedId).catch(() => undefined)
    }
    const timer = window.setInterval(poll, 15000)
    window.addEventListener('focus', poll)
    window.addEventListener('online', poll)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', poll)
      window.removeEventListener('online', poll)
    }
  }, [selectedId, refresh])

  async function send(attachmentIds: string[] = []) {
    if (!navigator.onLine) {
      setError('Reconnect before sending a message.')
      return
    }
    if (busy) return
    const attempt = pending ?? { body: draft.trim(), key: crypto.randomUUID(), attachmentIds }
    if ((!attempt.body && !attachmentIds.length) || attempt.body.length > 2000) return
    setPending(attempt)
    setUncertain(true)
    writeChatAttempt(draftKey, attempt)
    setBusy(true)
    setError('')

    try {
      const result = thread ? await logisticsMessages.send(thread.id, attempt.body, attempt.key, attempt.attachmentIds ?? [])
        : contextId ? await logisticsMessages.start(contextId, attempt.body, attempt.key, attempt.attachmentIds ?? []) : null
      if (!result) return
      announceChatChange();
      setPending(null)
      setDraft('')
      clearChatAttachments(draftKey); writeChatDraft(draftKey, '');
      writeChatAttempt(draftKey, null)
      setUncertain(false)
      setThread(result.conversation)
      setMessages((current) => merge(current, [result.message]))

      onSaved(result.conversation)
    } catch (reason) {
      setError(failure(reason))
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearChatPrivateState(); setPending(null); setDraft(''); setUncertain(false)
      } else if (reason instanceof ApiError && [409, 422, 429].includes(reason.status)) {
        setPending(null); writeChatAttempt(draftKey, null); setUncertain(false)
        if (reason.status === 409 && thread) void refresh(thread.id).catch(() => undefined)
      }
    } finally {
      setBusy(false)
    }
  }

  async function loadOlder() {
    if (!thread || !older) return
    setOlderBusy(true)
    try {
      const page = await logisticsMessages.history(thread.id, older)
      setMessages((current) => merge(page.data, current))
      setOlder(page.meta.next_cursor)
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearChatPrivateState(); setThread(null); setMessages([]); setDraft(''); setPending(null); setUncertain(false);
      }
      setError(failure(reason))
    } finally { setOlderBusy(false) }
  }

  if (!thread && !contextId) {
    return <div className="grid min-h-0 flex-1 place-items-center p-8 text-center text-sm text-zinc-500">{selectedId ? 'Loading conversation…' : 'Choose a conversation or open a pickup request to message Logistics.'}</div>
  }

  return (
    <section aria-label="Logistics conversation" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Logistics</p>
        <h2 className="font-semibold">{thread?.counterparty_label ?? 'Contact Logistics'}</h2>
        <p className="mt-1 text-xs text-zinc-500">Pickup {thread?.pickup_request_reference ?? contextId?.slice(0, 8)}</p>
        {thread?.read_only_reason && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">This pickup relationship ended. History is read-only.</p>}
      </header>
      <ChatHistory
          mediaClient={chatMedia}
        key={selectedId ?? contextId ?? 'pickup-inbox'}
        messages={messages.map((message) => ({ id: message.id, sequence: message.sequence, body: message.body, mine: message.mine, sender: message.mine ? 'You' : 'Logistics', attachments: message.attachments, createdAt: message.created_at }))}
        olderCursor={Boolean(older)}
        onLoadOlder={() => void loadOlder()}
        loadingOlder={olderBusy}
        loading={loading}
        emptyText="No messages yet. Your first message creates this private conversation."
      />
      <ChatComposer
        media={{ client: chatMedia, draftKey, context: { ...(thread ? { conversation_id: thread.id } : { channel: "logistics", context_type: "pickup_request", context_id: contextId ?? undefined }) } }}
        id="logistics-message"
        recipient="Logistics"
        value={draft}
        onChange={(value) => { setDraft(value); writeChatDraft(draftKey, value); if (!uncertain) { setPending(null); writeChatAttempt(draftKey, null) } }}
        onSubmit={(ids) => void send(ids)}
        online={typeof navigator === 'undefined' || navigator.onLine}
        sending={busy}
        uncertain={uncertain && !busy}
        sendAllowed={thread?.send_allowed ?? true}
        readOnlyReason={thread?.read_only_reason ? 'This pickup relationship ended. History is read only.' : null}
        error={error || undefined}
        placeholder="Coordinate this pickup"
      />
    </section>
  )
}
