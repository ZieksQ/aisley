import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SupportTicketsWorkspace } from '../src/workspace'
import { SupportWorkspace } from '../../../src/logistics/src/features/supportTickets/SupportWorkspace'
import { SupportTicketQueue } from '../../../src/admin/src/components/support/SupportTicketQueue'
import { SupportTicketDetail } from '../../../src/admin/src/components/support/SupportTicketDetail'
import type { SupportTicket, TicketClient, TicketDetail } from '../src/types'
import './fixture.css'

const params = new URLSearchParams(location.search)
const role = params.get('role') ?? 'customer'
document.documentElement.classList.toggle('dark', params.has('dark') && role !== 'customer')
const ticket: SupportTicket = { id: 'ticket-one', reference: 'SUP-2026-1001', subject: 'Delivery arrived with a missing item', category: 'delivery', status: params.has('resolved') ? 'resolved' : 'waiting_for_requester', revision: 60, requester_role: 'customer', requester_name: 'Maria Santos', assignee_name: 'Support agent', assignee_id: 'admin-one', unread_count: 2, last_activity_at: '2026-10-31T08:00:00Z', created_at: '2026-10-30T08:00:00Z', resolved_at: null }
const detail: TicketDetail = { data: ticket, next_cursor: 'older', events: Array.from({ length: 30 }, (_, index) => ({ id: `event-${index}`, sequence: index + 1, type: index === 28 ? 'status' : 'reply', is_mine: index % 2 === 0, actor_role: index % 2 === 0 ? 'customer' : 'admin', body: index === 28 ? 'Please confirm which item is missing.' : index % 2 === 0 ? 'One item was missing from the package.\n<script>This must remain plain text</script>' : 'Thank you for reporting this. Could you describe the missing item?', to_status: index === 28 ? 'waiting_for_requester' : null, from_status: null, assignment_changed: false, created_at: `2026-10-${index < 15 ? '30' : '31'}T08:${String(index).padStart(2, '0')}:00Z` })) }
let replyCalls = 0
const client: TicketClient = {
  list: async () => {
    if (params.has('error')) throw new Error('Tickets could not be loaded. Try again.')
    return { items: params.has('empty') ? [] : [ticket, { ...ticket, id: 'ticket-two', subject: 'Account access question', unread_count: 0 }], next_cursor: null }
  },
  detail: async (id, cursor) => ({ ...detail, data: { ...ticket, id, subject: id === 'ticket-two' ? 'Account access question' : ticket.subject }, events: cursor ? [{ ...detail.events[0], id: 'earlier', sequence: 0, created_at: '2026-10-29T08:00:00Z' }] : [...detail.events], next_cursor: cursor ? null : 'older' }),
  read: async () => ({ data: ticket }),
  reply: async (_id, input, key) => {
    const checks = window as unknown as { attempts: unknown[] }
    checks.attempts ??= []
    checks.attempts.push({ input, key })
    if (++replyCalls === 1) throw new Error('Connection lost. Please retry.')
    return { data: ticket, event: detail.events[0] }
  },
  create: async input => ({ data: { ...ticket, subject: input.subject }, event: detail.events[0] }),
}
;(window as unknown as { fixture: { detail: TicketDetail; client: TicketClient } }).fixture = { detail, client }

function Fixture() {
  return <main className={role === 'logistics' ? '' : 'p-5'}>
    {role === 'admin' && params.has('queue') ? <SupportTicketQueue tickets={[ticket]} selectedId={ticket.id} filters={{}} loading={false} hasMore={false} onFilters={() => {}} onSelect={() => {}} onMore={() => {}} /> : role === 'admin' ? <SupportTicketDetail detail={detail} assignees={[{ id: 'admin-one', name: 'Support agent' }]} canManage={!location.search.includes('readonly')} onChanged={() => {}} onLoadOlder={() => {}} loadingOlder={false} /> : role === 'logistics' ? <SupportWorkspace client={client} initialTicketId={params.has('selected') ? ticket.id : null} /> : <SupportTicketsWorkspace client={client} initialTicketId={params.has('selected') ? ticket.id : null} />}
  </main>
}
createRoot(document.getElementById('root')!).render(<RouterProvider router={createBrowserRouter([{ path: '*', element: <Fixture /> }])} />)
