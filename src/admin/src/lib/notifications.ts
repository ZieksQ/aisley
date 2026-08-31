import { apiRequest } from './api'
import type {
  MarkNotificationReadResponse,
  NotificationListResponse,
  UnreadCountResponse,
} from '../types/notifications'

export const notificationsUpdatedEvent = 'aisley:admin-notifications-updated'

export function fetchUnreadCount(signal?: AbortSignal) {
  return apiRequest<UnreadCountResponse>('/api/v1/admin/notifications/unread-count', { signal })
}

export function fetchNotifications(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<NotificationListResponse>(`/api/v1/admin/notifications?${query}`, { signal })
}

export function markNotificationRead(id: string) {
  return apiRequest<MarkNotificationReadResponse>(`/api/v1/admin/notifications/${id}/read`, {
    method: 'POST',
  })
}

export function markAllNotificationsRead() {
  return apiRequest<{ message: string; updated_count: number }>('/api/v1/admin/notifications/read-all', {
    method: 'POST',
  })
}

export function announceNotificationsUpdated() {
  window.dispatchEvent(new Event(notificationsUpdatedEvent))
}

export function formatNotificationTime(value: string | null) {
  if (!value) return 'Unknown time'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
