import { useState, type FormEvent } from 'react'
import { Button } from '@aisley/ui'
import type { TicketClient, TicketDetail } from './types'

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_for_requester: 'Waiting for you',
  resolved: 'Resolved',
}

export function TicketDetailView({ client, detail, olderBusy, onLoadOlder, onChanged }: {
  client: TicketClient
  detail: TicketDetail
  olderBusy: boolean
  onLoadOlder: () => void
  onChanged: () => void
}) {
  const [body, setBody] = useState('')
  const [key, setKey] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ticket = detail.data

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const requestKey = key ?? crypto.randomUUID()
    setKey(requestKey)
    setBusy(true)
    setError(null)
    try {
      await client.reply(ticket.id, { body: body.trim(), expected_revision: ticket.revision }, requestKey)
      setBody('')
      setKey(null)
      setUncertain(false)
      onChanged()
    } catch (caught) {
      const status = (caught as { status?: number }).status
      setUncertain(!status || status === 408)
      setError(caught instanceof Error ? caught.message : 'The reply could not be saved.')
      if (status === 409) {
        setKey(null)
        onChanged()
      }
    } finally {
      setBusy(false)
    }
  }

  return <section aria-label="Ticket detail" className="support-ticket-detail">
    <div className="support-ticket-detail-header">
      <div>
        <p className="support-ticket-reference">{ticket.reference}</p>
        <h2>{ticket.subject}</h2>
      </div>
      <span className="support-ticket-status">{statusLabel[ticket.status]}</span>
    </div>
    <p className="support-ticket-meta">
      {ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)} · Updated {new Date(ticket.last_activity_at).toLocaleString()}
    </p>
    {detail.next_cursor &&
      <button className="support-ticket-secondary" disabled={olderBusy} onClick={onLoadOlder} type="button">
        {olderBusy ? 'Loading…' : 'Older history'}
      </button>}
    <ol className="support-ticket-timeline">
      {detail.events.map((event) => <li key={event.id}>
        <div className="support-ticket-event-top">
          <strong>{event.is_mine ? 'You' : event.actor_role === 'admin' ? 'Support team' : 'Requester'}</strong>
          <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
        </div>
        {event.type === 'reply' && <p className="support-ticket-message">{event.body}</p>}
        {event.type === 'status' &&
          <p>Status changed to {statusLabel[event.to_status ?? ''] ?? event.to_status}. {event.body}</p>}
        {event.type === 'assignment' && <p>Ticket assignment changed.</p>}
      </li>)}
    </ol>
    <form className="support-ticket-form" onSubmit={submit}>
      <label htmlFor="ticket-reply">Reply</label>
      <textarea
        disabled={uncertain || busy}
        id="ticket-reply"
        maxLength={2000}
        minLength={1}
        onChange={(event) => { setBody(event.target.value); setKey(null) }}
        required
        rows={4}
        value={body}
      />
      {error && <p className="support-ticket-error" role="alert">{error}</p>}
      {uncertain && <p className="support-ticket-hint">The reply may have been saved. Retry the same submission to check safely.</p>}
      <div className="support-ticket-actions">
        <Button disabled={busy || body.trim().length === 0} type="submit">
          {busy ? 'Sending…' : uncertain ? 'Retry reply' : 'Send reply'}
        </Button>
        {uncertain &&
          <button className="support-ticket-secondary" onClick={() => { setBody(''); setKey(null); setUncertain(false); setError(null) }} type="button">
            Discard draft
          </button>}
      </div>
    </form>
  </section>
}
