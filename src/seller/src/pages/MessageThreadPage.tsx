import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChatComposer, ChatHistory, ChatWorkspace, clearChatPrivateState, readChatAttempt, readChatDraft, writeChatAttempt, writeChatDraft, type ChatEntry } from '@aisley/chat-ui'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { getConversation, listConversations, listMessages, markRead, sendMessage, type Conversation, type Message } from '../lib/messages'

function errorText(reason: unknown) {
  if (reason instanceof Error && reason.message.startsWith('Message delivery was not confirmed')) return reason.message
  if (!(reason instanceof ApiError)) return 'Your connection may be unavailable. Retry with the same message.'
  if (reason.status === 404) return 'This conversation is unavailable to your Shop.'
  if (reason.status === 429) return 'Too many messages. Wait a moment and retry.'
  return reason.message
}

function merge(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence)
}

export function MessageThreadPage() {
  const { conversationId = '' } = useParams()
  const { seller } = useAuth()
  const navigate = useNavigate()
  const accountId = seller?.id ?? 'unknown'
  const draftKey = `seller-shop:${accountId}:${conversationId}`
  const [thread, setThread] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [body, setBody] = useState(() => readChatDraft(draftKey))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sent, setSent] = useState(false)
  const [uncertain, setUncertain] = useState(() => Boolean(readChatAttempt(draftKey)))
  const [inbox, setInbox] = useState<Conversation[]>([])
  const [inboxCursor, setInboxCursor] = useState<string | null>(null)
  const [inboxError, setInboxError] = useState('')
  const [inboxBusy, setInboxBusy] = useState(false)
  const pending = useRef(readChatAttempt(draftKey))
  const activeId = useRef(conversationId)
  activeId.current = conversationId
  const activeDraftKey = useRef(draftKey)
  activeDraftKey.current = draftKey

  useEffect(() => {
    setBody(readChatDraft(draftKey))
    pending.current = readChatAttempt(draftKey)
    setUncertain(Boolean(pending.current))
    setBusy(false)
    setSendError('')
  }, [draftKey])

  const loadInbox = useCallback(async (next?: string) => {
    try {
      const result = await listConversations(next)
      setInbox((current) => next
        ? [...current, ...result.items.filter((item) => !current.some((saved) => saved.id === item.id))]
        : [...result.items, ...current.filter((item) => !result.items.some((fresh) => fresh.id === item.id))])
      setInboxCursor(result.next_cursor)
      setInboxError('')
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
        clearChatPrivateState(); setInbox([]); setThread(null); setMessages([]); setBody(''); pending.current = null; setUncertain(false);
      }
      setInboxError(errorText(reason));
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!conversationId) return
    try {
      const [detail, page] = await Promise.all([getConversation(conversationId), listMessages(conversationId)])
      if (activeId.current !== conversationId) return
      setThread(detail.data)
      setMessages((current) => merge(current, page.items))
      setCursor((current) => current ?? page.next_cursor)
      setError('')
      const latest = page.items.at(-1)?.sequence
      if (!document.hidden && latest && latest > detail.data.last_read_sequence) {
        const read = await markRead(conversationId, latest)
        if (activeId.current === conversationId) setThread(read.data)
      }
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearChatPrivateState(); setThread(null); setMessages([]); setBody(''); pending.current = null; setUncertain(false);
      }
      if (activeId.current === conversationId) setError(errorText(reason))
    } finally {
      if (activeId.current === conversationId) setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    document.title = 'Conversation | Aisley Seller'
    setThread(null)
    setMessages([])
    setCursor(null)
    setLoading(true)
    void refresh()
    void loadInbox()
    const onFocus = () => { if (navigator.onLine) { void refresh(); void loadInbox() } }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) { void refresh(); void loadInbox() }
    }, 12000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [loadInbox, refresh])

  async function loadOlder() {
    if (!cursor) return
    setOlderBusy(true)
    try {
      const page = await listMessages(conversationId, cursor)
      if (activeId.current !== conversationId) return
      setMessages((current) => merge(current, page.items))
      setCursor(page.next_cursor)
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearChatPrivateState(); setThread(null); setMessages([]); setBody(''); pending.current = null; setUncertain(false);
      }
      setError(errorText(reason));
    }
    finally { setOlderBusy(false) }
  }

  async function submit() {
    const text = body.trim()
    if (!text || (!thread?.send_allowed && !uncertain) || busy) return
    const savedAttempt = readChatAttempt(draftKey)
    const attempt = savedAttempt?.body === text ? savedAttempt : { key: crypto.randomUUID(), body: text }
    pending.current = attempt
    writeChatAttempt(draftKey, attempt)
    setBusy(true)
    setSendError('')
    setSent(false)
    try {
      const result = await sendMessage(conversationId, text, attempt.key)
      writeChatDraft(draftKey, '')
      writeChatAttempt(draftKey, null)
      if (activeDraftKey.current !== draftKey) { void loadInbox(); return }
      setThread(result.conversation)
      setMessages((current) => merge(current, [result.message]))
      setBody('')
      pending.current = null
      setUncertain(false)
      setSent(true)
      void refresh()
    } catch (reason) {
      if (activeDraftKey.current !== draftKey) return
      setSendError(errorText(reason))
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearChatPrivateState()
        pending.current = null
        setBody('')
        setUncertain(false)
      } else if (reason instanceof ApiError && [409, 422, 429].includes(reason.status)) {
        pending.current = null
        writeChatAttempt(draftKey, null)
        setUncertain(false)
      } else setUncertain(true)
      void refresh()
    } finally { setBusy(false) }
  }

  const entries: ChatEntry[] = inbox.map((item) => ({
    id: item.id,
    title: item.customer_name ?? 'Customer',
    preview: item.last_message_preview ?? '',
    activity: item.last_message_at,
    unread: item.unread_count,
    context: item.shop.name,
    onSelect: () => navigate(`/messages/${item.id}`),
    selected: item.id === conversationId,
  }))
  if (thread && !entries.some((entry) => entry.id === thread.id)) entries.unshift({
    id: thread.id, title: thread.customer_name ?? 'Customer', preview: thread.last_message_preview ?? '',
    activity: thread.last_message_at, unread: thread.unread_count, context: thread.shop.name,
    onSelect: () => navigate(`/messages/${thread.id}`), selected: true,
  })

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <ChatWorkspace
        entries={entries}
        selected
        inboxTitle="Customer conversations"
        inboxStatus={!inbox.length && loading ? <p className="p-4 text-sm text-zinc-500" role="status">Loading conversations…</p> : null}
        inboxError={inboxError || undefined}
        onRetryInbox={() => void loadInbox()}
        canLoadMore={Boolean(inboxCursor)}
        loadingMore={inboxBusy}
        onLoadMore={() => {
          if (!inboxCursor) return
          setInboxBusy(true)
          void loadInbox(inboxCursor).finally(() => setInboxBusy(false))
        }}
        onBack={() => navigate('/messages')}
      >
        {loading && !thread ? <p className="p-5 text-sm text-zinc-500" role="status">Loading conversation…</p> : !thread ? (
          <p className="m-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error || 'Conversation unavailable.'} <button className="ml-2 underline" onClick={() => void refresh()} type="button">Retry</button></p>
        ) : <>
          <header className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-white/10 sm:px-6">
            <h1 className="text-lg font-semibold">{thread.customer_name ?? 'Customer'}</h1>
            <p className="mt-1 text-xs text-zinc-500">{thread.shop.name} · Private Shop conversation</p>
          </header>
          {error ? <p className="m-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error} <button className="ml-2 underline" onClick={() => void refresh()} type="button">Retry</button></p> : null}
          <ChatHistory
            key={conversationId}
            messages={messages.map((message) => ({
              id: message.id, sequence: message.sequence, body: message.body, mine: message.mine,
              sender: message.mine ? 'You' : thread.customer_name ?? 'Customer', createdAt: message.created_at,
              context: message.context ? message.context.url ? <Link className="font-semibold text-[#4C1268] underline dark:text-purple-300" to={message.context.url}>{message.context.label}</Link> : <span>{message.context.label}</span> : undefined,
            }))}
            olderCursor={Boolean(cursor)}
            onLoadOlder={() => void loadOlder()}
            loadingOlder={olderBusy}
            emptyText="No messages yet. Customer messages will appear here."
          />
          {thread.send_allowed || uncertain ? <ChatComposer
            id="seller-chat-message"
            recipient="Customer"
            value={body}
            onChange={(value) => { setBody(value); writeChatDraft(draftKey, value); setSendError('') }}
            onSubmit={() => void submit()}
            sendAllowed={thread.send_allowed}
            online={typeof navigator === 'undefined' || navigator.onLine}
            sending={busy}
            uncertain={uncertain}
            error={sendError}
            success={sent ? 'Message sent.' : undefined}
          /> : <p className="border-t border-zinc-200 p-4 text-sm text-amber-700 dark:border-white/10 dark:text-amber-300">This Shop cannot receive new replies right now. History remains available.</p>}
        </>}
      </ChatWorkspace>
    </div>
  )
}
