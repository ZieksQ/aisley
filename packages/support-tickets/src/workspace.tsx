'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TicketClient, TicketDetail, SupportTicket } from './types'
import { NewTicketForm } from './new-ticket-form'
import { TicketDetailView } from './ticket-detail'
import './workspace.css'

export function SupportTicketsWorkspace({ client }: { client: TicketClient }) {
  const [items, setItems] = useState<SupportTicket[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyOlder, setBusyOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshList = useCallback(async () => {
    try {
      const result = await client.list()
      setItems(result.items)
      setNextCursor(result.next_cursor)
      setSelectedId((current) => current ?? result.items[0]?.id ?? null)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Tickets could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [client])

  const refreshDetail = useCallback(async (id: string) => {
    try {
      const result = await client.detail(id)
      setDetail(result)
      const latest = result.events.at(-1)?.sequence
      if (latest !== undefined) {
        void client.read(id, latest).then(() => {
          setItems((current) => current.map((item) => item.id === id ? { ...item, unread_count: 0 } : item))
        }).catch(() => undefined)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ticket history could not be loaded.')
    }
  }, [client])

  useEffect(() => { void refreshList() }, [refreshList])
  useEffect(() => { if (selectedId) { setDetail(null); void refreshDetail(selectedId) } }, [selectedId, refreshDetail])
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { void refreshList(); if (selectedId) void refreshDetail(selectedId) } }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh) }
  }, [refreshList, refreshDetail, selectedId])

  async function loadMore() {
    if (!nextCursor) return
    try {
      const result = await client.list(nextCursor)
      setItems((current) => [...current, ...result.items.filter((item) => !current.some((existing) => existing.id === item.id))])
      setNextCursor(result.next_cursor)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'More tickets could not be loaded.')
    }
  }

  async function loadOlder() {
    if (!detail?.next_cursor || !selectedId || busyOlder) return
    setBusyOlder(true)
    try {
      const older = await client.detail(selectedId, detail.next_cursor)
      setDetail((current) => current?.data.id === selectedId ? {
        ...current,
        events: [...older.events, ...current.events.filter((event) => !older.events.some((previous) => previous.id === event.id))],
        next_cursor: older.next_cursor,
      } : current)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Older history could not be loaded.')
    } finally {
      setBusyOlder(false)
    }
  }

  function changed() { void refreshList(); if (selectedId) void refreshDetail(selectedId) }

  return <div className="support-tickets-workspace">
    <div className="support-ticket-intro">
      <h1>Support tickets</h1>
      <p>Ask the support team for help and follow replies here.</p>
    </div>
    {error && <p className="support-ticket-error" role="alert">
      {error} <button onClick={changed} type="button">Retry</button>
    </p>}
    <div className="support-ticket-columns">
      <div>
        <NewTicketForm client={client} onCreated={(id) => { setSelectedId(id); void refreshList() }} />
        <section aria-label="Your tickets" className="support-ticket-list">
          <h2>Your tickets</h2>
          {loading && <p>Loading tickets…</p>}
          {!loading && items.length === 0 && <p>No tickets yet.</p>}
          {items.map((ticket) => <button
            aria-current={ticket.id === selectedId ? 'true' : undefined}
            className="support-ticket-list-item"
            key={ticket.id}
            onClick={() => setSelectedId(ticket.id)}
            type="button"
          >
            <strong>{ticket.subject}</strong>
            <span>{ticket.reference} · {ticket.status.replaceAll('_', ' ')}</span>
            {ticket.unread_count > 0 && <em>{ticket.unread_count} unread</em>}
          </button>)}
          {nextCursor && <button className="support-ticket-secondary" onClick={() => void loadMore()} type="button">More tickets</button>}
        </section>
      </div>
      <div>
        {selectedId && !detail && <p>Loading ticket…</p>}
        {detail?.data.id === selectedId && <TicketDetailView
          client={client}
          detail={detail}
          key={selectedId}
          olderBusy={busyOlder}
          onChanged={changed}
          onLoadOlder={() => void loadOlder()}
        />}
      </div>
    </div>
  </div>
}
