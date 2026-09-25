import type { TicketClient, TicketDetail, TicketList, TicketMutation, TicketCategory, SupportTicket } from './types'

export type TicketTransport = <T>(path: string, options?: RequestInit) => Promise<T>

export function createTicketClient(role: 'customer' | 'seller' | 'logistics', transport: TicketTransport): TicketClient {
  const base = `/api/v1/${role}/support-tickets`
  const post = <T>(path: string, body: unknown, key?: string) => transport<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: key ? { 'Idempotency-Key': key } : undefined,
  })

  return {
    list: (cursor) => transport<TicketList>(cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base),
    detail: (id, cursor) => transport<TicketDetail>(cursor ? `${base}/${id}?cursor=${encodeURIComponent(cursor)}` : `${base}/${id}`),
    create: (input: { subject: string; category: TicketCategory; body: string }, key) => post<TicketMutation>(base, input, key),
    reply: (id, input, key) => post<TicketMutation>(`${base}/${id}/replies`, input, key),
    read: (id, sequence) => post<{ data: SupportTicket }>(`${base}/${id}/read`, { last_read_sequence: sequence }),
  }
}
