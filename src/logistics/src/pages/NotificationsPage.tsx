import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaArrowLeft, FaArrowRight, FaArrowsRotate } from 'react-icons/fa6'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { NotificationCategoryLabel, NotificationCenter, isNotificationCategory, notificationCategoryOptions } from '@aisley/ui/notifications'
import { ErrorNotice, PrimaryButton, link, panel } from '../components/PickupUi'
import { useAuth } from '../auth/useAuth'
import { ApiError, csrf, request, requestWithTimeout } from '../lib/api'
import type { LogisticsNotification, NotificationPage, NotificationResponse, NotificationStatus } from '../types/notifications'

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
}

function typeLabel(value: string): string {
  return value.replace(/^logistics-/, '').replace(/[._-]/g, ' ')
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

function supportTicketDestination(item: LogisticsNotification): string | null {
  if (item.resource_type !== 'support_ticket' || !isUuid(item.resource_id)) return null
  return `/support-tickets?ticket=${encodeURIComponent(item.resource_id)}`
}

function safeInternalDestination(value: string | null | undefined): string | null {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null
}

function messageFor(caught: unknown, fallback: string): string {
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  if (caught instanceof ApiError && caught.status === 408) return 'The request timed out. Check your connection and try again.'
  return caught instanceof ApiError ? caught.message : fallback
}

export function NotificationsPage() {
  const { notificationId } = useParams()
  const { logistics } = useAuth()
  if (!logistics) return null
  return notificationId ? <NotificationDetail notificationId={notificationId} /> : <NotificationList key={logistics.id} />
}

function NotificationList() {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status: NotificationStatus = statusParam === 'unread' || statusParam === 'read' ? statusParam : 'all'
  const rawCategory = params.get('category')
  const category = rawCategory && isNotificationCategory(rawCategory, 'logistics') ? rawCategory : 'all'
  const requestedPage = Number(params.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [result, setResult] = useState<NotificationPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestRevision = useRef(0)
  const [loadedKey, setLoadedKey] = useState('')
  const requestKey = `${status}:${category}:${page}`

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ status, page: String(page), per_page: '20' })
    if (category !== 'all') query.set('category', category)
    const revision = ++requestRevision.current
    try {
      const response = await requestWithTimeout<NotificationPage>(`/api/v1/logistics/notifications?${query.toString()}`)
      if (revision === requestRevision.current) { setResult(response); setLoadedKey(requestKey) }
    } catch (caught) {
      if (revision === requestRevision.current) { setError(messageFor(caught, 'We could not load your notifications.')); setLoadedKey(requestKey) }
    } finally {
      if (revision === requestRevision.current) setLoading(false)
    }
  }, [category, page, requestKey, status])

  useEffect(() => {
    void load()
    return () => { ++requestRevision.current }
  }, [load])

  const responseIsCurrent = loadedKey === requestKey
  const currentLoading = loading || !responseIsCurrent
  const currentError = responseIsCurrent ? error : ''
  const currentResult = responseIsCurrent ? result : null
  const total = currentResult?.meta?.total ?? 0
  const lastPage = currentResult?.meta?.last_page ?? 1
  const setFilters = (nextStatus: NotificationStatus, nextCategory: string) => setParams((current) => {
    const nextParams = new URLSearchParams(current)
    if (nextStatus === 'all') nextParams.delete('status')
    else nextParams.set('status', nextStatus)
    if (nextCategory === 'all') nextParams.delete('category')
    else nextParams.set('category', nextCategory)
    nextParams.delete('page')
    return nextParams
  })
  const movePage = (nextPage: number) => setParams((current) => { const nextParams = new URLSearchParams(current); nextParams.set('page', String(nextPage)); return nextParams }, { replace: true })

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <NotificationCenter headingLevel={2} role="logistics" description="Operational alerts for this Logistics organization and hub."
      items={currentResult?.data ?? []} total={currentLoading ? undefined : total}
      loading={currentLoading} error={currentError} onRetry={() => void load()}
      status={status} category={category} categories={notificationCategoryOptions('logistics', currentResult?.meta?.categories)}
      onStatusChange={next => setFilters(next, category)} onCategoryChange={next => setFilters(status, next)}
      page={page} lastPage={lastPage} onPageChange={movePage}
      actions={<button className="notification-button" disabled={currentLoading} onClick={() => void load()} type="button"><FaArrowsRotate aria-hidden="true" /> Refresh</button>}
      renderAction={(item, props) => <Link {...props} to={supportTicketDestination(item) ?? `/notifications/${item.id}`}
        onClick={() => { if (supportTicketDestination(item) && !item.read_at) markLogisticsNotificationRead(item.id) }} />}
    />
  </div>
}

function markLogisticsNotificationRead(id: string) {
  void csrf()
    .then(() => request<NotificationResponse>(`/api/v1/logistics/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: JSON.stringify({}) }))
    .then(() => window.dispatchEvent(new Event('aisley:logistics-notifications-changed')))
    .catch(() => undefined)
}

function NotificationDetail({ notificationId }: { notificationId: string }) {
  const [item, setItem] = useState<LogisticsNotification | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [readError, setReadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await requestWithTimeout<NotificationResponse>(`/api/v1/logistics/notifications/${encodeURIComponent(notificationId)}`)
      setItem(response.data)
    } catch (caught) {
      setError(messageFor(caught, 'We could not load this notification.'))
      setItem(null)
    } finally {
      setLoading(false)
    }
  }, [notificationId])

  useEffect(() => { void load() }, [load])

  async function markRead() {
    if (!item || item.read_at || busy) return
    setBusy(true)
    setReadError('')
    try {
      await csrf()
      const response = await request<NotificationResponse>(`/api/v1/logistics/notifications/${encodeURIComponent(item.id)}/read`, { method: 'POST', body: JSON.stringify({}) })
      setItem(response.data)
      window.dispatchEvent(new Event('aisley:logistics-notifications-changed'))
    } catch (caught) {
      setReadError(messageFor(caught, 'We could not mark this notification as read.'))
    } finally {
      setBusy(false)
    }
  }

  const destination = useMemo(() => item ? supportTicketDestination(item) ?? safeInternalDestination(item.destination) : null, [item])

  if (loading) return <div className="w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8"><p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">Loading notification…</p></div>
  if (error || !item) return <div className="w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8"><Link className={`${link} inline-flex items-center`} to="/notifications"><FaArrowLeft className="mr-2" aria-hidden="true" />Back to notifications</Link><div className="mt-4"><ErrorNotice message={error || 'This notification is unavailable.'} retry={() => void load()} /></div></div>

  return <div className="w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8"><Link className={`${link} inline-flex items-center`} to="/notifications"><FaArrowLeft className="mr-2" aria-hidden="true" />Back to notifications</Link><article className={`${panel} mt-3 p-4 sm:p-5`}><div className="flex flex-col gap-2 border-b border-zinc-200 pb-3 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:gap-3"><div className="min-w-0"><NotificationCategoryLabel category={item.category} categoryLabel={item.category_label} role="logistics" className="block" /><p className="mt-1 text-xs font-medium capitalize text-zinc-600 dark:text-zinc-400">{typeLabel(item.type)}</p><h2 className="mt-1 break-words text-lg font-semibold sm:text-xl">{item.title}</h2></div>{item.read_at ? <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">Read {formatDate(item.read_at)}</span> : <span className="shrink-0 text-xs font-medium text-[#1E40AF] dark:text-[#93C5FD]">Unread</span>}</div><p className="mt-4 break-words text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.summary}</p><p className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">Received {formatDate(item.created_at)}</p>{destination ? <Link className={`${link} mt-4 inline-flex min-h-11 items-center gap-2`} to={destination}>{item.resource_type === 'support_ticket' ? 'Open support ticket' : item.type === 'logistics-courier.vehicle-updated' ? 'Open Courier vehicle' : 'Open related Logistics record'} <FaArrowRight aria-hidden="true" /></Link> : <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{item.type === 'logistics-courier.vehicle-updated' ? 'This Courier vehicle is no longer available to your organization.' : 'The related record is no longer available. Review the current operations queue for authoritative state.'}</p>}{readError ? <div className="mt-4"><ErrorNotice message={readError} retry={() => void markRead()} /></div> : null}{!item.read_at ? <div className="mt-5"><PrimaryButton busy={busy} onClick={() => void markRead()}>Mark as read</PrimaryButton></div> : null}</article><p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">Opening a notification does not change shipment, Courier, evidence, or pickup state.</p></div>
}
