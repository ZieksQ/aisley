import { chatMedia } from '../lib/chat-media';
import { useCallback, useEffect, useRef, useState } from 'react'
import { clearChatAttachments, ChatComposer, ChatHistory, type ChatMediaContext, clearChatPrivateState, readChatAttempt, readChatDraft, writeChatAttempt, writeChatDraft } from '@aisley/chat-ui'
import { ApiError } from '../lib/api'
import { operationalChat, type OperationalMessage, type OperationalThread } from '../lib/operationalChat'

type TaskContext = { leg: 'first_mile' | 'final_mile'; taskId: string } | { orderId: string } | { pickupRequestId: string }

function errorText(caught: unknown): string {
  if (!navigator.onLine) return 'You are offline. Reconnect before sending or refreshing messages.'
  if (caught instanceof ApiError) {
    if (caught.status === 409) return 'This relationship or message changed. Refresh the conversation before trying again.'
    if (caught.status === 429) return 'Too many messages. Wait a moment before trying again.'
    return caught.message
  }
  return 'Messages could not be loaded. Try again.'
}

function mergeMessages(current: OperationalMessage[], incoming: OperationalMessage[]): OperationalMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence)
}

export function OperationalThreadPanel({ selected, context, onSaved }: { selected: OperationalThread | null; context: TaskContext | null; onSaved: (thread: OperationalThread) => void }) {
  const contextId = context ? 'orderId' in context ? context.orderId : 'pickupRequestId' in context ? context.pickupRequestId : context.taskId : 'inbox'
  const draftKey = `logistics-operational:${selected?.id ?? contextId}`
  const [thread, setThread] = useState<OperationalThread | null>(selected)
  const [messages, setMessages] = useState<OperationalMessage[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [draft, setDraft] = useState(() => readChatDraft(draftKey))
  const [uncertain, setUncertain] = useState(() => Boolean(readChatAttempt(draftKey)))
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pendingRef = useRef(readChatAttempt(draftKey))
  const activeIdRef = useRef(selected?.id ?? null)
  activeIdRef.current = selected?.id ?? null
  const recipient = thread?.counterparty_role === 'customer' || Boolean(context && 'orderId' in context)
    ? 'Customer'
    : thread?.counterparty_role === 'seller' || Boolean(context && 'pickupRequestId' in context) ? 'Seller' : 'Courier'

  const refresh = useCallback(async (id: string, replace = false) => {
    const [detail, history] = await Promise.all([operationalChat.show(id), operationalChat.history(id)])
    if (activeIdRef.current !== id) return
    setThread(detail.data)
    setMessages((current) => replace ? history.data : mergeMessages(current, history.data))
    if (replace) setOlderCursor(history.meta.next_cursor)
    if (history.data.length) {
      const last = history.data[history.data.length - 1].sequence
      if (!document.hidden && last > detail.data.last_read_sequence) {
        const read = await operationalChat.read(id, last)
        if (activeIdRef.current === id) setThread(read.data)
      }
    }
  }, [])

  useEffect(() => {
    setThread(selected)
    setMessages([])
    setOlderCursor(null)
    setDraft(readChatDraft(draftKey))
    const attempt = readChatAttempt(draftKey)
    pendingRef.current = attempt
    setUncertain(Boolean(attempt))
    setError('')
    setNotice('')
    if (!selected) return
    let cancelled = false
    setLoading(true)
    void refresh(selected.id, true)
      .catch((caught) => {
        if (!cancelled) {
          if (caught instanceof ApiError && [401, 403, 404].includes(caught.status)) {
            clearChatPrivateState(); setThread(null); setMessages([]); setDraft(''); pendingRef.current = null; setUncertain(false);
          }
          setError(errorText(caught));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [draftKey, selected?.id, refresh])

  useEffect(() => {
    if (!selected || !navigator.onLine) return
    const poll = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh(selected.id).catch(() => undefined)
    }
    const timer = window.setInterval(poll, 15000)
    window.addEventListener('focus', poll)
    window.addEventListener('online', poll)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', poll)
      window.removeEventListener('online', poll)
    }
  }, [selected?.id, refresh])

  async function loadOlder() {
    if (!thread || !olderCursor) return
    setLoading(true)
    try {
      const page = await operationalChat.history(thread.id, olderCursor)
      setMessages((current) => mergeMessages(page.data, current))
      setOlderCursor(page.meta.next_cursor)
    } catch (caught) {
      if (caught instanceof ApiError && [401, 403, 404].includes(caught.status)) {
        clearChatPrivateState(); setThread(null); setMessages([]); setDraft(''); pendingRef.current = null; setUncertain(false);
      }
      setError(errorText(caught))
    } finally {
      setLoading(false)
    }
  }

  async function send(attachmentIds: string[] = []) {
    if (!navigator.onLine || sending) {
      setError('Reconnect before sending a message.')
      return
    }
    const body = pendingRef.current?.body ?? draft.trim()
    if ((!body && !attachmentIds.length) || body.length > 2000) return
    const attempt = pendingRef.current ?? { key: crypto.randomUUID(), body, attachmentIds }
    pendingRef.current = attempt
    writeChatAttempt(draftKey, attempt)
    setUncertain(true)
    setSending(true)
    setError('')
    setNotice('')
    try {
      const result = thread
        ? await operationalChat.send(thread.id, attempt.body, attempt.key, attempt.attachmentIds ?? [])
        : context ? 'orderId' in context
          ? await operationalChat.startOrder(context.orderId, attempt.body, attempt.key, attempt.attachmentIds ?? [])
          : 'pickupRequestId' in context
            ? await operationalChat.startPickup(context.pickupRequestId, attempt.body, attempt.key, attempt.attachmentIds ?? [])
          : await operationalChat.start(context.leg, context.taskId, attempt.body, attempt.key, attempt.attachmentIds ?? []) : null
      if (!result) return
      pendingRef.current = null
      setDraft('')
      clearChatAttachments(draftKey); writeChatDraft(draftKey, '');
      writeChatAttempt(draftKey, null)
      setUncertain(false)
      setThread(result.conversation)
      setMessages((current) => mergeMessages(current, [result.message]))
      setNotice('Message saved.')
      onSaved(result.conversation)
    } catch (caught) {
      setError(errorText(caught))
      if (caught instanceof ApiError && [401, 403, 404].includes(caught.status)) {
        clearChatPrivateState()
        pendingRef.current = null
        setDraft('')
        clearChatAttachments(draftKey); writeChatDraft(draftKey, '');
        writeChatAttempt(draftKey, null)
        setUncertain(false)
      } else if (caught instanceof ApiError && [409, 422, 429].includes(caught.status)) {
        pendingRef.current = null
        setUncertain(false)
        writeChatAttempt(draftKey, null)
        if (caught.status === 409 && thread) void refresh(thread.id).catch(() => undefined)
      }
    } finally {
      setSending(false)
    }
  }

  if (!thread && !context) {
    return <div className="grid min-h-0 flex-1 place-items-center p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Choose a conversation or open a pickup request, task, or Order to start messaging.</div>
  }

  const mediaContext: ChatMediaContext = thread ? { conversation_id: thread.id }
    : context && 'orderId' in context ? { channel: 'operational', context_type: 'order', context_id: context.orderId }
    : context && 'pickupRequestId' in context ? { channel: 'operational', context_type: 'pickup_request', context_id: context.pickupRequestId }
    : context && 'taskId' in context ? { channel: 'operational', leg: context.leg, task_id: context.taskId }
    : { channel: 'operational' }

  return (
    <section aria-label="Operational conversation" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <h2 className="font-semibold">{thread?.counterparty_label ?? (context && 'pickupRequestId' in context ? 'Message Seller' : context && 'orderId' in context ? 'Message Customer' : 'Message task Courier')}</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {thread ? thread.kind === 'seller_logistics' ? `Pickup ${thread.pickup_request_reference ?? thread.pickup_request_id.slice(0, 8)}` : thread.kind === 'customer_logistics' ? `Order ${thread.order_reference ?? thread.order_id.slice(0, 8)}` : `${thread.task_reference ?? thread.task_id.slice(0, 8)} · ${thread.leg.replaceAll('_', ' ')}` : context && 'pickupRequestId' in context ? `Pickup ${context.pickupRequestId.slice(0, 8)}` : context && 'orderId' in context ? `Order ${context.orderId.slice(0, 8)}` : context ? `Task ${context.taskId.slice(0, 8)} · ${context.leg.replaceAll('_', ' ')}` : ''}
        </p>
        {thread?.read_only_reason ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">This relationship ended. History is read-only.</p> : null}
      </header>
      <ChatHistory
          mediaClient={chatMedia}
        key={selected?.id ?? contextId}
        messages={messages.map((message) => ({
          id: message.id, sequence: message.sequence, body: message.body, mine: message.mine,
          sender: message.mine ? 'You' : thread?.counterparty_role === 'customer' ? 'Customer' : thread?.counterparty_role === 'seller' ? 'Seller' : 'Courier',
          attachments: message.attachments, createdAt: message.created_at,
        }))}
        olderCursor={Boolean(olderCursor)}
        onLoadOlder={() => void loadOlder()}
        loadingOlder={loading}
        loading={loading}
        emptyText="The first message creates this private operational conversation."
      />
      <ChatComposer
        media={{ client: chatMedia, draftKey, context: mediaContext }}
        id="operational-chat-message"
        recipient={recipient}
        placeholder="Write an order-related message"
        value={draft}
        onChange={(value) => { setDraft(value); writeChatDraft(draftKey, value) }}
        onSubmit={(ids) => void send(ids)}
        online={typeof navigator === 'undefined' || navigator.onLine}
        sending={sending}
        uncertain={uncertain && !sending}
        sendAllowed={thread?.send_allowed ?? true}
        readOnlyReason={thread?.read_only_reason ? 'This relationship ended. The conversation is read only.' : null}
        error={error || undefined}
        success={notice || undefined}
      />
    </section>
  )
}
