import { apiRequest, initializeCsrf } from './api'
import type { SellerOrder } from '../types/orders'

function createIdempotentAction<T>(storageKey: string, path: string, body?: unknown) {
  let key: string | null = null
  return async () => {
    // Preserve the key after uncertain failures, including a page reload.
    if (!key) {
      try { key = sessionStorage.getItem(storageKey) } catch { /* Storage may be disabled. */ }
      key ??= crypto.randomUUID()
      try { sessionStorage.setItem(storageKey, key) } catch { /* In-memory retries still work. */ }
    }
    await initializeCsrf()
    const result = await apiRequest<T>(path, {
      method: 'POST', headers: { 'Idempotency-Key': key }, body: body === undefined ? undefined : JSON.stringify(body),
    })
    try { sessionStorage.removeItem(storageKey) } catch { /* No order data is stored here. */ }
    return result
  }
}

export function createOrderApproval(sellerId: string, orderId: string) {
  return createIdempotentAction<{ data: SellerOrder }>(`seller-approve:${sellerId}:${orderId}`, `/api/v1/seller/orders/${encodeURIComponent(orderId)}/approve`)
}

export function createOrderRejection(sellerId: string, orderId: string, reason?: string) {
  return createIdempotentAction<{ data: SellerOrder }>(`seller-reject:${sellerId}:${orderId}`, `/api/v1/seller/orders/${encodeURIComponent(orderId)}/reject`, reason ? { reason } : {})
}

export function createPickupRequest(sellerId: string, orderIds: string[]) {
  const identity = [...orderIds].sort().join(':')
  return createIdempotentAction<{ data: { id: string; status: string; pickup_date: string | null; logistics_organization_id: string | null; order_ids: string[] } }>(`seller-pickup:${sellerId}:${identity}`, '/api/v1/seller/orders/pickup-requests', { order_ids: orderIds })
}

export async function markOrderNotificationRead(notificationId: string, signal?: AbortSignal) {
  await initializeCsrf()
  return apiRequest(`/api/v1/seller/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST', signal })
}
