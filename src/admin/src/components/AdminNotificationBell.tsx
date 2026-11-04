import { useCallback, useEffect, useRef, useState } from 'react'
import { NotificationPopover } from '@aisley/ui/notifications'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import {
  announceNotificationsUpdated, fetchNotifications, fetchUnreadCount,
  markNotificationRead, notificationsUpdatedEvent,
} from '../lib/notifications'
import type { AdminNotification } from '../types/notifications'

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

function safeInternalDestination(value: string | null): string | null {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null
}

export function AdminNotificationBell() {
  const { admin } = useAuth()
  return admin ? <AdminNotificationPreview key={admin.id} /> : null
}

function AdminNotificationPreview() {
  const navigate = useNavigate()
  const revision = useRef(0)
  const blocked = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (blocked.current || document.visibilityState !== 'visible') return
    const current = ++revision.current
    setIsLoading(true)
    try {
      const [count, list] = await Promise.all([
        fetchUnreadCount(), fetchNotifications(new URLSearchParams({ page: '1', per_page: '5' })),
      ])
      if (current !== revision.current) return
      setUnreadCount(count.unread_count)
      setNotifications(list.data)
      setError(null)
    } catch (requestError) {
      if (current !== revision.current) return
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        blocked.current = true
        setUnreadCount(null)
        setNotifications([])
      }
      setError('Notifications could not be refreshed.')
    } finally {
      if (current === revision.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    blocked.current = false
    void refresh()
    const refetch = () => void refresh()
    const poll = window.setInterval(refetch, 30_000)
    window.addEventListener('online', refetch)
    window.addEventListener('focus', refetch)
    window.addEventListener(notificationsUpdatedEvent, refetch)
    document.addEventListener('visibilitychange', refetch)
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- This numeric generation invalidates pending requests, not a DOM ref.
      ++revision.current
      window.clearInterval(poll)
      window.removeEventListener('online', refetch)
      window.removeEventListener('focus', refetch)
      window.removeEventListener(notificationsUpdatedEvent, refetch)
      document.removeEventListener('visibilitychange', refetch)
    }
  }, [refresh])

  async function openNotification(notification: AdminNotification, close?: () => void) {
    if (pendingId) return
    setPendingId(notification.id)
    try {
      if (!notification.read_at) await markNotificationRead(notification.id)
      announceNotificationsUpdated()
      close?.()
      const destination = notification.resource_type === 'support_ticket' && isUuid(notification.resource_id)
        ? `/support-tickets/${notification.resource_id}` : safeInternalDestination(notification.destination)
      navigate(destination ?? '/notifications')
    } catch {
      setError('This notification could not be marked as read.')
    } finally {
      setPendingId(null)
    }
  }

  return <NotificationPopover role="admin" items={notifications} unreadCount={unreadCount} loading={isLoading}
    error={error} pendingId={pendingId} onRefresh={() => void refresh()}
    renderAction={(notification, props) => <button {...props} type="button" disabled={pendingId !== null}
      onClick={() => void openNotification(notification, props.onClick)} />}
    renderViewAll={props => <Link {...props} to="/notifications" />}
  />
}
