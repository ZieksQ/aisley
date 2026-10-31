import { createTicketClient, SupportTicketsWorkspace, type TicketTransport, type TicketDraftState } from '@aisley/support-tickets'
import { useEffect, useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router-dom'
import { apiRequest, apiWriteWithCsrfTimeout } from '../lib/api'

const transport: TicketTransport = <T,>(path: string, options?: RequestInit): Promise<T> =>
  options?.method === 'POST' ? apiWriteWithCsrfTimeout<T>(path, options) : apiRequest<T>(path, options)

const client = createTicketClient('seller', transport)

export function SupportTicketsPage() {
  const [draft, setDraft] = useState<TicketDraftState>({ dirty: false, busy: false, uncertain: false })
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname && (draft.dirty || draft.busy || draft.uncertain))
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (!draft.busy && !draft.uncertain && window.confirm('Discard your unsent support draft?')) blocker.proceed()
    else blocker.reset()
  }, [blocker, draft.busy, draft.uncertain])
  const [searchParams, setSearchParams] = useSearchParams()
  function updateSelectedTicket(id: string | null) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (id) next.set('ticket', id)
      else next.delete('ticket')
      return next
    }, { replace: true })
  }
  return <SupportTicketsWorkspace client={client} onDraftChange={setDraft} initialTicketId={searchParams.get('ticket')} onSelectedTicketIdChange={updateSelectedTicket} />
}
