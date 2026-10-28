import { SupportWorkspace } from '../features/supportTickets/SupportWorkspace'
import { useSupportTicketClient } from '../features/supportTickets/useSupportTicketClient'
import { useLocation, useNavigate } from 'react-router-dom'

export function SupportTicketsPage() {
  const { client, accessLost } = useSupportTicketClient()
  const location = useLocation()
  const navigate = useNavigate()
  const initialTicketId = new URLSearchParams(location.search).get('ticket')
  function updateSelectedTicket(id: string | null) {
    const next = new URLSearchParams(location.search)
    if (id) next.set('ticket', id)
    else next.delete('ticket')
    const query = next.toString()
    navigate({ pathname: location.pathname, search: query ? `?${query}` : '' }, { replace: true })
  }
  if (accessLost) return <p className="p-5 text-sm" role="status">Your support access changed. Clearing private tickets…</p>
  return <SupportWorkspace client={client} initialTicketId={initialTicketId} onSelectedTicketIdChange={updateSelectedTicket} />
}
