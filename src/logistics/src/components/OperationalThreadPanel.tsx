import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../lib/api'
import { operationalChat, type OperationalMessage, type OperationalThread } from '../lib/operationalChat'

type TaskContext = { leg: 'first_mile' | 'final_mile'; taskId: string }

function errorText(caught: unknown): string {
  if (!navigator.onLine) return 'You are offline. Reconnect before sending or refreshing messages.'
  if (caught instanceof ApiError) {
    if (caught.status === 409) return 'This task or message changed. Refresh the conversation before trying again.'
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
  const [thread, setThread] = useState<OperationalThread | null>(selected)
  const [messages, setMessages] = useState<OperationalMessage[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<{ key: string; body: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pendingRef = useRef<{ key: string; body: string } | null>(null)
  const activeIdRef = useRef(selected?.id ?? null)
  activeIdRef.current = selected?.id ?? null

  const refresh = useCallback(async (id: string, replace = false) => {
    const [detail, history] = await Promise.all([operationalChat.show(id), operationalChat.history(id)])
    if (activeIdRef.current !== id) return
    setThread(detail.data)
    setMessages((current) => replace ? history.data : mergeMessages(current, history.data))
    if (replace) setOlderCursor(history.meta.next_cursor)
    if (history.data.length) {
      const last = history.data[history.data.length - 1].sequence
      if (last > detail.data.last_read_sequence) {
        const read = await operationalChat.read(id, last)
        if (activeIdRef.current === id) setThread(read.data)
      }
    }
  }, [])

  useEffect(() => {
    setThread(selected)
    setMessages([])
    setOlderCursor(null)
    setDraft('')
    setPending(null)
    pendingRef.current = null
    setError('')
    setNotice('')
    if (!selected) return
    let cancelled = false
    setLoading(true)
    void refresh(selected.id, true)
      .catch((caught) => { if (!cancelled) setError(errorText(caught)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selected?.id, refresh])

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
      setError(errorText(caught))
    } finally {
      setLoading(false)
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!navigator.onLine || sending) {
      setError('Reconnect before sending a message.')
      return
    }
    const body = pendingRef.current?.body ?? draft.trim()
    if (!body || body.length > 2000) return
    const attempt = pendingRef.current ?? { key: crypto.randomUUID(), body }
    pendingRef.current = attempt
    setPending(attempt)
    setSending(true)
    setError('')
    setNotice('')
    try {
      const result = thread
        ? await operationalChat.send(thread.id, attempt.body, attempt.key)
        : context ? await operationalChat.start(context.leg, context.taskId, attempt.body, attempt.key) : null
      if (!result) return
      pendingRef.current = null
      setPending(null)
      setDraft('')
      setThread(result.conversation)
      setMessages((current) => mergeMessages(current, [result.message]))
      setNotice('Message saved.')
      onSaved(result.conversation)
    } catch (caught) {
      setError(errorText(caught))
      if (caught instanceof ApiError && caught.status !== 408 && caught.status !== 0 && caught.status < 500) {
        pendingRef.current = null
        setPending(null)
      }
    } finally {
      setSending(false)
    }
  }

  if (!thread && !context) {
    return <div className="grid min-h-80 place-items-center p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Choose a conversation or open an assigned task to message its Courier.</div>
  }

  return (
    <section aria-label="Courier conversation" className="flex min-h-[30rem] flex-col">
      <header className="border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <h2 className="font-semibold">{thread?.counterparty_label ?? 'Message task Courier'}</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {thread?.task_reference ?? (context ? `Task ${context.taskId.slice(0, 8)}` : '')} · {(thread?.leg ?? context?.leg)?.replaceAll('_', ' ')}
        </p>
        {thread?.read_only_reason ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">This task relationship ended. History is read-only.</p> : null}
      </header>
      <div aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {olderCursor ? <button className="text-sm font-medium text-[#4C1268] hover:underline dark:text-purple-300" disabled={loading} onClick={() => void loadOlder()} type="button">Load older messages</button> : null}
        {loading && !messages.length ? <p className="text-sm text-zinc-500">Loading messages…</p> : null}
        {!loading && !messages.length ? <p className="text-sm text-zinc-500">No messages yet. The first message creates this private task conversation.</p> : null}
        {messages.map((message) => (
          <div className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`} key={message.id}>
            <article className={`max-w-[85%] border px-3 py-2 text-sm sm:max-w-[70%] ${message.mine ? 'border-purple-200 bg-purple-50 dark:border-purple-400/25 dark:bg-purple-400/10' : 'border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04]'}`}>
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {message.mine ? 'You' : 'Courier'} · {new Date(message.created_at).toLocaleString('en-PH')}
              </p>
            </article>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 p-4 dark:border-white/10">
        {error ? <p className="mb-2 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
        {notice ? <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-300" role="status">{notice}</p> : null}
        {pending ? <p className="mb-2 text-xs text-amber-800 dark:text-amber-300">Delivery was not confirmed. Retry this exact message with the same send key.</p> : null}
        {thread?.read_only_reason ? null : (
          <form onSubmit={(event) => void send(event)}>
            <label className="sr-only" htmlFor="courier-message">Message Courier</label>
            <textarea
              className="min-h-24 w-full resize-y border border-zinc-300 bg-white p-3 text-sm outline-none focus:border-[#4C1268] dark:border-white/20 dark:bg-[#171719]"
              disabled={sending || Boolean(pending)}
              id="courier-message"
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a task-related message"
              value={draft}
            />
            <div className="mt-2 flex justify-end gap-2">
              <span className="mr-auto self-center text-xs text-zinc-500">{draft.length}/2000</span>
              {pending ? <button className="border border-zinc-300 px-3 py-2 text-sm dark:border-white/20" disabled={sending} onClick={() => { pendingRef.current = null; setPending(null); setError('') }} type="button">Discard retry</button> : null}
              <button className="bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={sending || (!pending && !draft.trim())} type="submit">
                {sending ? 'Sending…' : pending ? 'Retry same message' : 'Send message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
