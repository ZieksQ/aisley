import { acknowledgeChatRead } from "@aisley/chat-ui";
import type { ChatAttachment } from "@aisley/chat-ui";
import { apiRequest, apiWriteWithCsrfTimeout } from "@/lib/api"

export type CourierConversation = {
  id: string
  order_id: string
  order_reference: string
  task_reference: string | null
  last_message_preview: string | null
  last_sequence: number
  last_read_sequence: number
  unread_count: number
  send_allowed: boolean
  read_only_reason: string | null
}

export type CourierMessage = {
  id: string
  sequence: number
  body: string
  attachments?: ChatAttachment[];
  mine: boolean
  created_at: string
}

export type CourierOrderContext = {
  order_id: string
  order_reference: string
  send_allowed: boolean
  conversation_id: string | null
}

export type CourierPage<T> = { data: T[]; meta: { next_cursor: string | null; unread_count?: number } }
export type CourierSendResult = { conversation: CourierConversation; message: CourierMessage }
const root = '/api/v1/customer/courier-conversations'

// Reads have a deadline too; stalled requests must not stop polling indefinitely.
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const deadline = AbortSignal.timeout(15000)
  return apiRequest<T>(path, { cache: 'no-store', signal: signal ? AbortSignal.any([signal, deadline]) : deadline })
}

function cursorQuery(cursor?: string | null) {
  return cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
}

export const courierMessages = {
  inbox: (cursor?: string | null, signal?: AbortSignal) => read<CourierPage<CourierConversation>>(`${root}${cursorQuery(cursor)}`, signal),
  context: (order: string, signal?: AbortSignal) => read<{ data: CourierOrderContext }>(`${root}/order-context/${encodeURIComponent(order)}`, signal),
  detail: (id: string, signal?: AbortSignal) => read<{ data: CourierConversation }>(`${root}/${encodeURIComponent(id)}`, signal),
  history: (id: string, cursor?: string | null, signal?: AbortSignal) => read<CourierPage<CourierMessage>>(`${root}/${encodeURIComponent(id)}/messages${cursorQuery(cursor)}`, signal),
  send: (id: string | null, order: string | null, body: string, key: string, attachmentIds: string[] = []) => apiWriteWithCsrfTimeout<CourierSendResult>(
    id ? `${root}/${encodeURIComponent(id)}/messages` : root,
    { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(id ? { body, attachment_ids: attachmentIds } : { context_type: 'order', context_id: order, body, attachment_ids: attachmentIds }) },
  ),
  markRead: (id: string, sequence: number) => acknowledgeChatRead(apiWriteWithCsrfTimeout<{ data: CourierConversation }>(`${root}/${encodeURIComponent(id)}/read`, {
    method: 'POST', body: JSON.stringify({ last_read_sequence: sequence }),
  })),
}

export function mergeCourierMessages(current: CourierMessage[], incoming: CourierMessage[]) {
  const records = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => records.set(message.id, message))
  return [...records.values()].sort((left, right) => left.sequence - right.sequence)
}
