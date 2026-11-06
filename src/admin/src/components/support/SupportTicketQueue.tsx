import { TicketSummaryButton } from '@aisley/ui/chat'
import type { SupportTicket, TicketCategory, TicketStatus } from '@aisley/support-tickets'
import type { SupportTicketFilters } from '../../lib/supportTickets'

type Props = {
  tickets: SupportTicket[]
  selectedId: string | null
  filters: SupportTicketFilters
  loading: boolean
  hasMore: boolean
  onFilters: (filters: SupportTicketFilters) => void
  onSelect: (id: string) => void
  onMore: () => void
}

const selectClass = 'min-h-11 rounded-md border border-slate-300 bg-white px-2.5 text-sm dark:border-white/20 dark:bg-slate-900'

export function SupportTicketQueue({ tickets, selectedId, filters, loading, hasMore, onFilters, onSelect, onMore }: Props) {
  return <section aria-label="Support queue" className="admin-ticket-queue min-w-0 h-[clamp(540px,calc(100dvh-200px),900px)] overflow-y-auto border-r border-slate-200 bg-white dark:border-white/10 dark:bg-slate-800">
    <div className="border-b border-slate-200 p-4 dark:border-white/10">
      <h2 className="text-base font-semibold">Support queue</h2>
      <div className="mt-3 grid gap-2 grid-cols-1">
        <label className="grid gap-1 text-xs">Status
          <select className={selectClass} onChange={(event) => onFilters({ ...filters, status: event.target.value as TicketStatus || undefined })} value={filters.status ?? ''}>
            <option value="">All</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_for_requester">Waiting</option><option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs">Category
          <select className={selectClass} onChange={(event) => onFilters({ ...filters, category: event.target.value as TicketCategory || undefined })} value={filters.category ?? ''}>
            <option value="">All</option><option value="general">General</option><option value="account">Account</option><option value="order">Order</option><option value="delivery">Delivery</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs">Assignee
          <select className={selectClass} onChange={(event) => onFilters({ ...filters, assignee: event.target.value as 'all' | 'mine' | 'unassigned' })} value={filters.assignee ?? 'all'}>
            <option value="all">All</option><option value="mine">Mine</option><option value="unassigned">Unassigned</option>
          </select>
        </label>
      </div>
    </div>
    {loading && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading tickets…</p>}
    {!loading && tickets.length === 0 && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No tickets match these filters.</p>}
    <ul>
      {tickets.map((ticket) => <li key={ticket.id}>
        <TicketSummaryButton ticket={ticket} selected={selectedId === ticket.id} onSelect={() => onSelect(ticket.id)} />
      </li>)}
    </ul>
    {hasMore && <button
      className="w-full border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold text-[#4C1268] hover:bg-slate-50 dark:border-white/10 dark:text-purple-200 dark:hover:bg-white/5"
      onClick={onMore}
      type="button"
    >More tickets</button>}
  </section>
}
