import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaArrowLeft, FaArrowRight, FaArrowsRotate, FaCircleInfo } from 'react-icons/fa6'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ActionButton, ErrorNotice, PrimaryButton, field, link, panel } from '../components/PickupUi'
import { ApiError, csrf, request, requestWithTimeout } from '../lib/api'
import type { LogisticsNotification, NotificationPage, NotificationResponse, NotificationStatus } from '../types/notifications'

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
}

function typeLabel(value: string): string {
  return value.replace(/^logistics-/, '').replace(/[._-]/g, ' ')
}

function messageFor(caught: unknown, fallback: string): string {
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  if (caught instanceof ApiError && caught.status === 408) return 'The request timed out. Check your connection and try again.'
  return caught instanceof ApiError ? caught.message : fallback
}

export function NotificationsPage() {
  const { notificationId } = useParams()
  return notificationId ? <NotificationDetail notificationId={notificationId} /> : <NotificationList />
}

function NotificationList() {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status: NotificationStatus = statusParam === 'unread' || statusParam === 'read' ? statusParam : 'all'
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const [result, setResult] = useState<NotificationPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ status, page: String(page), per_page: '20' })
    try {
      setResult(await requestWithTimeout<NotificationPage>(`/api/v1/logistics/notifications?${query.toString()}`))
    } catch (caught) {
      setError(messageFor(caught, 'We could not load your notifications.'))
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { void load() }, [load])

  const total = result?.meta?.total ?? 0
  const lastPage = result?.meta?.last_page ?? 1
  const setFilter = (next: NotificationStatus) => setParams((current) => { const nextParams = new URLSearchParams(current); nextParams.set('status', next); nextParams.delete('page'); return nextParams }, { replace: true })
  const movePage = (nextPage: number) => setParams((current) => { const nextParams = new URLSearchParams(current); nextParams.set('page', String(nextPage)); return nextParams }, { replace: true })

  return <div className="w-full max-w-5xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10"><div><h2 className="text-xl font-semibold">Notifications</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Operational alerts for this Logistics organization and hub.</p></div><ActionButton busy={loading} className="shrink-0" onClick={() => void load()}><FaArrowsRotate aria-hidden="true" /> Refresh</ActionButton></div>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" aria-label="Notification status" role="group"><label className="sr-only" htmlFor="notification-status">Filter notifications</label><select className={`${field} w-full sm:max-w-xs`} id="notification-status" onChange={(event) => setFilter(event.target.value as NotificationStatus)} value={status}><option value="all">All notifications</option><option value="unread">Unread</option><option value="read">Read</option></select><span className="text-xs text-zinc-500" aria-live="polite">{result ? `${total} notification${total === 1 ? '' : 's'}` : 'Loading notifications…'}</span></div>
    <section className={`${panel} mt-3`} aria-busy={loading} aria-live="polite">
      {loading && !result ? <p className="p-4 text-sm text-zinc-600 dark:text-zinc-400" role="status">Loading notifications…</p> : null}
      {error ? <div className="p-3"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
      {!loading && !error && result?.data.length === 0 ? <div className="grid min-h-40 place-items-center p-6 text-center"><div><FaCircleInfo className="mx-auto mb-3 text-2xl text-zinc-400" aria-hidden="true" /><p className="text-sm font-medium">{status === 'all' ? 'No notifications yet.' : `No ${status} notifications.`}</p><p className="mt-1 text-xs text-zinc-500">New pickup, Courier review, and fulfillment alerts will appear here.</p></div></div> : null}
      {result?.data.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{result.data.map((item) => <NotificationRow item={item} key={item.id} />)}</ul> : null}
    </section>
    {result?.data.length && lastPage > 1 ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><ActionButton disabled={page <= 1} onClick={() => movePage(page - 1)}><FaArrowLeft aria-hidden="true" /> Previous</ActionButton><span className="text-xs text-zinc-500">Page {page} of {lastPage}</span><ActionButton disabled={page >= lastPage} onClick={() => movePage(page + 1)}>Next <FaArrowRight aria-hidden="true" /></ActionButton></div> : null}
  </div>
}

function NotificationRow({ item }: { item: LogisticsNotification }) {
  const unread = !item.read_at
  return <li><Link className={`block border-l-4 p-3 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#4C1268] dark:hover:bg-white/[0.04] sm:p-4 ${unread ? 'border-l-[#E6007A] bg-[#fff1f7] dark:border-l-pink-300 dark:bg-[#2a1b26]' : 'border-l-transparent bg-white dark:bg-[#18181b]'}`} to={`/notifications/${item.id}`}><div className="flex items-start gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? 'bg-[#4C1268] dark:bg-pink-300' : 'bg-zinc-300 dark:bg-zinc-600'}`} /><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"><h3 className="break-words font-medium">{item.title}</h3>{unread ? <span className="shrink-0 text-xs font-medium text-[#4C1268] dark:text-pink-200">Unread</span> : <span className="shrink-0 text-xs text-zinc-500">Read</span>}</div><p className="mt-1 break-words text-sm leading-5 text-zinc-600 dark:text-zinc-400">{item.summary}</p><p className="mt-2 break-words text-xs capitalize text-zinc-500">{typeLabel(item.type)} · {formatDate(item.created_at)}</p></div><FaArrowRight className="mt-1 shrink-0 text-zinc-400" aria-hidden="true" /></div></Link></li>
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

  const destination = useMemo(() => item?.destination && item.destination.startsWith('/') && !item.destination.startsWith('//') ? item.destination : null, [item])

  if (loading) return <div className="w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8"><p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">Loading notification…</p></div>
  if (error || !item) return <div className="w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8"><Link className={`${link} inline-flex items-center`} to="/notifications"><FaArrowLeft className="mr-2" aria-hidden="true" />Back to notifications</Link><div className="mt-4"><ErrorNotice message={error || 'This notification is unavailable.'} retry={() => void load()} /></div></div>

  return <div className="w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8"><Link className={`${link} inline-flex items-center`} to="/notifications"><FaArrowLeft className="mr-2" aria-hidden="true" />Back to notifications</Link><article className={`${panel} mt-3 p-4 sm:p-5`}><div className="flex flex-col gap-2 border-b border-zinc-200 pb-3 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:gap-3"><div className="min-w-0"><p className="text-xs font-medium capitalize text-zinc-500">{typeLabel(item.type)}</p><h2 className="mt-1 break-words text-lg font-semibold sm:text-xl">{item.title}</h2></div>{item.read_at ? <span className="shrink-0 text-xs text-zinc-500">Read {formatDate(item.read_at)}</span> : <span className="shrink-0 text-xs font-medium text-[#4C1268] dark:text-pink-200">Unread</span>}</div><p className="mt-4 break-words text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.summary}</p><p className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-white/10">Received {formatDate(item.created_at)}</p>{destination ? <Link className={`${link} mt-4 inline-flex items-center gap-2`} to={destination}>Open related Logistics record <FaArrowRight aria-hidden="true" /></Link> : <p className="mt-4 text-sm text-zinc-500">The related record is no longer available. Review the current operations queue for authoritative state.</p>}{readError ? <div className="mt-4"><ErrorNotice message={readError} retry={() => void markRead()} /></div> : null}{!item.read_at ? <div className="mt-5"><PrimaryButton busy={busy} onClick={() => void markRead()}>Mark as read</PrimaryButton></div> : null}</article><p className="mt-3 text-xs text-zinc-500">Opening a notification does not change shipment, Courier, evidence, or pickup state.</p></div>
}
