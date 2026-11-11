import { useEffect, useRef, useState } from 'react'
import { Button } from '@aisley/ui'
import { TicketViewport, TicketSummaryButton } from '@aisley/ui/chat'
import { NewTicketForm, TicketDetailView, type TicketDraftState } from '@aisley/support-tickets'
import { FaArrowLeft, FaPlus, FaRotate } from 'react-icons/fa6'
import { useBlocker } from 'react-router-dom'
import { useSupportTickets } from './useSupportTickets'
import { TicketDetailsPanel } from './TicketDetailsPanel'
import type { LogisticsTicketClient } from './useSupportTicketClient'
import './support.css'
import './ticket-details.css'

const emptyDraft: TicketDraftState = { dirty: false, busy: false, uncertain: false }

export function SupportWorkspace({
  client,
  initialTicketId = null,
  onSelectedTicketIdChange,
}: {
  client: LogisticsTicketClient
  initialTicketId?: string | null
  onSelectedTicketIdChange?: (id: string | null) => void
}) {
  const tickets = useSupportTickets(client)
  const [creating, setCreating] = useState(false)
  const [replyDraft, setReplyDraft] = useState(emptyDraft)
  const [statusDraft, setStatusDraft] = useState(emptyDraft)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const draft = {
    dirty: replyDraft.dirty || statusDraft.dirty,
    busy: replyDraft.busy || statusDraft.busy,
    uncertain: replyDraft.uncertain || statusDraft.uncertain,
  }
  function clearDrafts() {
    setReplyDraft(emptyDraft)
    setStatusDraft(emptyDraft)
    setDetailsOpen(false)
  }
  const newButton = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const lastInitialTicketId = useRef<string | null>(null)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (draft.dirty || draft.busy || draft.uncertain) && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search) &&
    !nextLocation.state?.supportAccessLost)

  useEffect(() => {
    if (lastInitialTicketId.current === initialTicketId) return
    lastInitialTicketId.current = initialTicketId
    if (!initialTicketId || initialTicketId === tickets.selectedId) return
    clearDrafts()
    setCreating(false)
    tickets.setSelectedId(initialTicketId)
  }, [initialTicketId, tickets.setSelectedId])

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
    clearDrafts()
    setCreating(false)
    tickets.setSelectedId(id)
    onSelectedTicketIdChange?.(id)
    if (!id) window.requestAnimationFrame(() => newButton.current?.querySelector<HTMLButtonElement>('button:last-child')?.focus())
  }

  const showingContent = creating || Boolean(tickets.selectedId)
  return <section className="logistics-support support-tickets-workspace">
    <header className="support-toolbar">
      <div>
        <h1>Support tickets</h1>
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
            clearDrafts()
            tickets.setSelectedId(null)
            setCreating(true)
            onSelectedTicketIdChange?.(null)
          }}
          type="button"
        >
          <FaPlus aria-hidden="true" />New ticket
        </Button>
      </div>
    </header>
    <TicketViewport className={`support-inbox ${showingContent ? 'support-content-open' : ''}`}>
      <section aria-label="Your tickets" className="support-ticket-list">
        <h3>Your tickets</h3>
        {tickets.error && <div className="support-ticket-error" role="alert">
          {tickets.error}<button onClick={tickets.refresh} type="button">Retry</button>
        </div>}
        {tickets.loading && <p className="support-state" role="status">Loading tickets…</p>}
        {!tickets.loading && !tickets.error && tickets.items.length === 0 && <div className="support-state">
          <p>No tickets yet.</p><p>Use New ticket when you need help.</p>
        </div>}
        {tickets.items.map(ticket => <TicketSummaryButton
          key={ticket.id}
          ticket={ticket}
          selected={ticket.id === tickets.selectedId && !creating}
          disabled={draft.busy || draft.uncertain || tickets.olderBusy}
          requester
          onSelect={() => select(ticket.id)}
        />)}
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
            clearDrafts()
            setCreating(false)
            tickets.setSelectedId(id)
            onSelectedTicketIdChange?.(id)
            tickets.refresh()
          }}
          onDraftChange={setReplyDraft}
        /> : tickets.selectedId ? <>
          {tickets.detailError && <div className="support-ticket-error" role="alert">
            {tickets.detailError}<button onClick={tickets.refresh} type="button">Retry</button>
          </div>}
          {tickets.detailLoading && !tickets.detail && <p className="support-state" role="status">Loading conversation…</p>}
          {tickets.detail?.data.id === tickets.selectedId && <div className={`support-conversation-layout ${detailsOpen ? 'support-details-open' : ''}`}>
            <TicketDetailView
              client={client}
              interactionDisabled={statusDraft.dirty || statusDraft.busy || statusDraft.uncertain}
              headerActions={<button type="button" className="support-ticket-secondary support-details-toggle"
                aria-expanded={detailsOpen} aria-controls="support-ticket-details"
                onClick={() => setDetailsOpen(open => !open)}>{detailsOpen ? 'Conversation' : 'Details / status'}</button>}
              detail={tickets.detail}
              key={tickets.selectedId}
              olderBusy={tickets.olderBusy}
              onChanged={tickets.refresh}
              onDraftChange={setReplyDraft}
              onLoadOlder={() => void tickets.loadOlder()}
            />
            <TicketDetailsPanel key={`status-${tickets.selectedId}`} client={client} ticket={tickets.detail.data}
              disabled={replyDraft.dirty || replyDraft.busy || replyDraft.uncertain}
              onChanged={tickets.refresh} onDraftChange={setStatusDraft} />
          </div>}
        </> : <div className="support-state support-placeholder">
          <h3>Select a ticket</h3><p>View the conversation or create a new request.</p>
        </div>}
      </div>
    </TicketViewport>
  </section>
}
