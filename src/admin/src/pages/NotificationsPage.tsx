import { useEffect, useState } from 'react'
import { FaBell, FaCheckDouble, FaChevronLeft, FaChevronRight, FaRotateRight } from 'react-icons/fa6'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import {
  announceNotificationsUpdated,
  fetchNotifications,
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications'
import type { AdminNotification, NotificationListResponse } from '../types/notifications'

export function NotificationsPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = ['all', 'unread', 'read'].includes(searchParams.get('status') ?? '') ? (searchParams.get('status') as 'all' | 'unread' | 'read') : 'all'
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [response, setResponse] = useState<NotificationListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'Notifications | Aisley Admin'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ status, page: String(page), per_page: '20' })
    setIsLoading(true)
    setError(null)
    fetchNotifications(query, controller.signal)
      .then(setResponse)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setError({
          status: requestError instanceof ApiError ? requestError.status : 0,
          message: requestError instanceof Error ? requestError.message : 'Unable to load notifications.',
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [logout, navigate, page, reloadKey, status])

  function setFilter(nextStatus: 'all' | 'unread' | 'read') {
    const next = new URLSearchParams()
    if (nextStatus !== 'all') next.set('status', nextStatus)
    setSearchParams(next)
  }

  async function openNotification(notification: AdminNotification) {
    setPendingId(notification.id)
    setError(null)
    try {
      if (!notification.read_at) await markNotificationRead(notification.id)
      announceNotificationsUpdated()
      if (notification.destination) navigate(notification.destination)
      else setReloadKey((value) => value + 1)
    } catch (requestError) {
      setError({ status: requestError instanceof ApiError ? requestError.status : 0, message: requestError instanceof Error ? requestError.message : 'Unable to update notification.' })
    } finally {
      setPendingId(null)
    }
  }

  async function markAllRead() {
    setIsMarkingAll(true)
    setError(null)
    try {
      await markAllNotificationsRead()
      announceNotificationsUpdated()
      setReloadKey((value) => value + 1)
    } catch (requestError) {
      setError({ status: requestError instanceof ApiError ? requestError.status : 0, message: requestError instanceof Error ? requestError.message : 'Unable to mark notifications as read.' })
    } finally {
      setIsMarkingAll(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Review platform events and work that needs your attention.</p>
        </div>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" disabled={isMarkingAll || !response?.data.some((item) => !item.read_at)} onClick={() => void markAllRead()} type="button">
          <FaCheckDouble aria-hidden="true" />
          {isMarkingAll ? 'Updating…' : 'Mark all read'}
        </button>
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200 dark:border-white/10" role="tablist" aria-label="Notification status">
        {(['all', 'unread', 'read'] as const).map((value) => (
          <button aria-selected={status === value} className={`border-b-2 px-4 py-2.5 text-sm font-semibold capitalize ${status === value ? 'border-[#E6007A] text-slate-950 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`} key={value} onClick={() => setFilter(value)} role="tab" type="button">{value}</button>
        ))}
      </div>

      {error && (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200" role="alert">
          <span>{error.status === 403 ? 'Your administrator account does not have permission to view notifications.' : error.message}</span>
          <button className="shrink-0 font-semibold" onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
        {isLoading ? (
          <div className="space-y-px bg-slate-100 dark:bg-white/10" aria-label="Loading notifications">
            {[1, 2, 3, 4].map((item) => <div className="h-24 animate-pulse bg-white dark:bg-[#111018]" key={item} />)}
          </div>
        ) : !error && response?.data.length === 0 ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div><FaBell aria-hidden="true" className="mx-auto text-xl text-slate-400" /><p className="mt-3 font-semibold">No {status === 'all' ? '' : `${status} `}notifications</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Updates addressed to you will appear here.</p></div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.07]">
            {response?.data.map((notification) => (
              <li className={notification.read_at ? '' : 'bg-pink-50/40 dark:bg-pink-400/[0.04]'} key={notification.id}>
                <button className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-white/[0.035]" disabled={pendingId === notification.id} onClick={() => void openNotification(notification)} type="button">
                  <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${notification.read_at ? 'bg-slate-300 dark:bg-slate-600' : 'bg-[#E6007A]'}`} />
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{notification.title}</span><span className="text-xs text-slate-400">{formatNotificationTime(notification.created_at)}</span></span><span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-400">{notification.summary}</span><span className="mt-2 block text-xs font-medium text-slate-400">{notification.read_at ? 'Read' : 'Unread'}{notification.destination ? ' · Open related item' : ''}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {response && response.meta.last_page > 1 && (
        <nav aria-label="Notification pages" className="mt-5 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">Page {response.meta.current_page} of {response.meta.last_page}</p>
          <div className="flex gap-2">
            <button aria-label="Previous page" className="grid size-10 place-items-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-white/10" disabled={page <= 1} onClick={() => setSearchParams({ ...(status === 'all' ? {} : { status }), page: String(page - 1) })} type="button"><FaChevronLeft aria-hidden="true" /></button>
            <button aria-label="Next page" className="grid size-10 place-items-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-white/10" disabled={page >= response.meta.last_page} onClick={() => setSearchParams({ ...(status === 'all' ? {} : { status }), page: String(page + 1) })} type="button"><FaChevronRight aria-hidden="true" /></button>
          </div>
        </nav>
      )}

      {!isLoading && error && !response && <button className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#b0005d] dark:text-pink-300" onClick={() => setReloadKey((value) => value + 1)} type="button"><FaRotateRight aria-hidden="true" />Try again</button>}
    </div>
  )
}
