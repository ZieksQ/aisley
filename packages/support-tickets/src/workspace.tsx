'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@aisley/ui'
import { TicketViewport, TicketSummaryButton } from '@aisley/ui/chat'
import type { TicketClient, TicketDraftState } from './types'
import { NewTicketForm } from './new-ticket-form'
import { TicketDetailView } from './ticket-detail'
import { useSupportTickets } from './use-support-tickets'
import './workspace.css'

const emptyDraft: TicketDraftState = { dirty: false, busy: false, uncertain: false }

export function SupportTicketsWorkspace({ client, initialTicketId = null, onSelectedTicketIdChange, onDraftChange }: {
  client: TicketClient
  onDraftChange?: (state: TicketDraftState) => void
  initialTicketId?: string | null
  onSelectedTicketIdChange?: (id: string | null) => void
}) {
  const tickets = useSupportTickets(client)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const content = useRef<HTMLDivElement>(null)
  const newButton = useRef<HTMLDivElement>(null)
  const previousInitial = useRef(initialTicketId)
  const initialApplied = useRef(false)

  useEffect(() => { onDraftChange?.(draft) }, [draft, onDraftChange])

  function canLeave() {
    if (draft.busy || draft.uncertain) return false
    return !draft.dirty || window.confirm('Discard your unsent support draft?')
  }

  useEffect(() => {
    if (initialApplied.current && previousInitial.current === initialTicketId) return
    if (initialApplied.current && !canLeave()) {
      onSelectedTicketIdChange?.(tickets.selectedId)
      return
    }
    initialApplied.current = true
    previousInitial.current = initialTicketId
    tickets.setSelectedId(initialTicketId)
    if (initialTicketId && initialTicketId !== tickets.selectedId) {
      setCreating(false)
      setDraft(emptyDraft)
    }
  }, [initialTicketId, tickets.setSelectedId])

  useEffect(() => {
    const target = content.current?.querySelector<HTMLElement>(creating ? '#ticket-subject' : '.support-ticket-detail h2')
    if (target) { if (!creating) target.tabIndex = -1; target.focus() }
  }, [creating, tickets.detail?.data.id])

  useEffect(() => {
    if (!draft.dirty && !draft.busy && !draft.uncertain) return
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const link = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!anchor || event.defaultPrevented || onDraftChange) return
      if (draft.busy || draft.uncertain || !window.confirm('Discard your unsent support draft?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', link, true)
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', link, true) }
  }, [draft, onDraftChange])

  function select(id: string | null, create = false) {
    if (!create && !creating && id === tickets.selectedId) return
    if (!canLeave()) return
    setDraft(emptyDraft)
    setCreating(create)
    tickets.setSelectedId(id)
    onSelectedTicketIdChange?.(id)
    if (!id && !create) requestAnimationFrame(() => newButton.current?.querySelector('button')?.focus())
  }

  const showingContent = creating || Boolean(tickets.selectedId)
  return <div className="support-tickets-workspace">
    <header className="support-ticket-intro">
      <div><h1>Support tickets</h1><p>Ask the support team for help and follow replies here.</p></div>
      <div ref={newButton}><Button disabled={draft.busy || draft.uncertain || creating} onClick={() => select(null, true)}>New ticket</Button></div>
    </header>
    <TicketViewport className={`support-ticket-columns ${showingContent ? 'support-content-open' : ''}`}>
      <section aria-label="Your tickets" className="support-ticket-list">
        <h2>Your tickets</h2>
        {tickets.error && <p className="support-ticket-error" role="alert">{tickets.error} <button onClick={tickets.refresh}>Retry</button></p>}
        {tickets.loading && <p className="support-state" role="status">Loading tickets…</p>}
        {!tickets.loading && !tickets.error && tickets.items.length === 0 && <p className="support-state">No tickets yet. Create a ticket when you need help.</p>}
        {tickets.items.map(ticket => <TicketSummaryButton
          key={ticket.id}
          ticket={ticket}
          selected={ticket.id === tickets.selectedId}
          disabled={draft.busy || draft.uncertain || tickets.olderBusy}
          requester
          onSelect={() => select(ticket.id)}
        />)}
        {tickets.cursor && <button className="support-ticket-secondary" disabled={tickets.moreBusy} onClick={() => void tickets.loadMore()} type="button">{tickets.moreBusy ? 'Loading…' : 'More tickets'}</button>}
      </section>
      <div className="support-ticket-content" ref={content}>
        {showingContent && <button className="support-ticket-secondary support-back" disabled={draft.busy || draft.uncertain || tickets.olderBusy} onClick={() => select(null)} type="button">← All tickets</button>}
        {creating ? <NewTicketForm client={client} onCancel={() => select(null)} onDraftChange={setDraft} onCreated={id => { setDraft(emptyDraft); setCreating(false); tickets.setSelectedId(id); onSelectedTicketIdChange?.(id); tickets.refresh() }} /> : tickets.selectedId ? <>
          {tickets.detailError && <p className="support-ticket-error" role="alert">{tickets.detailError} <button onClick={tickets.refresh}>Retry</button></p>}
          {tickets.detailLoading && !tickets.detail && <p className="support-state" role="status">Loading conversation…</p>}
          {tickets.detail?.data.id === tickets.selectedId && <TicketDetailView client={client} detail={tickets.detail} key={tickets.selectedId} olderBusy={tickets.olderBusy} onChanged={tickets.refresh} onDraftChange={setDraft} onLoadOlder={() => void tickets.loadOlder()} />}
        </> : <div className="support-state support-placeholder"><h2>Select a ticket</h2><p>View the conversation or create a new request.</p></div>}
      </div>
    </TicketViewport>
  </div>
}
