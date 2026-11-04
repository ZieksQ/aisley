import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NotificationCenter, isNotificationCategory, notificationCategoryOptions } from '@aisley/ui/notifications'
import { useAuth } from '../auth/useAuth'
import { listNotifications, markNotificationRead } from '../lib/notifications'
import type { SellerNotification, SellerNotificationResponse } from '../types/notifications'

type Status = 'all' | 'unread' | 'read'

export function NotificationsPage() {
  const { seller } = useAuth()
  return seller ? <SellerNotificationCenter key={seller.id} /> : null
}

function SellerNotificationCenter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const status: Status = statusParam === 'unread' || statusParam === 'read' ? statusParam : 'all'
  const rawCategory = searchParams.get('category')
  const category = rawCategory && isNotificationCategory(rawCategory, 'seller') ? rawCategory : 'all'
  const requestedPage = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [total, setTotal] = useState<number | undefined>(undefined)
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
    listNotifications(status, 20, page, category).then((response) => { if (active) { setItems(response.data); setTotal(response.meta.total); setLastPage(response.meta.last_page); setCategories(response.meta.categories); setLoadedKey(requestKey) } }).catch(() => { if (active) { setError('Notifications could not be loaded.'); setLoadedKey(requestKey) } }).finally(() => { if (active) setLoading(false) })
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

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <NotificationCenter headingLevel={2} role="seller" description="Order, inventory, compliance, and pickup updates for your Shop."
      items={responseIsCurrent ? items : []} total={responseIsCurrent ? total : undefined}
      loading={currentLoading} error={responseIsCurrent ? error : null} onRetry={() => setReload(value => value + 1)}
      status={status} category={category} categories={notificationCategoryOptions('seller', currentCategories)}
      onStatusChange={next => updateFilters(next, category)} onCategoryChange={next => updateFilters(status, next)}
      page={page} lastPage={responseIsCurrent ? lastPage : 1} onPageChange={changePage}
      renderAction={(notification, props) => <Link {...props} to={supportTicketDestination(notification) ?? `/notifications/${notification.id}`}
        onClick={() => openSupportNotification(notification)} />}
    />
  </div>
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}
