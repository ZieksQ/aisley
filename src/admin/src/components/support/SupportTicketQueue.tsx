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

const selectClass = 'min-h-10 rounded-md border border-slate-300 bg-white px-2.5 text-sm dark:border-white/20 dark:bg-[#19151e]'

export function SupportTicketQueue({ tickets, selectedId, filters, loading, hasMore, onFilters, onSelect, onMore }: Props) {
  return <section aria-label="Support queue" className="min-w-0 border border-slate-200 bg-white dark:border-white/10 dark:bg-[#17141b]">
    <div className="border-b border-slate-200 p-4 dark:border-white/10">
      <h2 className="text-base font-semibold">Support queue</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
    {loading && <p className="p-4 text-sm text-slate-500">Loading tickets…</p>}
    {!loading && tickets.length === 0 && <p className="p-4 text-sm text-slate-500">No tickets match these filters.</p>}
    <ul>
      {tickets.map((ticket) => <li className="border-b border-slate-200 last:border-0 dark:border-white/10" key={ticket.id}>
        <button
          aria-current={selectedId === ticket.id ? 'true' : undefined}
          className="w-full px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#4C1268] aria-[current=true]:bg-purple-50 dark:hover:bg-white/5 dark:aria-[current=true]:bg-white/10"
          onClick={() => onSelect(ticket.id)}
          type="button"
        >
          <span className="flex items-start justify-between gap-2">
            <strong className="break-words text-sm">{ticket.subject}</strong>
            {ticket.unread_count > 0 && <span className="shrink-0 text-xs font-semibold text-[#4C1268] dark:text-purple-200">{ticket.unread_count} unread</span>}
          </span>
          <span className="mt-1 block break-all text-xs text-slate-500 dark:text-slate-400">{ticket.reference} · {ticket.requester_role} · {ticket.status.replaceAll('_', ' ')}</span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{new Date(ticket.last_activity_at).toLocaleString()}</span>
        </button>
      </li>)}
    </ul>
    {hasMore && <button
      className="w-full border-t border-slate-200 px-4 py-3 text-left text-sm font-semibold text-[#4C1268] hover:bg-slate-50 dark:border-white/10 dark:text-purple-200 dark:hover:bg-white/5"
      onClick={onMore}
      type="button"
    >More tickets</button>}
  </section>
}
