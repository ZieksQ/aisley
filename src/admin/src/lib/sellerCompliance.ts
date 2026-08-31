import { apiRequest } from './api'
import type { ComplianceActionName, ComplianceCaseListResponse, ComplianceCaseResponse, ComplianceOptionsResponse } from '../types/sellerCompliance'

export function fetchComplianceCases(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<ComplianceCaseListResponse>(`/api/v1/admin/seller-compliance/cases?${query}`, { signal })
}

export function fetchComplianceOptions(params = new URLSearchParams(), signal?: AbortSignal) {
  const query = params.toString()
  return apiRequest<ComplianceOptionsResponse>(`/api/v1/admin/seller-compliance/options${query ? `?${query}` : ''}`, { signal })
}

export function fetchComplianceCase(id: string, signal?: AbortSignal) {
  return apiRequest<ComplianceCaseResponse>(`/api/v1/admin/seller-compliance/cases/${id}`, { signal })
}

export function createComplianceCase(payload: { seller_id: string; product_id: string | null; policy_version_id: string | null; reason: string }) {
  return apiRequest<ComplianceCaseResponse>('/api/v1/admin/seller-compliance/cases', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function applyComplianceAction(id: string, action: ComplianceActionName, payload: { expected_revision: number; idempotency_key: string; reason: string; confirmation?: string }) {
  return apiRequest<ComplianceCaseResponse>(`/api/v1/admin/seller-compliance/cases/${id}/${action}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function complianceStatusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatComplianceDate(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
