'use client'

import { ticketStatusLabel } from './ticket-history'
import './ticket-presentation.css'

export function TicketStatusBadge({ status, requester = false }: { status: string; requester?: boolean }) {
  return <span className="support-ticket-status" data-status={status}>{ticketStatusLabel(status, requester)}</span>
}

const dateFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })

/** Safe summary data only. Selection, pagination and authorization belong to each role. */
export function TicketSummaryButton({ ticket, selected, disabled, requester = false, onSelect }: {
  ticket: {
    subject: string
    reference: string
    category: string
    status: string
    unread_count: number
    last_activity_at: string
    requester_role?: string
  }
  selected: boolean
  disabled?: boolean
  requester?: boolean
  onSelect: () => void
}) {
  return <button className="support-ticket-list-item" aria-current={selected ? 'true' : undefined} disabled={disabled} onClick={onSelect} type="button">
    <span className="support-list-meta">
      <span>{ticket.reference}</span>
      <time dateTime={ticket.last_activity_at}>{dateFormat.format(new Date(ticket.last_activity_at))}</time>
    </span>
    <strong>{ticket.subject}</strong>
    <span className="support-list-category">{ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}{!requester && ticket.requester_role ? ` · ${ticket.requester_role}` : ''}</span>
    <span className="support-list-meta">
      <TicketStatusBadge status={ticket.status} requester={requester} />
      {ticket.unread_count > 0 && <em className="support-ticket-unread">{ticket.unread_count} unread</em>}
    </span>
  </button>
}
