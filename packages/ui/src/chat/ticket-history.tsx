'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import './ticket-history.css'

/** Public ticket events only; ticket workflow and authorization stay with the caller. */
export type TicketHistoryEvent = {
  id: string
  type: 'reply' | 'status' | 'assignment'
  is_mine: boolean
  actor_role: string
  body: string | null
  to_status: string | null
  created_at: string
}

export function ticketStatusLabel(status: string, requester = false) {
  if (status === 'waiting_for_requester') return requester ? 'Waiting for you' : 'Waiting for requester'
  return ({ open: 'Open', in_progress: 'In progress', resolved: 'Resolved' } as Record<string, string>)[status] ?? status
}

const dayFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long' })
const timeFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
const fullFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' })

export function TicketHistory({ events, hasOlder, loadingOlder, onLoadOlder, requester = false }: {
  events: TicketHistoryEvent[]
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  requester?: boolean
}) {
  const view = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const previous = useRef<{ first?: string; last?: string; height: number; top: number }>({ height: 0, top: 0 })
  const [newActivity, setNewActivity] = useState(false)

  useLayoutEffect(() => {
    const node = view.current
    if (!node) return
    const before = previous.current
    if (before.first && events[0]?.id !== before.first && events.some(event => event.id === before.first)) {
      node.scrollTop = before.top + node.scrollHeight - before.height
    } else if (!before.last || following.current) {
      node.scrollTop = node.scrollHeight
    } else if (events.at(-1)?.id !== before.last) setNewActivity(true)
    previous.current = { first: events[0]?.id, last: events.at(-1)?.id, height: node.scrollHeight, top: node.scrollTop }
  }, [events])

  return <div className="ticket-history-wrap">
    <div className="ticket-history" aria-label="Ticket history" tabIndex={0} ref={view} onScroll={event => {
      const node = event.currentTarget
      following.current = node.scrollHeight - node.scrollTop - node.clientHeight < 72
      previous.current.top = node.scrollTop
      previous.current.height = node.scrollHeight
      if (following.current) setNewActivity(false)
    }}>
      {hasOlder && <button className="ticket-history-older" type="button" disabled={loadingOlder} onClick={onLoadOlder}>{loadingOlder ? 'Loading…' : 'Older history'}</button>}
      <ol>
        {events.map((event, index) => {
          const date = new Date(event.created_at)
          const day = dayFormat.format(date)
          const newDay = !index || dayFormat.format(new Date(events[index - 1].created_at)) !== day
          return <li key={event.id}>
            {newDay && <p className="ticket-history-day">{day}</p>}
            {event.type === 'reply' ? <article className={`ticket-bubble ${event.is_mine ? 'ticket-bubble-mine' : ''}`}>
              <strong>{event.is_mine ? 'You' : event.actor_role === 'admin' ? 'Support team' : 'Requester'}</strong>
              <p>{event.body}</p>
              <time dateTime={event.created_at} title={fullFormat.format(date)}><span className="ticket-sr-only">{day}, </span>{timeFormat.format(date)}</time>
            </article> : <div className="ticket-system-event">
              <p>{event.type === 'status' ? `Status changed to ${ticketStatusLabel(event.to_status ?? '', requester)}.` : 'Ticket assignment changed.'}{event.body ? ` ${event.body}` : ''}</p>
              <span>{event.is_mine ? 'You' : event.actor_role === 'admin' ? 'Support team' : 'Requester'} · <time dateTime={event.created_at} title={fullFormat.format(date)}>{timeFormat.format(date)}</time></span>
            </div>}
          </li>
        })}
      </ol>
    </div>
    <div aria-live="polite" className="ticket-sr-only">{newActivity ? 'New ticket activity available.' : ''}</div>
    {newActivity && <button className="ticket-history-latest" type="button" onClick={() => {
      if (view.current) view.current.scrollTop = view.current.scrollHeight
      following.current = true
      setNewActivity(false)
    }}>New activity · Latest</button>}
  </div>
}
