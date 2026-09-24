export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_requester' | 'resolved'
export type TicketCategory = 'general' | 'account' | 'order' | 'delivery'

export type SupportTicket = {
  id: string
  reference: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  revision: number
  requester_role: string
  requester_name: string | null
  assignee_name: string | null
  assignee_id: string | null
  unread_count: number
  last_activity_at: string
  created_at: string
  resolved_at: string | null
}

export type SupportTicketEvent = {
  id: string
  sequence: number
  type: 'reply' | 'status' | 'assignment'
  actor_role: string
  is_mine: boolean
  body: string | null
  from_status: TicketStatus | null
  to_status: TicketStatus | null
  assignment_changed: boolean
  created_at: string
}

export type TicketList = { items: SupportTicket[]; next_cursor: string | null }
export type TicketDetail = { data: SupportTicket; events: SupportTicketEvent[]; next_cursor: string | null }
export type TicketMutation = { data: SupportTicket; event: SupportTicketEvent }
export type TicketClient = {
  list: (cursor?: string) => Promise<TicketList>
  detail: (id: string, cursor?: string) => Promise<TicketDetail>
  create: (input: { subject: string; category: TicketCategory; body: string }, key: string) => Promise<TicketMutation>
  reply: (id: string, input: { body: string; expected_revision: number }, key: string) => Promise<TicketMutation>
  read: (id: string, sequence: number) => Promise<{ data: SupportTicket }>
}
