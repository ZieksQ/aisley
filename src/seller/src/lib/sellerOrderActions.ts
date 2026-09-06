import { apiRequest, initializeCsrf } from './api'
import type { SellerOrder } from '../types/orders'

export function createOrderAcceptance(sellerId: string, orderId: string) {
  const storageKey = `seller-accept:${sellerId}:${orderId}`
  let key: string | null = null
  return async () => {
    // Preserve the key after uncertain failures, including a page reload.
    if (!key) {
      try { key = sessionStorage.getItem(storageKey) } catch { /* Storage may be disabled. */ }
      key ??= crypto.randomUUID()
      try { sessionStorage.setItem(storageKey, key) } catch { /* In-memory retries still work. */ }
    }
    await initializeCsrf()
    const result = await apiRequest<{ data: SellerOrder }>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}/accept`, {
      method: 'POST', headers: { 'Idempotency-Key': key },
    })
    try { sessionStorage.removeItem(storageKey) } catch { /* No order data is stored here. */ }
    return result
  }
}

export async function markOrderNotificationRead(notificationId: string, signal?: AbortSignal) {
  await initializeCsrf()
  return apiRequest(`/api/v1/seller/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST', signal })
}
