import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { listConversations, type Conversation } from '../lib/messages'

export function MessagesPage() {
  const [items, setItems] = useState<Conversation[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const result = await listConversations()
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]))
        result.items.forEach((item) => byId.set(item.id, item))
        return [...byId.values()].sort((left, right) =>
          (right.last_message_at ?? '').localeCompare(left.last_message_at ?? '') || right.id.localeCompare(left.id))
      })
      setCursor((current) => current ?? result.next_cursor)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Messages could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Messages | Aisley Seller'
    void refresh()
    const onFocus = () => { if (navigator.onLine) void refresh() }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh()
    }, 20000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [refresh])

  async function loadMore() {
    if (!cursor) return
    setBusy(true)
    try {
      const result = await listConversations(cursor)
      setItems((current) => [...current, ...result.items.filter((item) => !current.some((entry) => entry.id === item.id))])
      setCursor(result.next_cursor)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Older conversations could not be loaded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
        <h2 className="text-2xl font-semibold">Messages</h2>
        <button className="text-sm font-medium text-[#4C1268] hover:underline dark:text-purple-300" onClick={() => void refresh()} type="button">Refresh</button>
      </div>
      {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error} <button className="underline" onClick={() => void refresh()} type="button">Retry</button></p>}
      {loading ? <p className="mt-6 text-sm text-zinc-500" role="status">Loading messages…</p> : items.length === 0 ? (
        <p className="mt-5 border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-[#18181b]">No Customer conversations yet.</p>
      ) : (
        <div className="mt-5 divide-y divide-zinc-200 border border-zinc-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#18181b]">
          {items.map((item) => (
            <Link className="flex items-start justify-between gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-white/[0.04]" key={item.id} to={`/messages/${item.id}`}>
              <span className="min-w-0"><span className="block font-semibold">{item.customer_name ?? 'Customer'}</span><span className="mt-1 block truncate text-sm text-zinc-500">{item.last_message_preview}</span></span>
              <span className="shrink-0 text-right text-xs text-zinc-500">{item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : ''}{item.unread_count > 0 && <span className="mt-1 block font-semibold text-[#4C1268] dark:text-purple-300">{item.unread_count} unread</span>}</span>
            </Link>
          ))}
        </div>
      )}
      {cursor && <button className="mt-4 border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/20" disabled={busy} onClick={() => void loadMore()} type="button">{busy ? 'Loading…' : 'Load older conversations'}</button>}
    </div>
  )
}
