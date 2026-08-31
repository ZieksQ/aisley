import { useCallback, useEffect, useRef, useState } from 'react'
import { FaBell, FaCheck, FaTriangleExclamation } from 'react-icons/fa6'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import {
  announceNotificationsUpdated,
  fetchNotifications,
  fetchUnreadCount,
  formatNotificationTime,
  markNotificationRead,
  notificationsUpdatedEvent,
} from '../lib/notifications'
import type { AdminNotification } from '../types/notifications'

const POLL_INTERVAL_MS = 30_000

export function AdminNotificationBell() {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const query = new URLSearchParams({ page: '1', per_page: '5' })
    try {
      const [count, list] = await Promise.all([
        fetchUnreadCount(),
        fetchNotifications(query),
      ])
      setUnreadCount(count.unread_count)
      setNotifications(list.data)
      setError(null)
    } catch (requestError) {
      if (!(requestError instanceof ApiError && requestError.status === 401)) {
        setError('Notifications could not be refreshed.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const poll = window.setInterval(() => void refresh(), POLL_INTERVAL_MS)
    const refetch = () => void refresh()
    const refetchWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('online', refetch)
    window.addEventListener('focus', refetch)
    window.addEventListener(notificationsUpdatedEvent, refetch)
    document.addEventListener('visibilitychange', refetchWhenVisible)

    return () => {
      window.clearInterval(poll)
      window.removeEventListener('online', refetch)
      window.removeEventListener('focus', refetch)
      window.removeEventListener(notificationsUpdatedEvent, refetch)
      document.removeEventListener('visibilitychange', refetchWhenVisible)
    }
  }, [refresh])

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  async function openNotification(notification: AdminNotification) {
    if (!notification.read_at) {
      try {
        await markNotificationRead(notification.id)
        announceNotificationsUpdated()
      } catch {
        setError('This notification could not be marked as read.')
        return
      }
    }
    setIsOpen(false)
    navigate(notification.destination ?? '/notifications')
  }

  const status = isLoading
    ? 'Notifications are loading'
    : `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`

  return (
    <div className="relative" ref={rootRef}>
      <span aria-live="polite" className="sr-only">{status}</span>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Notifications. ${status}.`}
        className="relative grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <FaBell aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-md bg-[#E6007A] px-1 text-center text-[11px] font-bold leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          aria-label="Recent notifications"
          className="absolute right-0 top-12 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#17111d]"
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <p className="font-semibold">Notifications</p>
            <Link className="text-sm font-semibold text-[#b0005d] hover:text-[#E6007A] dark:text-pink-300" onClick={() => setIsOpen(false)} to="/notifications">
              View all
            </Link>
          </div>

          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading notifications…</p>
          ) : error ? (
            <div className="px-4 py-6 text-center">
              <FaTriangleExclamation aria-hidden="true" className="mx-auto text-amber-500" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error}</p>
              <button className="mt-3 text-sm font-semibold text-[#b0005d] dark:text-pink-300" onClick={() => void refresh()} type="button">Try again</button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <FaCheck aria-hidden="true" className="mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="mt-2 text-sm font-medium">You’re all caught up.</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Important Admin updates will appear here.</p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-white/[0.07]">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => void openNotification(notification)} type="button">
                    <span className="flex items-start gap-3">
                      <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read_at ? 'bg-slate-300 dark:bg-slate-600' : 'bg-[#E6007A]'}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{notification.title}</span>
                        <span className="mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400">{notification.summary}</span>
                        <span className="mt-1.5 block text-xs text-slate-400">{formatNotificationTime(notification.created_at)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
