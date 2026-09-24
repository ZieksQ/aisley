import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
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
      {error && <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p>}
      <div className="grid overflow-hidden border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#171719] md:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
        <aside aria-label="Logistics conversation inbox" className="border-b border-zinc-200 dark:border-white/10 md:border-b-0 md:border-r">
          <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-white/10">Inbox</div>
          {loading && !threads.length && <p className="p-4 text-sm text-zinc-500">Loading conversations…</p>}
          {!loading && !threads.length && <p className="p-4 text-sm text-zinc-500">No conversations yet. Open a pickup request to contact its Logistics provider.</p>}
          <ul className="max-h-[36rem] divide-y divide-zinc-200 overflow-y-auto dark:divide-white/10">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  aria-current={selectedId === thread.id ? 'true' : undefined}
                  className={`w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-white/5 ${selectedId === thread.id ? 'bg-purple-50 dark:bg-purple-400/10' : ''}`}
                  onClick={() => { setSelectedId(thread.id); setParams({}) }}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{thread.counterparty_label}</span>
                    {thread.unread_count > 0 && <span className="text-xs font-semibold text-[#4C1268] dark:text-purple-300">{thread.unread_count} unread</span>}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">Pickup {thread.pickup_request_reference ?? thread.pickup_request_id.slice(0, 8)}</span>
                  <span className="mt-1 block truncate text-xs text-zinc-600 dark:text-zinc-400">{thread.last_message_preview}</span>
                </button>
              </li>
            ))}
          </ul>
          {cursor && <button className="w-full border-t border-zinc-200 px-4 py-3 text-sm font-medium text-[#4C1268] dark:border-white/10 dark:text-purple-300" disabled={loading} onClick={() => void load(true, cursor)} type="button">Load more conversations</button>}
        </aside>
        <LogisticsMessageThread contextId={selected ? null : pickupId} onSaved={saved} selected={selected} />
      </div>
    </div>
  )
}

function LogisticsMessageThread({ contextId, selected, onSaved }: {
  contextId: string | null
  selected: LogisticsThread | null
  onSaved: (thread: LogisticsThread) => void
}) {
  const selectedId = selected?.id ?? null
  const [thread, setThread] = useState<LogisticsThread | null>(selected)
  const [messages, setMessages] = useState<LogisticsMessage[]>([])
  const [older, setOlder] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<{ body: string; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
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
    if (last > detail.data.last_read_sequence) {
      const read = await logisticsMessages.read(id, last)
      if (activeId.current === id) setThread(read.data)
    }
  }, [])

  useEffect(() => {
    setThread(null)
    setMessages([])
    setOlder(null)
    setDraft('')
    setPending(null)
    setError('')
    setNotice('')
    if (selectedId) void refresh(selectedId).catch((reason) => setError(failure(reason)))
  }, [selectedId, refresh])
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

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!navigator.onLine) {
      setError('Reconnect before sending a message.')
      return
    }
    if (busy) return
    const attempt = pending ?? { body: draft.trim(), key: crypto.randomUUID() }
    if (!attempt.body || attempt.body.length > 2000) return
    setPending(attempt)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = thread ? await logisticsMessages.send(thread.id, attempt.body, attempt.key)
        : contextId ? await logisticsMessages.start(contextId, attempt.body, attempt.key) : null
      if (!result) return
      setPending(null)
      setDraft('')
      setThread(result.conversation)
      setMessages((current) => merge(current, [result.message]))
      setNotice('Message saved.')
      onSaved(result.conversation)
    } catch (reason) {
      setError(failure(reason))
      if (reason instanceof ApiError && reason.status !== 408 && reason.status !== 0 && reason.status < 500) setPending(null)
    } finally {
      setBusy(false)
    }
  }

  async function loadOlder() {
    if (!thread || !older) return
    try {
      const page = await logisticsMessages.history(thread.id, older)
      setMessages((current) => merge(page.data, current))
      setOlder(page.meta.next_cursor)
    } catch (reason) {
      setError(failure(reason))
    }
  }

  if (!thread && !contextId) {
    return <div className="grid min-h-80 place-items-center p-8 text-center text-sm text-zinc-500">{selectedId ? 'Loading conversation…' : 'Choose a conversation or open a pickup request to message Logistics.'}</div>
  }

  return (
    <section aria-label="Logistics conversation" className="flex min-h-[30rem] flex-col">
      <header className="border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <h2 className="font-semibold">{thread?.counterparty_label ?? 'Contact Logistics'}</h2>
        <p className="mt-1 text-xs text-zinc-500">Pickup {thread?.pickup_request_reference ?? contextId?.slice(0, 8)}</p>
        {thread?.read_only_reason && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">This pickup relationship ended. History is read-only.</p>}
      </header>
      <div aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {older && <button className="text-sm font-medium text-[#4C1268] hover:underline dark:text-purple-300" onClick={() => void loadOlder()} type="button">Load older messages</button>}
        {!messages.length && <p className="text-sm text-zinc-500">No messages yet. Your first message creates this private conversation.</p>}
        {messages.map((message) => (
          <div className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`} key={message.id}>
            <article className={`max-w-[85%] border px-3 py-2 text-sm sm:max-w-[70%] ${message.mine ? 'border-purple-200 bg-purple-50 dark:border-purple-400/25 dark:bg-purple-400/10' : 'border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04]'}`}>
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{message.sender_role} · {new Date(message.created_at).toLocaleString()}</p>
            </article>
          </div>
        ))}
      </div>
      <form className="border-t border-zinc-200 p-4 dark:border-white/10" onSubmit={(event) => void send(event)}>
        {error && <p className="mb-2 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
        {notice && <p className="mb-2 text-sm text-green-700 dark:text-green-300" role="status">{notice}</p>}
        <label className="block text-sm font-medium" htmlFor="logistics-message">Message</label>
        <textarea
          className="mt-2 min-h-24 w-full border border-zinc-300 bg-white p-3 text-sm outline-none focus:border-[#4C1268] dark:border-white/20 dark:bg-[#111113]"
          disabled={busy || thread?.send_allowed === false}
          id="logistics-message"
          maxLength={2000}
          onChange={(event) => {
            setDraft(event.target.value)
            if (pending && pending.body !== event.target.value.trim()) setPending(null)
          }}
          value={draft}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">{draft.length}/2000 · Messages are saved before they appear.</span>
          <button className="border border-[#4C1268] bg-[#4C1268] px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy || !draft.trim() || thread?.send_allowed === false} type="submit">
            {busy ? 'Sending…' : pending ? 'Retry send' : 'Send message'}
          </button>
        </div>
      </form>
    </section>
  )
}
