import type { SupportTicketFilters } from './supportTickets'
import type { TicketStatus } from '@aisley/support-tickets'

const statuses: TicketStatus[] = ['open', 'in_progress', 'waiting_for_requester', 'resolved']
const categories = ['general', 'account', 'order', 'delivery']
const assignees = ['all', 'mine', 'unassigned'] as const

export function readSupportTicketFilters(search: URLSearchParams): SupportTicketFilters {
  const status = search.get('status') as TicketStatus
  const category = search.get('category') ?? ''
  const assignee = search.get('assignee') as typeof assignees[number]
  return {
    status: statuses.includes(status) ? status : undefined,
    category: categories.includes(category) ? category : undefined,
    assignee: assignees.includes(assignee) ? assignee : 'all',
  }
}

export function supportTicketFilterSearch(filters: SupportTicketFilters): URLSearchParams {
  const search = new URLSearchParams()
  if (filters.status && statuses.includes(filters.status)) search.set('status', filters.status)
  if (filters.category && categories.includes(filters.category)) search.set('category', filters.category)
  if (filters.assignee && assignees.includes(filters.assignee) && filters.assignee !== 'all') search.set('assignee', filters.assignee)
  return search
}
