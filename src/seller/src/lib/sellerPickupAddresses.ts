import { apiRequest } from './api'
import type { PickupAddress, PickupAddressPayload } from '../types/pickupAddresses'

export async function getPickupAddresses(signal?: AbortSignal) {
  return apiRequest<{ data: PickupAddress[] }>('/api/v1/seller/pickup-addresses', { signal })
}

export async function createPickupAddress(payload: PickupAddressPayload) {
  return apiRequest<{ data: PickupAddress }>('/api/v1/seller/pickup-addresses', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updatePickupAddress(id: string, payload: PickupAddressPayload) {
  return apiRequest<{ data: PickupAddress }>(`/api/v1/seller/pickup-addresses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function deletePickupAddress(id: string) {
  return apiRequest<void>(`/api/v1/seller/pickup-addresses/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function pickupAddressSummary(address: PickupAddress) {
  return [address.address_line_1, address.address_line_2, address.barangay, address.city_municipality, address.province, address.region, address.postal_code, address.country].filter(Boolean).join(', ')
}
