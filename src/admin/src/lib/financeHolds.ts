import { apiRequest } from './api'
import type { FinanceHoldDetailResponse, FinanceHoldPageResponse, ReconcileFinanceHoldPayload } from '../types/financeHolds'

export function fetchFinanceHolds(status: 'open' | 'resolved', search: string, page: number, signal?: AbortSignal, period?: string) {
  const query = new URLSearchParams({ status, page: String(page) })
  if (search) query.set('search', search)
  if (period) new URLSearchParams(period).forEach((value, key) => query.set(key, value))
  return apiRequest<FinanceHoldPageResponse>(`/api/v1/admin/finance/holds?${query.toString()}`, { signal })
}

export function fetchFinanceHold(holdId: string, signal?: AbortSignal) {
  return apiRequest<FinanceHoldDetailResponse>(`/api/v1/admin/finance/holds/${holdId}`, { signal })
}

export function reconcileFinanceHold(holdId: string, payload: ReconcileFinanceHoldPayload) {
  return apiRequest(`/api/v1/admin/finance/holds/${holdId}/reconcile-logistics`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
