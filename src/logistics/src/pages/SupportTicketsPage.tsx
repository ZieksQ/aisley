import { SupportWorkspace } from '../features/supportTickets/SupportWorkspace'
import { useSupportTicketClient } from '../features/supportTickets/useSupportTicketClient'

export function SupportTicketsPage() {
  const { client, accessLost } = useSupportTicketClient()
  if (accessLost) return <p className="p-5 text-sm" role="status">Your support access changed. Clearing private tickets…</p>
  return <SupportWorkspace client={client} />
}
