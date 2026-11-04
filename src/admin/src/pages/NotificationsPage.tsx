import { useEffect, useState } from 'react'
import { FaCheckDouble } from 'react-icons/fa6'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { NotificationCenter, isNotificationCategory, notificationCategoryOptions } from '@aisley/ui/notifications'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import {
  announceNotificationsUpdated,
  fetchNotifications,
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
  const { admin } = useAuth()
  return admin ? <AdminNotificationCenter key={admin.id} /> : null
}

function AdminNotificationCenter() {
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
        if (controller.signal.aborted) return
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
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <NotificationCenter headingLevel={2} role="admin" description="Review platform events and work that needs your attention."
        items={responseIsCurrent ? response?.data ?? [] : []} total={responseIsCurrent ? response?.meta.total : undefined}
        loading={currentLoading} pendingId={pendingId}
        error={error ? error.status === 403 ? 'Your administrator account does not have permission to view notifications.' : error.message : null}
        onRetry={() => setReloadKey(value => value + 1)}
        status={status} category={category} categories={notificationCategoryOptions('admin', currentCategories)}
        onStatusChange={next => updateFilters(next, category)} onCategoryChange={next => updateFilters(status, next)}
        page={page} lastPage={responseIsCurrent ? response?.meta.last_page ?? 1 : 1} onPageChange={setPage}
        actions={<button className="notification-button" disabled={isMarkingAll || currentLoading || !responseIsCurrent || !response?.data.some(item => !item.read_at)} onClick={() => void markAllRead()} type="button">
          <FaCheckDouble aria-hidden="true" />{isMarkingAll ? 'Updating…' : 'Mark all read'}
        </button>}
        renderAction={(notification, props) => <button {...props} type="button" disabled={pendingId !== null || isMarkingAll}
          onClick={() => void openNotification(notification)} />}
      />
    </div>
  )
}
