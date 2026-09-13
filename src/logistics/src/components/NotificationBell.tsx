import { useCallback, useEffect, useState } from 'react'
import { FaArrowsRotate, FaBell, FaChevronRight } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, requestWithTimeout } from '../lib/api'
import type { NotificationPage, UnreadCountResponse } from '../types/notifications'

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
}

function errorMessage(caught: unknown): string {
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  if (caught instanceof ApiError && caught.status === 408) return 'Notifications took too long to load.'
  return caught instanceof ApiError ? caught.message : 'Notifications are temporarily unavailable.'
}

export function NotificationBell() {
  const { logistics } = useAuth()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [recent, setRecent] = useState<NotificationPage['data'] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [authorizationLost, setAuthorizationLost] = useState(false)

  const load = useCallback(async () => {
    if (!logistics || authorizationLost || document.visibilityState !== 'visible') return
    setLoading(true)
    setError('')
    const [countResult, listResult] = await Promise.allSettled([
      requestWithTimeout<UnreadCountResponse>('/api/v1/logistics/notifications/unread-count'),
      requestWithTimeout<NotificationPage>('/api/v1/logistics/notifications?status=all&per_page=5&page=1'),
    ])
    let failed = false
    if (countResult.status === 'fulfilled') {
      const value = Number(countResult.value.data?.unread_count)
      if (Number.isFinite(value) && value >= 0) setCount(value)
      else failed = true
    } else failed = true
    if (listResult.status === 'fulfilled') setRecent(listResult.value.data ?? [])
    else failed = true
    const reason = countResult.status === 'rejected' ? countResult.reason : listResult.status === 'rejected' ? listResult.reason : null
    if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
      setAuthorizationLost(true)
      setCount(null)
      setRecent(null)
    }
    if (failed) setError(errorMessage(reason))
    setLoading(false)
  }, [authorizationLost, logistics])

  useEffect(() => {
    if (!logistics) {
      setCount(null)
      setRecent(null)
      setError('')
      setAuthorizationLost(false)
      return
    }
    void load()
    const onFocus = () => void load()
    const onChanged = () => void load()
    const onVisibility = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('aisley:logistics-notifications-changed', onChanged)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(() => void load(), 30000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('aisley:logistics-notifications-changed', onChanged)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [load, logistics])

  return <div className="relative">
    <button aria-expanded={open} aria-haspopup="dialog" aria-label={count && count > 0 ? `Notifications, ${count} unread` : 'Notifications'} className="relative grid size-10 place-items-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/10" onClick={() => setOpen((current) => !current)} type="button">
      <FaBell aria-hidden="true" />
      {count !== null && count > 0 ? <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#4C1268] px-1 text-center text-[10px] font-bold leading-5 text-white">{count > 99 ? '99+' : count}</span> : null}
    </button>
    {open ? <div aria-label="Recent notifications" className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-2rem))] border border-zinc-200 bg-white p-3 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#18181b] dark:text-white" role="dialog">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-white/10"><div><p className="text-sm font-semibold">Notifications</p><p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{count === null ? 'Unread count unavailable' : `${count} unread`}</p></div><button aria-label="Refresh notifications" className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-white/10" disabled={loading} onClick={() => void load()} type="button"><FaArrowsRotate className={loading ? 'animate-spin' : ''} aria-hidden="true" /></button></div>
      {error ? <p className="border-b border-zinc-200 px-1 py-3 text-xs text-red-700 dark:border-white/10 dark:text-red-300" role="alert">{error}</p> : null}
      {recent?.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{recent.map((item) => <li key={item.id}><Link className="block px-1 py-3 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#4C1268] dark:hover:bg-white/[0.04]" onClick={() => setOpen(false)} to={`/notifications/${item.id}`}><div className="flex items-start gap-2"><span className={`mt-1 size-2 shrink-0 rounded-full ${item.read_at ? 'bg-zinc-300 dark:bg-zinc-600' : 'bg-[#4C1268] dark:bg-purple-300'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{item.summary}</span><span className="mt-1 block text-[11px] text-zinc-500">{formatDate(item.created_at)}</span></span><FaChevronRight className="mt-1 shrink-0 text-xs text-zinc-400" aria-hidden="true" /></div></Link></li>)}</ul> : recent && !error ? <p className="px-1 py-6 text-center text-sm text-zinc-500">No notifications yet.</p> : null}
      <Link className="mt-2 flex items-center justify-between border-t border-zinc-200 px-1 pt-3 text-sm font-medium text-[#4C1268] hover:underline dark:border-white/10 dark:text-purple-300" onClick={() => setOpen(false)} to="/notifications">View all notifications <FaChevronRight aria-hidden="true" /></Link>
    </div> : null}
  </div>
}
