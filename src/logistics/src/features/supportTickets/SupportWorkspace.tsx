import { useEffect, useRef, useState } from 'react'
import { Button } from '@aisley/ui'
import { NewTicketForm, TicketDetailView, type TicketClient, type TicketDraftState } from '@aisley/support-tickets'
import { FaArrowLeft, FaPlus, FaRotate } from 'react-icons/fa6'
import { useBlocker } from 'react-router-dom'
import { useSupportTickets } from './useSupportTickets'
import './support.css'

const statuses = { open: 'Open', in_progress: 'In progress', waiting_for_requester: 'Waiting for you', resolved: 'Resolved' }
const emptyDraft: TicketDraftState = { dirty: false, busy: false, uncertain: false }

export function SupportWorkspace({ client }: { client: TicketClient }) {
  const tickets = useSupportTickets(client)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const newButton = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (draft.dirty || draft.busy || draft.uncertain) && currentLocation.pathname !== nextLocation.pathname &&
    !nextLocation.state?.supportAccessLost)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (!draft.busy && !draft.uncertain && window.confirm('Discard your unsent support draft?')) blocker.proceed()
    else blocker.reset()
  }, [blocker, draft.busy, draft.uncertain])

  useEffect(() => { document.title = 'Support tickets | Aisley Logistics' }, [])
  useEffect(() => {
    if (!creating && !tickets.selectedId) return
    const timer = window.setTimeout(() => {
      const target = content.current?.querySelector<HTMLElement>(creating ? '#ticket-subject' : '.support-ticket-detail h2')
      if (target) { if (!creating) target.tabIndex = -1; target.focus() }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [creating, tickets.selectedId, tickets.detail?.data.id])

  useEffect(() => {
    if (!draft.dirty && !draft.uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft.dirty, draft.busy, draft.uncertain])

  function canLeave() {
    if (draft.busy || draft.uncertain) return false
    return !draft.dirty || window.confirm('Discard your unsent support draft?')
  }

  function select(id: string | null) {
    if (id === tickets.selectedId && !creating) return
    if (!canLeave()) return
    setDraft(emptyDraft)
    setCreating(false)
    tickets.setSelectedId(id)
    if (!id) window.requestAnimationFrame(() => newButton.current?.querySelector<HTMLButtonElement>('button:last-child')?.focus())
  }

  const showingContent = creating || Boolean(tickets.selectedId)
  return <section className="logistics-support support-tickets-workspace">
    <header className="support-toolbar">
      <div>
        <h2>Support tickets</h2>
        <p>Contact Admin support and follow your requests.</p>
      </div>
      <div className="support-toolbar-actions" ref={newButton}>
        <button aria-label="Refresh support tickets" className="support-ticket-secondary" onClick={tickets.refresh} type="button">
          <FaRotate aria-hidden="true" />
        </button>
        <Button
          disabled={creating || draft.busy || draft.uncertain || tickets.olderBusy}
          onClick={() => {
            if (!canLeave()) return
            setDraft(emptyDraft)
            tickets.setSelectedId(null)
            setCreating(true)
          }}
          type="button"
        >
          <FaPlus aria-hidden="true" />New ticket
        </Button>
      </div>
    </header>
    <div className={`support-inbox ${showingContent ? 'support-content-open' : ''}`}>
      <section aria-label="Your tickets" className="support-ticket-list">
        <h3>Your tickets</h3>
        {tickets.error && <div className="support-ticket-error" role="alert">
          {tickets.error}<button onClick={tickets.refresh} type="button">Retry</button>
        </div>}
        {tickets.loading && <p className="support-state" role="status">Loading tickets…</p>}
        {!tickets.loading && !tickets.error && tickets.items.length === 0 && <div className="support-state">
          <p>No tickets yet.</p><p>Use New ticket when you need help.</p>
        </div>}
        {tickets.items.map((ticket) => <button
          aria-current={ticket.id === tickets.selectedId && !creating ? 'true' : undefined}
          className="support-ticket-list-item"
          disabled={draft.busy || draft.uncertain || tickets.olderBusy}
          key={ticket.id}
          onClick={() => select(ticket.id)}
          type="button"
        >
          <span className="support-list-meta">
            <span>{ticket.reference}</span><span>{statuses[ticket.status]}</span>
          </span>
          <strong>{ticket.subject}</strong>
          <span className="support-list-meta">
            <time dateTime={ticket.last_activity_at}>
              {new Date(ticket.last_activity_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}
            </time>
            {ticket.unread_count > 0 && <em>{ticket.unread_count} unread</em>}
          </span>
        </button>)}
        {tickets.cursor && <button className="support-ticket-secondary support-load-more" disabled={tickets.moreBusy} onClick={() => void tickets.loadMore()} type="button">
          {tickets.moreBusy ? 'Loading…' : 'Load more tickets'}
        </button>}
      </section>
      <div className="support-content" ref={content}>
        {showingContent && <button className="support-ticket-secondary support-back" disabled={draft.busy || draft.uncertain || tickets.olderBusy} onClick={() => select(null)} type="button">
          <FaArrowLeft aria-hidden="true" />All tickets
        </button>}
        {creating ? <NewTicketForm
          client={client}
          onCancel={() => select(null)}
          onCreated={(id) => {
            setDraft(emptyDraft)
            setCreating(false)
            tickets.setSelectedId(id)
            tickets.refresh()
          }}
          onDraftChange={setDraft}
        /> : tickets.selectedId ? <>
          {tickets.detailError && <div className="support-ticket-error" role="alert">
            {tickets.detailError}<button onClick={tickets.refresh} type="button">Retry</button>
          </div>}
          {tickets.detailLoading && !tickets.detail && <p className="support-state" role="status">Loading conversation…</p>}
          {tickets.detail?.data.id === tickets.selectedId && <TicketDetailView
            client={client}
            detail={tickets.detail}
            key={tickets.selectedId}
            olderBusy={tickets.olderBusy}
            onChanged={tickets.refresh}
            onDraftChange={setDraft}
            onLoadOlder={() => void tickets.loadOlder()}
          />}
        </> : <div className="support-state support-placeholder">
          <h3>Select a ticket</h3><p>View the conversation or create a new request.</p>
        </div>}
      </div>
    </div>
  </section>
}
