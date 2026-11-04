import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotificationPopover } from '@aisley/ui/notifications'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'
import { listNotifications, markNotificationRead } from '../../lib/notifications'
import type { SellerNotification } from '../../types/notifications'

const previewLimit = 5

function supportTicketDestination(notification: SellerNotification): string | null {
  if (notification.resource_type !== 'support_ticket' || !isUuid(notification.resource_id ?? null)) return null
  return `/support-tickets?ticket=${encodeURIComponent(notification.resource_id as string)}`
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

export function NotificationBell() {
  const { seller } = useAuth()
  return seller ? <SellerNotificationPreview key={seller.id} /> : null
}

function SellerNotificationPreview() {
  const revision = useRef(0)
  const blocked = useRef(false)
  const [notifications, setNotifications] = useState<SellerNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (blocked.current || document.visibilityState !== 'visible') return
    const current = ++revision.current
    setLoading(true)
    try {
      const unread = await listNotifications('unread', previewLimit)
      const unreadItems = unread.data.slice(0, previewLimit)
      const read = unreadItems.length < previewLimit ? await listNotifications('read', previewLimit - unreadItems.length) : null
      if (current !== revision.current) return
      setUnreadCount(unread.meta.total)
      setNotifications([...unreadItems, ...(read?.data ?? [])].slice(0, previewLimit))
      setError('')
    } catch (caught) {
      if (current !== revision.current) return
      if (caught instanceof ApiError && [401, 403].includes(caught.status)) {
        blocked.current = true
        setUnreadCount(null)
        setNotifications([])
      }
      setError('Notifications could not be loaded.')
    } finally {
      if (current === revision.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    blocked.current = false
    void load()
    const refresh = () => void load()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('seller-notifications-updated', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- This numeric generation invalidates pending requests, not a DOM ref.
      ++revision.current
      window.clearInterval(timer)
      window.removeEventListener('seller-notifications-updated', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load])

  return <NotificationPopover role="seller" items={notifications} unreadCount={unreadCount} loading={loading}
    error={error} onRefresh={() => void load()}
    renderAction={(notification, props) => <Link {...props} to={supportTicketDestination(notification) ?? `/notifications/${notification.id}`}
      onClick={() => {
        props.onClick?.()
        if (supportTicketDestination(notification) && !notification.read_at) void markNotificationRead(notification.id)
          .then(() => window.dispatchEvent(new Event('seller-notifications-updated'))).catch(() => undefined)
      }} />}
    renderViewAll={props => <Link {...props} to="/notifications" />}
  />
}
