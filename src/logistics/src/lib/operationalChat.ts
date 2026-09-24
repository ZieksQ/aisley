import { csrf, requestWithTimeout } from './api'

const base = '/api/v1/logistics/operational-conversations'

export type CourierThread = {
  id: string
  kind: 'logistics_courier'
  leg: 'first_mile' | 'final_mile'
  task_id: string
  task_reference: string | null
  counterparty_role: 'courier'
  counterparty_label: string
  last_message_preview: string | null
  last_message_at: string | null
  last_sequence: number
  last_read_sequence: number
  unread_count: number
  send_allowed: boolean
  read_only_reason: string | null
}

export type CustomerThread = Omit<CourierThread, 'kind' | 'leg' | 'task_id' | 'task_reference' | 'counterparty_role'> & {
  kind: 'customer_logistics'
  order_id: string
  order_reference: string | null
  counterparty_role: 'customer'
}

export type OperationalThread = CourierThread | CustomerThread

export type OperationalMessage = {
  id: string
  conversation_id: string
  sequence: number
  sender_role: 'courier' | 'customer' | 'logistics'
  mine: boolean
  body: string
  created_at: string
}

type Page<T> = { data: T[]; meta: { next_cursor: string | null; unread_count?: number } }
type ThreadResponse = { data: OperationalThread }
type WriteResponse = { conversation: OperationalThread; message: OperationalMessage }

export const operationalChat = {
  list: (cursor?: string) => requestWithTimeout<Page<OperationalThread>>(`${base}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  show: (id: string) => requestWithTimeout<ThreadResponse>(`${base}/${id}`),
  history: (id: string, cursor?: string) => requestWithTimeout<Page<OperationalMessage>>(`${base}/${id}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  async start(leg: 'first_mile' | 'final_mile', taskId: string, body: string, key: string) {
    await csrf()
    return requestWithTimeout<WriteResponse>(base, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ leg, task_id: taskId, body }) })
  },
  async startOrder(orderId: string, body: string, key: string) {
    await csrf()
    return requestWithTimeout<WriteResponse>(base, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ context_type: 'order', context_id: orderId, body }) })
  },
  async send(id: string, body: string, key: string) {
    await csrf()
    return requestWithTimeout<WriteResponse>(`${base}/${id}/messages`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ body }) })
  },
  async read(id: string, lastReadSequence: number) {
    await csrf()
    return requestWithTimeout<ThreadResponse>(`${base}/${id}/read`, { method: 'POST', body: JSON.stringify({ last_read_sequence: lastReadSequence }) })
  },
}
