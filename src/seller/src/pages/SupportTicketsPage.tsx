import { createTicketClient, SupportTicketsWorkspace, type TicketTransport } from '@aisley/support-tickets'
import { useSearchParams } from 'react-router-dom'
import { apiRequest, apiWriteWithCsrfTimeout } from '../lib/api'

const transport: TicketTransport = <T,>(path: string, options?: RequestInit): Promise<T> =>
  options?.method === 'POST' ? apiWriteWithCsrfTimeout<T>(path, options) : apiRequest<T>(path, options)

const client = createTicketClient('seller', transport)

export function SupportTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  function updateSelectedTicket(id: string | null) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (id) next.set('ticket', id)
      else next.delete('ticket')
      return next
    }, { replace: true })
  }
  return <SupportTicketsWorkspace client={client} initialTicketId={searchParams.get('ticket')} onSelectedTicketIdChange={updateSelectedTicket} />
}
