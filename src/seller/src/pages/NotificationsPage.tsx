import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listNotifications, relativeNotificationTime } from '../lib/notifications'
import type { SellerNotification } from '../types/notifications'

type Status = 'all' | 'unread' | 'read'

export function NotificationsPage() {
  const [status, setStatus] = useState<Status>('all')
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [items, setItems] = useState<SellerNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    document.title = 'Notifications | Aisley Seller'
    setLoading(true); setError('')
    listNotifications(status, 20, page).then((response) => { if (active) { setItems(response.data); setLastPage(response.meta.last_page) } }).catch(() => { if (active) setError('Notifications could not be loaded.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, reload, status])

  function selectStatus(value: Status) { setStatus(value); setPage(1) }

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-white/10"><div><h2 className="text-xl font-semibold">Notifications</h2><p className="mt-1 text-sm text-zinc-500">Order, inventory, compliance, and pickup updates for your Shop.</p></div><div aria-label="Notification filter" className="flex gap-1" role="group">{(['all', 'unread', 'read'] as const).map((value) => <button className={`rounded-md px-3 py-2 text-sm font-medium ${status === value ? 'bg-[#4C1268] text-white' : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-white/[0.05]'}`} key={value} onClick={() => selectStatus(value)} type="button">{value[0].toUpperCase() + value.slice(1)}</button>)}</div></div>
    {loading ? <p className="py-12 text-center text-sm text-zinc-500" role="status">Loading notifications…</p> : null}
    {error ? <div className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}<button className="ml-2 font-semibold underline" onClick={() => setReload((value) => value + 1)} type="button">Try again</button></div> : null}
    {!loading && !error && items.length === 0 ? <p className="mt-4 border border-dashed border-zinc-300 bg-white px-5 py-12 text-center text-sm text-zinc-500 dark:border-white/15 dark:bg-[#18181b]">No {status === 'all' ? '' : status} notifications yet.</p> : null}
    {!loading && !error && items.length ? <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">{items.map((notification) => <Link className={`block border-b border-zinc-200 px-4 py-4 last:border-0 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.04] ${notification.read_at ? '' : 'border-l-4 border-l-[#4C1268] pl-3'}`} key={notification.id} to={`/notifications/${notification.id}`}><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">{notification.title}</h3><p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{notification.summary}</p></div><time className="shrink-0 text-xs text-zinc-500">{relativeNotificationTime(notification.created_at)}</time></div></Link>)}</div> : null}
    {lastPage > 1 ? <nav aria-label="Notification pages" className="mt-4 flex items-center justify-between"><button className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">Previous</button><span className="text-sm text-zinc-500">Page {page} of {lastPage}</span><button className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/15" disabled={page >= lastPage} onClick={() => setPage((value) => value + 1)} type="button">Next</button></nav> : null}
  </div>
}
