import { apiRequest, initializeCsrf } from './api'
import type { SellerNotification, SellerNotificationResponse } from '../types/notifications'

export function listNotifications(status: 'all' | 'unread' | 'read', perPage = 20, page = 1) {
  return apiRequest<SellerNotificationResponse>(`/api/v1/seller/notifications?status=${status}&per_page=${perPage}&page=${page}`)
}

export function getNotification(id: string) {
  return apiRequest<{ data: SellerNotification }>(`/api/v1/seller/notifications/${encodeURIComponent(id)}`)
}

export async function markNotificationRead(id: string) {
  await initializeCsrf()
  return apiRequest<{ data: SellerNotification }>(`/api/v1/seller/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })
}

export function relativeNotificationTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days}d ago` : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value))
}
