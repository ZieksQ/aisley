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

export function createPickupRequest(sellerId: string, orderIds: string[], logisticsOrganizationId: string, pickupAddressIds: Record<string, string>) {
  const identity = [...orderIds].sort().join(':')
  const addressesIdentity = Object.entries(pickupAddressIds).sort(([left], [right]) => left.localeCompare(right)).map(([orderId, addressId]) => `${orderId}:${addressId}`).join(':')
  return createIdempotentAction<{ data: { id: string; status: string; pickup_date: string | null; logistics_organization_id: string; order_ids: string[]; waybills: Array<{ id: string; order_id: string; reference: string; created_at: string; printable: boolean }> } }>(`seller-pickup:${sellerId}:${identity}:${logisticsOrganizationId}:${addressesIdentity}`, '/api/v1/seller/orders/pickup-requests', { order_ids: orderIds, logistics_organization_id: logisticsOrganizationId, pickup_address_ids: pickupAddressIds })
}

export async function markOrderNotificationRead(notificationId: string, signal?: AbortSignal) {
  await initializeCsrf()
  return apiRequest(`/api/v1/seller/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST', signal })
}
