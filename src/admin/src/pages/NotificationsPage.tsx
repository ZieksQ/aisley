import { useEffect, useState } from 'react'
import { FaBell, FaCheckDouble, FaChevronLeft, FaChevronRight, FaRotateRight } from 'react-icons/fa6'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NotificationCategoryLabel, NotificationFilters, isNotificationCategory, notificationCategoryOptions } from '@aisley/ui/notifications'
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

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

function safeInternalDestination(value: string | null): string | null {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null
}

export function NotificationsPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = ['all', 'unread', 'read'].includes(searchParams.get('status') ?? '') ? (searchParams.get('status') as 'all' | 'unread' | 'read') : 'all'
  const rawCategory = searchParams.get('category')
  const category = rawCategory && isNotificationCategory(rawCategory, 'admin') ? rawCategory : 'all'
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [response, setResponse] = useState<NotificationListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const requestKey = `${status}:${category}:${page}:${reloadKey}`

  useEffect(() => {
    document.title = 'Notifications | Aisley Admin'
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ status, page: String(page), per_page: '20' })
    if (category !== 'all') query.set('category', category)
    setIsLoading(true)
    setError(null)
    fetchNotifications(query, controller.signal)
      .then((nextResponse) => {
        setResponse(nextResponse)
        setLoadedKey(requestKey)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setLoadedKey(requestKey)
        setError({
          status: requestError instanceof ApiError ? requestError.status : 0,
          message: requestError instanceof Error ? requestError.message : 'Unable to load notifications.',
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [category, logout, navigate, page, reloadKey, requestKey, status])

  function updateFilters(nextStatus: 'all' | 'unread' | 'read', nextCategory: string) {
    const next = new URLSearchParams(searchParams)
    if (nextStatus === 'all') next.delete('status')
    else next.set('status', nextStatus)
    if (nextCategory === 'all') next.delete('category')
    else next.set('category', nextCategory)
    next.delete('page')
    setSearchParams(next)
  }

  function setPage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    if (nextPage <= 1) next.delete('page')
    else next.set('page', String(nextPage))
    setSearchParams(next)
  }

  function supportTicketDestination(notification: AdminNotification): string | null {
    if (notification.resource_type !== 'support_ticket' || !isUuid(notification.resource_id)) return null
    return `/support-tickets/${notification.resource_id}`
  }

  const responseIsCurrent = loadedKey === requestKey
  const currentLoading = isLoading || !responseIsCurrent
  const currentCategories = responseIsCurrent ? response?.meta.categories : undefined

  async function openNotification(notification: AdminNotification) {
    setPendingId(notification.id)
    setError(null)
    try {
      if (!notification.read_at) await markNotificationRead(notification.id)
      announceNotificationsUpdated()
      const destination = supportTicketDestination(notification) ?? safeInternalDestination(notification.destination)
      if (destination) navigate(destination)
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
        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5" disabled={isMarkingAll || currentLoading || !responseIsCurrent || !response?.data.some((item) => !item.read_at)} onClick={() => void markAllRead()} type="button">
          <FaCheckDouble aria-hidden="true" />
          {isMarkingAll ? 'Updating…' : 'Mark all read'}
        </button>
      </div>

      <div className="mt-5">
        <NotificationFilters
          category={category}
          categories={notificationCategoryOptions('admin', currentCategories)}
          onCategoryChange={(nextCategory) => updateFilters(status, nextCategory)}
          onStatusChange={(nextStatus) => updateFilters(nextStatus, category)}
          role="admin"
          status={status}
        />
      </div>

      {error && (
        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200" role="alert">
          <span>{error.status === 403 ? 'Your administrator account does not have permission to view notifications.' : error.message}</span>
          <button className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-focus)]" onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
        {currentLoading ? (
          <div className="space-y-px bg-slate-100 dark:bg-white/10" aria-label="Loading notifications">
            {[1, 2, 3, 4].map((item) => <div className="h-24 animate-pulse bg-white dark:bg-[#111018]" key={item} />)}
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center text-sm text-slate-600 dark:text-slate-300" role="status">Notifications could not be shown for these filters. Retry the request above.</div>
        ) : responseIsCurrent && response?.data.length === 0 ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div><FaBell aria-hidden="true" className="mx-auto text-xl text-slate-400" /><p className="mt-3 font-semibold">No {status === 'all' ? '' : `${status} `}notifications{category === 'all' ? '' : ` in ${notificationCategoryOptions('admin', currentCategories).find((item) => item.key === category)?.label ?? 'Other'}`}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Updates addressed to you will appear here.</p></div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/[0.07]">
            {response?.data.map((notification) => (
              <li className={notification.read_at ? '' : 'bg-[#F1EAF4]/60 dark:bg-[#2E1B3B]/30'} key={notification.id}>
                <button className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-white/[0.035]" disabled={pendingId === notification.id} onClick={() => void openNotification(notification)} type="button">
                  <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${notification.read_at ? 'bg-slate-300 dark:bg-slate-600' : 'bg-[#4C1268] dark:bg-[#C4B5FD]'}`} />
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{notification.title}</span><span className="text-xs text-slate-500 dark:text-slate-400">{formatNotificationTime(notification.created_at)}</span></span><span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">{notification.summary}</span><span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><NotificationCategoryLabel category={notification.category} categoryLabel={notification.category_label} role="admin" /><span className="font-medium text-slate-500 dark:text-slate-400">{notification.read_at ? 'Read' : 'Unread'}{notification.destination || notification.resource_type === 'support_ticket' ? ' · Open related item' : ''}</span></span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {responseIsCurrent && !currentLoading && !error && response && response.meta.last_page > 1 && (
        <nav aria-label="Notification pages" className="mt-5 flex items-center justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">Page {response.meta.current_page} of {response.meta.last_page}</p>
          <div className="flex gap-2">
            <button aria-label="Previous page" className="grid size-11 place-items-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-white/10" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button"><FaChevronLeft aria-hidden="true" /></button>
            <button aria-label="Next page" className="grid size-11 place-items-center rounded-lg border border-slate-200 disabled:opacity-40 dark:border-white/10" disabled={page >= response.meta.last_page} onClick={() => setPage(page + 1)} type="button"><FaChevronRight aria-hidden="true" /></button>
          </div>
        </nav>
      )}

      {!currentLoading && error && <button className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4C1268] dark:text-[#C4B5FD]" onClick={() => setReloadKey((value) => value + 1)} type="button"><FaRotateRight aria-hidden="true" />Try again</button>}
    </div>
  )
}
