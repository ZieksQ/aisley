import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NotificationPopover } from '@aisley/ui/notifications'
import { useAuth } from '../auth/useAuth'
import { ApiError, csrf, request, requestWithTimeout } from '../lib/api'
import type { LogisticsNotification, NotificationPage, NotificationResponse, UnreadCountResponse } from '../types/notifications'

function errorMessage(caught: unknown): string {
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  if (caught instanceof ApiError && caught.status === 408) return 'Notifications took too long to load.'
  return caught instanceof ApiError ? caught.message : 'Notifications are temporarily unavailable.'
}

function supportTicketDestination(item: LogisticsNotification): string | null {
  if (item.resource_type !== 'support_ticket' || !isUuid(item.resource_id)) return null
  return `/support-tickets?ticket=${encodeURIComponent(item.resource_id)}`
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

function markNotificationRead(id: string) {
  void csrf()
    .then(() => request<NotificationResponse>(`/api/v1/logistics/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: JSON.stringify({}) }))
    .then(() => window.dispatchEvent(new Event('aisley:logistics-notifications-changed')))
    .catch(() => undefined)
}

export function NotificationBell() {
  const { logistics } = useAuth()
  return logistics ? <LogisticsNotificationPreview key={logistics.id} /> : null
}

function LogisticsNotificationPreview() {
  const revision = useRef(0)
  const [count, setCount] = useState<number | null>(null)
  const [recent, setRecent] = useState<NotificationPage['data'] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [authorizationLost, setAuthorizationLost] = useState(false)

  const load = useCallback(async () => {
    if (authorizationLost || document.visibilityState !== 'visible') return
    const current = ++revision.current
    setLoading(true)
    setError('')
    const [countResult, listResult] = await Promise.allSettled([
      requestWithTimeout<UnreadCountResponse>('/api/v1/logistics/notifications/unread-count'),
      requestWithTimeout<NotificationPage>('/api/v1/logistics/notifications?status=all&per_page=5&page=1'),
    ])
    if (current !== revision.current) return
    let failed = false
    if (countResult.status === 'fulfilled') {
      const value = Number(countResult.value.data?.unread_count)
      if (Number.isFinite(value) && value >= 0) setCount(value)
      else failed = true
    } else failed = true
    if (listResult.status === 'fulfilled') setRecent(listResult.value.data ?? [])
    else failed = true
    const reason = countResult.status === 'rejected' ? countResult.reason : listResult.status === 'rejected' ? listResult.reason : null
    if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
      setAuthorizationLost(true)
      setCount(null)
      setRecent(null)
    }
    if (failed) setError(errorMessage(reason))
    setLoading(false)
  }, [authorizationLost])

  useEffect(() => {
    void load()
    const onFocus = () => void load()
    const onChanged = () => void load()
    const onVisibility = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', onFocus)
    window.addEventListener('aisley:logistics-notifications-changed', onChanged)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(() => void load(), 30000)
    return () => {
      ++revision.current
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('aisley:logistics-notifications-changed', onChanged)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(timer)
    }
  }, [load])

  return <NotificationPopover role="logistics" items={recent ?? []} unreadCount={count} loading={loading}
    error={error} onRefresh={() => void load()}
    renderAction={(item, props) => <Link {...props} to={supportTicketDestination(item) ?? `/notifications/${item.id}`}
      onClick={() => { props.onClick?.(); if (supportTicketDestination(item) && !item.read_at) markNotificationRead(item.id) }} />}
    renderViewAll={props => <Link {...props} to="/notifications" />}
  />
}
