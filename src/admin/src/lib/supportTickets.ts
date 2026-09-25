import type { SupportTicket, TicketDetail, TicketList, TicketMutation, TicketStatus } from '@aisley/support-tickets'
import { apiRequest, initializeCsrf } from './api'

const base = '/api/v1/admin/support-tickets'

export type SupportAssignee = { id: string; name: string }
export type SupportTicketFilters = { status?: TicketStatus; category?: string; assignee?: 'all' | 'mine' | 'unassigned'; cursor?: string }

async function post<T>(path: string, body: object, key?: string): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 15000)
  try {
    await initializeCsrf()
    return await apiRequest<T>(path, {
      method: 'POST',
      signal: controller.signal,
      headers: key ? { 'Idempotency-Key': key } : undefined,
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The result was not confirmed. Retry the same action safely.')
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export function listSupportTickets(filters: SupportTicketFilters = {}) {
  const search = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value && value !== 'all') search.set(key, value) })
  return apiRequest<TicketList>(`${base}${search.size ? `?${search}` : ''}`)
}

export function getSupportTicket(id: string, cursor?: string) {
  return apiRequest<TicketDetail>(`${base}/${id}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
}

export function listSupportAssignees() {
  return apiRequest<{ items: SupportAssignee[] }>(`${base}/assignees`)
}

export function claimSupportTicket(id: string, revision: number, key: string) {
  return post<TicketMutation>(`${base}/${id}/claim`, { expected_revision: revision }, key)
}

export function assignSupportTicket(id: string, assigneeId: string | null, revision: number, key: string) {
  return post<TicketMutation>(`${base}/${id}/assign`, { assignee_id: assigneeId, expected_revision: revision }, key)
}

export function changeSupportTicketStatus(id: string, status: TicketStatus, reason: string, revision: number, key: string) {
  return post<TicketMutation>(`${base}/${id}/status`, { status, reason, expected_revision: revision }, key)
}

export function replyToSupportTicket(id: string, body: string, revision: number, key: string) {
  return post<TicketMutation>(`${base}/${id}/replies`, { body, expected_revision: revision }, key)
}

export function markSupportTicketRead(id: string, sequence: number) {
  return post<{ data: SupportTicket }>(`${base}/${id}/read`, { last_read_sequence: sequence })
}
