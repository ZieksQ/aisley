import { chatMedia } from '../lib/chat-media';
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clearChatAttachments, ChatComposer, ChatHistory, ChatWorkspace, clearChatPrivateState, readChatAttempt, readChatDraft, writeChatAttempt, writeChatDraft, type ChatEntry } from '@aisley/chat-ui'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { logisticsMessages, type LogisticsMessage, type LogisticsThread } from '../lib/logisticsMessages'

function failure(reason: unknown): string {
  if (!navigator.onLine) return 'You are offline. Reconnect to use messages.'
  if (reason instanceof ApiError) {
    if (reason.status === 409) return 'This pickup relationship changed. Refresh before trying again.'
    if (reason.status === 429) return 'Too many messages. Wait a moment and retry.'
    return reason.message
  }
  return reason instanceof Error ? reason.message : 'Messages could not be loaded.'
}

function merge(current: LogisticsMessage[], incoming: LogisticsMessage[]): LogisticsMessage[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => byId.set(item.id, item))
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence)
}

export function LogisticsMessagesPage() {
  const { seller } = useAuth()
  const accountId = seller?.id ?? 'unknown'
  const [params, setParams] = useSearchParams()
  const pickupId = params.get('pickup_request_id')
  const [threads, setThreads] = useState<LogisticsThread[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unread, setUnread] = useState(0)
  const selected = threads.find((item) => item.id === selectedId) ?? null

  const load = useCallback(async (append = false, next?: string) => {
    if (!navigator.onLine) {
      setError('You are offline. Reconnect to load messages.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const page = await logisticsMessages.list(next)
      setThreads((current) => append
        ? [...current, ...page.data.filter((item) => !current.some((saved) => saved.id === item.id))]
        : [...page.data, ...current.filter((item) => !page.data.some((fresh) => fresh.id === item.id))])
      setCursor(page.meta.next_cursor)
      setUnread(page.meta.unread_count ?? 0)
      setError('')
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
        clearChatPrivateState(); setThreads([]); setSelectedId(null);
      }
      setError(failure(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Logistics messages | Aisley Seller'
    void load()
  }, [load])
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load()
    }
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [load])
  useEffect(() => {
    if (pickupId) setSelectedId(threads.find((item) => item.pickup_request_id === pickupId)?.id ?? null)
  }, [pickupId, threads])

  function saved(thread: LogisticsThread) {
    setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)])
    setSelectedId(thread.id)
    setParams({})
  }

  function backToInbox() {
    setSelectedId(null)
    setParams({})
  }

  const entries: ChatEntry[] = threads.map((thread) => ({
    id: thread.id,
    title: thread.counterparty_label,
    preview: thread.last_message_preview ?? '',
    activity: thread.last_message_at,
    unread: thread.unread_count,
    context: `Pickup ${thread.pickup_request_reference ?? thread.pickup_request_id.slice(0, 8)}`,
    selected: selectedId === thread.id,
    readOnly: Boolean(thread.read_only_reason),
    onSelect: () => { setSelectedId(thread.id); setParams({}) },
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Logistics messages</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Private conversations for your pickup requests.{unread ? ` ${unread} unread.` : ''}
          </p>
        </div>
        <button className="border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-white/20 dark:hover:bg-white/5" onClick={() => void load()} type="button">
          Refresh inbox
        </button>
      </div>
      <ChatWorkspace
        entries={entries}
        selected={Boolean(selected || pickupId)}
        inboxTitle={`Pickup conversations · ${unread} unread`}
        inboxStatus={loading && !threads.length ? <p className="p-4 text-sm text-zinc-500" role="status">Loading conversations…</p> : null}
        inboxError={error || undefined}
        onRetryInbox={() => void load()}
        canLoadMore={Boolean(cursor)}
        loadingMore={loading}
        onLoadMore={() => { if (cursor) void load(true, cursor) }}
        onBack={backToInbox}
      >
        {selected || pickupId ? <LogisticsMessageThread accountId={accountId} contextId={selected ? null : pickupId} onSaved={saved} selected={selected} /> : (
          <div className="grid min-h-full place-items-center p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Select a pickup conversation or open one of your pickup requests to contact Logistics.</div>
        )}
      </ChatWorkspace>
    </div>
  )
}

function LogisticsMessageThread({ accountId, contextId, selected, onSaved }: {
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
  const [notice, setNotice] = useState('')
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
    setNotice('')
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
    setNotice('')
    try {
      const result = thread ? await logisticsMessages.send(thread.id, attempt.body, attempt.key, attempt.attachmentIds ?? [])
        : contextId ? await logisticsMessages.start(contextId, attempt.body, attempt.key, attempt.attachmentIds ?? []) : null
      if (!result) return
      setPending(null)
      setDraft('')
      clearChatAttachments(draftKey); writeChatDraft(draftKey, '');
      writeChatAttempt(draftKey, null)
      setUncertain(false)
      setThread(result.conversation)
      setMessages((current) => merge(current, [result.message]))
      setNotice('Message saved.')
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
        success={notice || undefined}
        placeholder="Coordinate this pickup"
      />
    </section>
  )
}
