import { createTicketClient, SupportTicketsWorkspace, type TicketTransport } from '@aisley/support-tickets'
import { csrf, request, requestWithTimeout } from '../lib/api'

const transport: TicketTransport = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  if (options?.method === 'POST') {
    await csrf()
    return requestWithTimeout<T>(path, options)
  }
  return request<T>(path, options)
}

const client = createTicketClient('logistics', transport)

export function SupportTicketsPage() {
  return <SupportTicketsWorkspace client={client} />
}
