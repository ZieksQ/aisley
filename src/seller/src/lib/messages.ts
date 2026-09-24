import { apiRequest, apiWriteWithCsrfTimeout, initializeCsrf } from './api'

export type Conversation = {
  id: string
  shop: { id: string; name: string; slug: string | null }
  customer_name: string | null
  last_message_preview: string | null
  last_message_at: string | null
  last_sequence: number
  last_read_sequence: number
  unread_count: number
  send_allowed: boolean
}

export type Message = {
  id: string
  sequence: number
  body: string
  mine: boolean
  sender_role: 'customer' | 'seller'
  context: { type: 'product' | 'order'; id: string | null; label: string; url: string | null } | null
  created_at: string
}

const base = '/api/v1/seller/conversations'

export const listConversations = (cursor?: string) => apiRequest<{ items: Conversation[]; next_cursor: string | null; unread_count: number }>(`${base}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
export const getConversation = (id: string) => apiRequest<{ data: Conversation }>(`${base}/${id}`)
export const listMessages = (id: string, cursor?: string) => apiRequest<{ items: Message[]; next_cursor: string | null }>(`${base}/${id}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)

export async function sendMessage(id: string, body: string, key: string) {
  return apiWriteWithCsrfTimeout<{ conversation: Conversation; message: Message }>(`${base}/${id}/messages`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ body }),
  })
}

export async function markRead(id: string, sequence: number) {
  await initializeCsrf()
  return apiRequest<{ data: Conversation }>(`${base}/${id}/read`, { method: 'POST', body: JSON.stringify({ sequence }) })
}
