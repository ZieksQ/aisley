import { apiRequest, apiWriteWithCsrfTimeout } from './api'

const base = '/api/v1/seller/logistics-conversations'

export type LogisticsThread = {
  id: string
  kind: 'seller_logistics'
  pickup_request_id: string
  pickup_request_reference: string | null
  counterparty_role: 'logistics'
  counterparty_label: string
  last_message_preview: string | null
  last_message_at: string | null
  last_sequence: number
  last_read_sequence: number
  unread_count: number
  send_allowed: boolean
  read_only_reason: string | null
}

export type LogisticsMessage = {
  id: string
  conversation_id: string
  sequence: number
  sender_role: 'seller' | 'logistics'
  mine: boolean
  body: string
  created_at: string
}

type Page<T> = { data: T[]; meta: { next_cursor: string | null; unread_count?: number } }
type WriteResponse = { conversation: LogisticsThread; message: LogisticsMessage }

export const logisticsMessages = {
  list: (cursor?: string) => apiRequest<Page<LogisticsThread>>(`${base}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  show: (id: string) => apiRequest<{ data: LogisticsThread }>(`${base}/${id}`),
  history: (id: string, cursor?: string) => apiRequest<Page<LogisticsMessage>>(`${base}/${id}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  start: (pickupId: string, body: string, key: string) => apiWriteWithCsrfTimeout<WriteResponse>(base, {
    method: 'POST', headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ context_type: 'pickup_request', context_id: pickupId, body }),
  }),
  send: (id: string, body: string, key: string) => apiWriteWithCsrfTimeout<WriteResponse>(`${base}/${id}/messages`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ body }),
  }),
  read: (id: string, sequence: number) => apiRequest<{ data: LogisticsThread }>(`${base}/${id}/read`, {
    method: 'POST', body: JSON.stringify({ last_read_sequence: sequence }),
  }),
}
