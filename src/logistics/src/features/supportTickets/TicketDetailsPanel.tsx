import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@aisley/ui'
import { TicketStatusBadge } from '@aisley/ui/chat'
import type { SupportTicket, TicketDraftState } from '@aisley/support-tickets'
import type { LogisticsTicketClient } from './useSupportTicketClient'

const date = (value: string) => new Date(value).toLocaleString('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
})

export function TicketDetailsPanel({ client, ticket, disabled, onChanged, onDraftChange }: {
  client: LogisticsTicketClient
  ticket: SupportTicket
  disabled: boolean
  onChanged: () => void
  onDraftChange: (draft: TicketDraftState) => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const attempt = useRef<{ key: string; input: { status: 'open' | 'resolved'; reason: string; expected_revision: number } } | null>(null)
  const target = attempt.current?.input.status ?? (ticket.status === 'resolved' ? 'open' : 'resolved')

  useEffect(() => {
    onDraftChange({ dirty: Boolean(reason), busy, uncertain })
  }, [reason, busy, uncertain, onDraftChange])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || disabled || !reason.trim()) return
    const pending = attempt.current ?? {
      key: crypto.randomUUID(), input: { status: target, reason: reason.trim(), expected_revision: ticket.revision },
    }
    attempt.current = pending
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await client.changeStatus(ticket.id, pending.input, pending.key)
      attempt.current = null
      setReason('')
      setUncertain(false)
      setSaved(true)
      onChanged()
    } catch (caught) {
      const status = (caught as { status?: number }).status
      const unknown = !status || status === 408 || status >= 500
      setUncertain(unknown)
      if (!unknown) attempt.current = null
      setError(caught instanceof Error ? caught.message : 'Status could not be changed. Try again.')
      if (status === 409) onChanged()
    } finally {
      setBusy(false)
    }
  }

  return <aside className="support-details-panel" id="support-ticket-details" aria-label="Ticket details">
    <h3>Ticket details</h3>
    <dl>
      <div><dt>Status</dt><dd><TicketStatusBadge status={ticket.status} requester /></dd></div>
      <div><dt>Reference</dt><dd>{ticket.reference}</dd></div>
      <div><dt>Category</dt><dd>{ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}</dd></div>
      <div><dt>Support agent</dt><dd>{ticket.assignee_name ?? 'Awaiting assignment'}</dd></div>
      <div><dt>Created</dt><dd><time dateTime={ticket.created_at}>{date(ticket.created_at)}</time></dd></div>
      <div><dt>Last updated</dt><dd><time dateTime={ticket.last_activity_at}>{date(ticket.last_activity_at)}</time></dd></div>
    </dl>
    <form className="support-ticket-form support-status-form" onSubmit={submit}>
      <h3>Change status</h3>
      <p className="support-ticket-hint">{target === 'resolved' ? 'Issue sorted? Mark this ticket as resolved.' : 'Still need help? Reopen this ticket for Admin support.'}</p>
      {disabled && <p className="support-ticket-hint">Send or clear your reply draft before changing status.</p>}
      <label htmlFor="ticket-status-reason">{target === 'resolved' ? 'Resolution reason' : 'Reason for reopening'}</label>
      <textarea id="ticket-status-reason" required maxLength={2000} rows={3} value={reason}
        disabled={disabled || busy || uncertain}
        onChange={event => { setReason(event.target.value); setSaved(false) }} />
      {error && <p className="support-ticket-error" role="alert">{error}</p>}
      {uncertain && <p className="support-ticket-hint">The status may have been saved. Retry the same change to confirm safely.</p>}
      {saved && <p className="support-status-saved" role="status">Status saved.</p>}
      <Button type="submit" disabled={disabled || busy || !reason.trim()}>
        {busy ? 'Saving…' : uncertain ? 'Retry status change' : target === 'resolved' ? 'Mark as resolved' : 'Reopen ticket'}
      </Button>
      {uncertain && <button className="support-ticket-secondary" type="button" disabled={busy} onClick={() => {
        if (!window.confirm('Discard this status change? It may already have been saved.')) return
        attempt.current = null
        setReason('')
        setUncertain(false)
        setError(null)
        onChanged()
      }}>Discard status change</button>}
    </form>
  </aside>
}
