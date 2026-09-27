import { apiRequest } from './api'
import type {
  CommissionPolicy,
  CommissionPolicyPayload,
  ShippingRatePayload,
  ShippingRateVersion,
} from '../types/pricingSettings'

type DataResponse<T> = { data: T }

export function fetchShippingRates(signal?: AbortSignal) {
  return apiRequest<DataResponse<ShippingRateVersion[]>>('/api/v1/admin/shipping-rates', { signal })
}

export function createShippingRate(payload: ShippingRatePayload) {
  return apiRequest<DataResponse<ShippingRateVersion>>('/api/v1/admin/shipping-rates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function publishShippingRate(rateId: string) {
  return apiRequest<DataResponse<ShippingRateVersion>>(`/api/v1/admin/shipping-rates/${rateId}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function fetchCommissionPolicies(signal?: AbortSignal) {
  return apiRequest<DataResponse<CommissionPolicy[]>>('/api/v1/admin/commission-policies', { signal })
}

export function createCommissionPolicy(payload: CommissionPolicyPayload) {
  return apiRequest<DataResponse<CommissionPolicy>>('/api/v1/admin/commission-policies', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function publishCommissionPolicy(policyId: string) {
  return apiRequest<DataResponse<CommissionPolicy>>(`/api/v1/admin/commission-policies/${policyId}/publish`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
