import { blob, csrf, request } from '../../lib/api'

export type ReviewView = 'pending' | 'history' | 'settings'
export type Confirmation = {
  task_id: string
  task_revision: number
  shipment_revision: number
  shipment_reference: string
  order: { reference: string; payment_method: string; payment_status: string }
  destination: { recipient_name: string; address: string } | null
  proof: { id: string; status: string; submitted_at: string | null }
  courier: { id: string; name: string }
  cod: { collected: boolean; declared_amount: string; currency: string; declared_at: string | null } | null
  intent: { id: string; approval_mode: string; automatic_review_error: string | null } | null
  review: { method: string | null; reviewer: string | null; reviewed_at: string | null; reason: string | null }
}
export type ReviewAttempt = { kind: 'approve' | 'correct'; proofId: string; reference: string; key: string; body: Record<string, unknown> }
export type ReviewPage = { data: Confirmation[]; meta: { last_page: number; total: number } }

export function loadReviews(view: 'pending' | 'history', search: string, page: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ view, page: String(page), per_page: '20' })
  if (search) params.set('search', search)
  return request<ReviewPage>(`/api/v1/logistics/delivery-confirmations?${params}`, { signal })
}
export function loadPhoto(id: string) {
  return blob(`/api/v1/logistics/delivery-proofs/${id}/photo`)
}
export async function submitReview(attempt: ReviewAttempt) {
  await csrf()
  return request(attempt.kind === 'approve' ? '/api/v1/logistics/update-status/transitions' : `/api/v1/logistics/delivery-proofs/${attempt.proofId}/reject`, {
    method: 'POST', headers: { 'Idempotency-Key': attempt.key }, body: JSON.stringify(attempt.body),
  })
}
export function loadApprovalSettings(signal?: AbortSignal) {
  return request<{ data: { mode: 'manual' | 'automatic' } }>('/api/v1/logistics/delivery-approval-settings', { signal })
}
export async function saveApprovalSettings(mode: 'manual' | 'automatic') {
  await csrf()
  return request('/api/v1/logistics/delivery-approval-settings', { method: 'PATCH', body: JSON.stringify({ mode }) })
}
