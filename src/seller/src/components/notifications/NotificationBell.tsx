import { useCallback, useEffect, useRef, useState } from 'react'
import { FaBell, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { listNotifications, relativeNotificationTime } from '../../lib/notifications'
import type { SellerNotification } from '../../types/notifications'

const previewLimit = 5

export function NotificationBell() {
  const container = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<SellerNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const unread = await listNotifications('unread', previewLimit)
      setUnreadCount(unread.meta.total)
      const unreadItems = unread.data.slice(0, previewLimit)
      if (unreadItems.length === previewLimit) setNotifications(unreadItems)
      else {
        const read = await listNotifications('read', previewLimit - unreadItems.length)
        setNotifications([...unreadItems, ...read.data].slice(0, previewLimit))
      }
    } catch {
      setError('Notifications could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60_000)
    const refresh = () => void load()
    window.addEventListener('seller-notifications-updated', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('seller-notifications-updated', refresh) }
  }, [load])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [open])

  return <div className="relative" ref={container}>
    <button aria-expanded={open} aria-haspopup="dialog" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} className="relative grid size-10 place-items-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/10" onClick={() => { setOpen((value) => !value); if (!open) void load() }} title="Notifications" type="button">
      <FaBell aria-hidden="true" />
      {unreadCount ? <span aria-hidden="true" className="absolute right-1 top-1 min-w-4 rounded bg-[#E6007A] px-1 text-center text-[10px] font-semibold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
    </button>
    {open ? <div aria-label="Recent notifications" className="absolute right-0 top-12 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-white/15 dark:bg-[#18181b]" role="dialog">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h2 className="font-semibold">Notifications</h2><button aria-label="Close notifications" className="grid size-8 place-items-center rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10" onClick={() => setOpen(false)} type="button"><FaXmark aria-hidden="true" /></button></div>
      <div aria-live="polite">
        {loading && notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading notifications…</p> : null}
        {error ? <div className="px-4 py-6 text-center text-sm text-red-700 dark:text-red-300"><p>{error}</p><button className="mt-2 font-medium underline" onClick={() => void load()} type="button">Try again</button></div> : null}
        {!loading && !error && notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-zinc-500">You’re all caught up.</p> : null}
        {notifications.map((notification) => <Link className={`block border-b border-zinc-100 px-4 py-3 hover:bg-zinc-50 dark:border-white/[0.07] dark:hover:bg-white/[0.05] ${notification.read_at ? '' : 'bg-purple-50 dark:bg-[#4C1268]/20'}`} key={notification.id} onClick={() => setOpen(false)} to={`/notifications/${notification.id}`}><p className="text-sm font-medium">{notification.read_at ? null : <span className="sr-only">Unread notification: </span>}{notification.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{notification.summary}</p><time className="mt-1 block text-[11px] text-zinc-500">{relativeNotificationTime(notification.created_at)}</time></Link>)}
      </div>
      <Link className="block px-4 py-3 text-center text-sm font-semibold text-[#4C1268] hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-white/[0.05]" onClick={() => setOpen(false)} to="/notifications">View all notifications</Link>
    </div> : null}
  </div>
}
