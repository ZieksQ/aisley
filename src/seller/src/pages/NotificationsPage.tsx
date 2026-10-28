import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NotificationCategoryLabel, NotificationFilters, isNotificationCategory, notificationCategoryOptions } from '@aisley/ui/notifications'
import { listNotifications, markNotificationRead, relativeNotificationTime } from '../lib/notifications'
import type { SellerNotification, SellerNotificationResponse } from '../types/notifications'

type Status = 'all' | 'unread' | 'read'

export function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const status: Status = statusParam === 'unread' || statusParam === 'read' ? statusParam : 'all'
  const rawCategory = searchParams.get('category')
  const category = rawCategory && isNotificationCategory(rawCategory, 'seller') ? rawCategory : 'all'
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [lastPage, setLastPage] = useState(1)
  const [categories, setCategories] = useState<SellerNotificationResponse['meta']['categories']>(undefined)
  const [items, setItems] = useState<SellerNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const requestKey = `${status}:${category}:${page}:${reload}`

  useEffect(() => {
    let active = true
    document.title = 'Notifications | Aisley Seller'
    setLoading(true); setError('')
    listNotifications(status, 20, page, category).then((response) => { if (active) { setItems(response.data); setLastPage(response.meta.last_page); setCategories(response.meta.categories); setLoadedKey(requestKey) } }).catch(() => { if (active) { setError('Notifications could not be loaded.'); setLoadedKey(requestKey) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [category, page, reload, requestKey, status])

  function updateFilters(nextStatus: Status, nextCategory: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (nextStatus === 'all') next.delete('status')
      else next.set('status', nextStatus)
      if (nextCategory === 'all') next.delete('category')
      else next.set('category', nextCategory)
      next.delete('page')
      return next
    })
  }

  function changePage(nextPage: number) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (nextPage <= 1) next.delete('page')
      else next.set('page', String(nextPage))
      return next
    })
  }

  function supportTicketDestination(notification: SellerNotification): string | null {
    const resourceId = notification.resource_id ?? null
    if (notification.resource_type !== 'support_ticket' || !isUuid(resourceId)) return null
    return `/support-tickets?ticket=${encodeURIComponent(resourceId)}`
  }

  function openSupportNotification(notification: SellerNotification) {
    if (notification.read_at || !supportTicketDestination(notification)) return
    void markNotificationRead(notification.id).then(() => window.dispatchEvent(new Event('seller-notifications-updated'))).catch(() => undefined)
  }

  const responseIsCurrent = loadedKey === requestKey
  const currentLoading = loading || !responseIsCurrent
  const currentCategories = responseIsCurrent ? categories : undefined

  return <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="border-b border-zinc-200 pb-4 dark:border-white/10"><div><h2 className="text-xl font-semibold">Notifications</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Order, inventory, compliance, and pickup updates for your Shop.</p></div><div className="mt-4"><NotificationFilters category={category} categories={notificationCategoryOptions('seller', currentCategories)} onCategoryChange={(nextCategory) => updateFilters(status, nextCategory)} onStatusChange={(nextStatus) => updateFilters(nextStatus, category)} role="seller" status={status} /></div></div>
    {currentLoading ? <p className="py-12 text-center text-sm text-zinc-600 dark:text-zinc-400" role="status">Loading notifications…</p> : null}
    {error ? <div className="mt-4 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}<button className="ml-2 inline-flex min-h-11 min-w-11 items-center justify-center align-middle font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-focus)]" onClick={() => setReload((value) => value + 1)} type="button">Try again</button></div> : null}
    {!currentLoading && !error && responseIsCurrent && items.length === 0 ? <p className="mt-4 border border-dashed border-zinc-300 bg-white px-5 py-12 text-center text-sm text-zinc-600 dark:border-white/15 dark:bg-[#18181b] dark:text-zinc-400">No {status === 'all' ? '' : `${status} `}notifications{category === 'all' ? ' yet.' : ` in ${notificationCategoryOptions('seller', currentCategories).find((item) => item.key === category)?.label ?? 'Other'} yet.`}</p> : null}
    {!currentLoading && !error && responseIsCurrent && items.length ? <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">{items.map((notification) => <Link className={`block border-b border-zinc-200 px-4 py-4 last:border-0 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.04] ${notification.read_at ? '' : 'border-l-4 border-l-[#4C1268] pl-3'}`} key={notification.id} onClick={() => openSupportNotification(notification)} to={supportTicketDestination(notification) ?? `/notifications/${notification.id}`}><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">{notification.title}</h3><p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{notification.summary}</p><div className="mt-2"><NotificationCategoryLabel category={notification.category} categoryLabel={notification.category_label} role="seller" /></div></div><time className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">{relativeNotificationTime(notification.created_at)}</time></div></Link>)}</div> : null}
    {!currentLoading && !error && responseIsCurrent && lastPage > 1 ? <nav aria-label="Notification pages" className="mt-4 flex items-center justify-between"><button className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-white/15" disabled={page <= 1} onClick={() => changePage(page - 1)} type="button">Previous</button><span className="text-sm text-zinc-600 dark:text-zinc-400">Page {page} of {lastPage}</span><button className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-white/15" disabled={page >= lastPage} onClick={() => changePage(page + 1)} type="button">Next</button></nav> : null}
  </div>
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}
