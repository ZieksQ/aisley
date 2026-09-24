import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { getConversation, listMessages, markRead, sendMessage, type Conversation, type Message } from '../lib/messages'

function errorText(reason: unknown) {
  if (reason instanceof Error && reason.message.startsWith('Message delivery was not confirmed')) return reason.message
  if (!(reason instanceof ApiError)) return 'Your connection may be unavailable. Retry with the same message.'
  if (reason.status === 404) return 'This conversation is unavailable to your Shop.'
  if (reason.status === 429) return 'Too many messages. Wait a moment and retry.'
  return reason.message
}

export function MessageThreadPage() {
  const { conversationId = '' } = useParams()
  const [thread, setThread] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  const [error, setError] = useState('')
  const [sendError, setSendError] = useState('')
  const pendingKey = useRef<{ key: string; body: string } | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [detail, page] = await Promise.all([getConversation(conversationId), listMessages(conversationId)])
      setThread(detail.data)
      setMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]))
        page.items.forEach((message) => byId.set(message.id, message))
        return [...byId.values()].sort((left, right) => left.sequence - right.sequence)
      })
      setCursor((current) => current ?? page.next_cursor)
      setError('')
      const latest = page.items.at(-1)?.sequence
      if (latest && latest > detail.data.last_read_sequence) setThread((await markRead(conversationId, latest)).data)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    document.title = 'Conversation | Aisley Seller'
    void refresh()
    const onFocus = () => { if (navigator.onLine) void refresh() }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh()
    }, 12000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [refresh])

  async function loadOlder() {
    if (!cursor) return
    setOlderBusy(true)
    try {
      const page = await listMessages(conversationId, cursor)
      setMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]))
        page.items.forEach((message) => byId.set(message.id, message))
        return [...byId.values()].sort((left, right) => left.sequence - right.sequence)
      })
      setCursor(page.next_cursor)
    } catch (reason) { setError(errorText(reason)) }
    finally { setOlderBusy(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = body.trim()
    if (!text || !thread?.send_allowed) return
    const attempt = pendingKey.current?.body === text ? pendingKey.current : { key: crypto.randomUUID(), body: text }
    pendingKey.current = attempt
    setBusy(true)
    setSendError('')
    try {
      const result = await sendMessage(conversationId, text, attempt.key)
      setThread(result.conversation)
      setMessages((current) => current.some((message) => message.id === result.message.id) ? current : [...current, result.message])
      setBody('')
      pendingKey.current = null
      await refresh()
    } catch (reason) {
      setSendError(errorText(reason))
      void refresh()
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-8">
      <Link className="text-sm font-medium text-[#4C1268] dark:text-purple-300" to="/messages">← Messages</Link>
      {loading ? <p className="mt-5 text-sm text-zinc-500" role="status">Loading conversation…</p> : !thread ? (
        <p className="mt-5 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error || 'Conversation unavailable.'} <button className="underline" onClick={() => void refresh()} type="button">Retry</button></p>
      ) : (
        <div className="mt-4 border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">
          <header className="border-b border-zinc-200 p-4 dark:border-white/10"><h2 className="text-xl font-semibold">{thread.customer_name ?? 'Customer'}</h2><p className="mt-1 text-xs text-zinc-500">{thread.shop.name} · Messages are saved before they appear here.</p></header>
          {error && <p className="m-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error} <button className="underline" onClick={() => void refresh()} type="button">Retry</button></p>}
          {cursor && <button className="mx-4 mt-4 text-sm font-medium text-[#4C1268] underline disabled:opacity-50 dark:text-purple-300" disabled={olderBusy} onClick={() => void loadOlder()} type="button">{olderBusy ? 'Loading…' : 'Load earlier messages'}</button>}
          <ol aria-label="Conversation messages" className="space-y-3 p-4">
            {messages.map((message) => (
              <li className={`max-w-[85%] border p-3 text-sm ${message.mine ? 'ml-auto border-purple-200 bg-purple-50 dark:border-purple-500/25 dark:bg-purple-400/10' : 'border-zinc-200 dark:border-white/10'}`} key={message.id}>
                <p className="mb-1 text-xs font-semibold text-zinc-500">{message.mine ? 'You' : thread.customer_name ?? 'Customer'}</p>
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                {message.context && <p className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-500 dark:border-white/10">{message.context.url ? <Link className="font-medium text-[#4C1268] underline dark:text-purple-300" to={message.context.url}>{message.context.label}</Link> : message.context.label}</p>}
                <time className="mt-2 block text-xs text-zinc-500" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
              </li>
            ))}
          </ol>
          <form className="border-t border-zinc-200 p-4 dark:border-white/10" onSubmit={(event) => void submit(event)}>
            <label className="block text-sm font-medium" htmlFor="seller-chat-message">Reply to Customer</label>
            <textarea className="mt-2 block min-h-24 w-full border border-zinc-300 bg-white p-3 text-sm focus-visible:outline-2 focus-visible:outline-[#4C1268] disabled:opacity-50 dark:border-white/20 dark:bg-[#202024]" disabled={!thread.send_allowed || busy} id="seller-chat-message" maxLength={2000} onChange={(event) => { setBody(event.target.value); setSendError(''); if (pendingKey.current?.body !== event.target.value.trim()) pendingKey.current = null }} value={body} />
            {!thread.send_allowed && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">This conversation cannot receive new replies right now.</p>}
            {sendError && <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">{sendError}</p>}
            <button className="mt-3 rounded-md bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!thread.send_allowed || busy || !body.trim()} type="submit">{busy ? 'Sending…' : 'Send reply'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
