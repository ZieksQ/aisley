import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { OperationalThreadPanel } from '../components/OperationalThreadPanel'
import { ApiError } from '../lib/api'
import { operationalChat, type OperationalThread } from '../lib/operationalChat'

export function OperationalChatPage() {
  const [params, setParams] = useSearchParams()
  const [threads, setThreads] = useState<OperationalThread[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [error, setError] = useState('')
  const leg = params.get('leg')
  const taskId = params.get('task_id')
  const context: { leg: 'first_mile' | 'final_mile'; taskId: string } | null =
    leg === 'first_mile' || leg === 'final_mile' ? taskId ? { leg, taskId } : null : null
  const selected = threads.find((thread) => thread.id === selectedId) ?? null

  useEffect(() => {
    if (context) setSelectedId(null)
  }, [context?.leg, context?.taskId])

  const load = useCallback(async (append = false, cursor?: string) => {
    if (!navigator.onLine) {
      setError('You are offline. Reconnect to load messages.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const page = await operationalChat.list(cursor)
      setThreads((current) => append
        ? [...current, ...page.data.filter((item) => !current.some((saved) => saved.id === item.id))]
        : [...page.data, ...current.filter((item) => !page.data.some((fresh) => fresh.id === item.id))])
      setNextCursor(page.meta.next_cursor)
      setUnreadTotal(page.meta.unread_count ?? 0)
      setError('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The Courier inbox could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Courier messages | Aisley Logistics'
    void load()
  }, [load])
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load()
    }
    const timer = window.setInterval(poll, 15000)
    window.addEventListener('focus', poll)
    window.addEventListener('online', poll)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', poll)
      window.removeEventListener('online', poll)
    }
  }, [load])

  function saved(thread: OperationalThread) {
    setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)])
    setSelectedId(thread.id)
    setParams({})
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Courier messages</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Private conversations tied to active pickup and delivery tasks.
            {unreadTotal ? ` ${unreadTotal} unread message${unreadTotal === 1 ? '' : 's'}.` : ''}
          </p>
        </div>
        <button className="border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-white/20 dark:hover:bg-white/5" onClick={() => void load()} type="button">
          Refresh inbox
        </button>
      </div>
      {error ? <p className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
      <div className="grid overflow-hidden border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#171719] md:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
        <aside aria-label="Conversation inbox" className="border-b border-zinc-200 dark:border-white/10 md:border-b-0 md:border-r">
          <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-white/10">Inbox</div>
          {loading && !threads.length ? <p className="p-4 text-sm text-zinc-500">Loading conversations…</p> : null}
          {!loading && !threads.length ? <p className="p-4 text-sm text-zinc-500">No task conversations yet. Open a task in Parcel search to contact its Courier.</p> : null}
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
                    {thread.unread_count ? <span className="border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-xs font-semibold text-[#4C1268] dark:border-purple-400/25 dark:bg-purple-400/10 dark:text-purple-200">{thread.unread_count} unread</span> : null}
                  </span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">{thread.task_reference ?? thread.task_id.slice(0, 8)} · {thread.leg.replaceAll('_', ' ')}</span>
                  <span className="mt-1 block truncate text-xs text-zinc-600 dark:text-zinc-400">{thread.last_message_preview}</span>
                </button>
              </li>
            ))}
          </ul>
          {nextCursor ? <button className="w-full border-t border-zinc-200 px-4 py-3 text-sm font-medium text-[#4C1268] hover:bg-zinc-50 dark:border-white/10 dark:text-purple-300 dark:hover:bg-white/5" disabled={loading} onClick={() => void load(true, nextCursor)} type="button">Load more conversations</button> : null}
        </aside>
        <OperationalThreadPanel context={context} onSaved={saved} selected={selected} />
      </div>
    </div>
  )
}
