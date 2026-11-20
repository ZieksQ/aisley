import { createTicketClient, type TicketClient, type TicketMutation, type TicketTransport } from '@aisley/support-tickets'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, csrf, request, requestWithTimeout } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'

export type LogisticsTicketClient = TicketClient & {
  changeStatus: (id: string, input: { status: 'open' | 'resolved'; reason: string; expected_revision: number }, key: string) => Promise<TicketMutation>
}

export function useSupportTicketClient() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const losingAccess = useRef(false)
  const [accessLost, setAccessLost] = useState(false)
  const client = useMemo(() => {
    const transport: TicketTransport = async <T,>(path: string, options?: RequestInit): Promise<T> => {
      try {
        if (options?.method === 'POST') { await csrf(); return await requestWithTimeout<T>(path, options) }
        return await request<T>(path, options)
      } catch (caught) {
        if (caught instanceof ApiError && [401, 403].includes(caught.status) && !losingAccess.current) {
          losingAccess.current = true
          setAccessLost(true)
          if (caught.code === 'POLICY_CONSENT_REQUIRED') {
            void navigate('/settings/terms', { replace: true, state: { supportAccessLost: true } })
          } else {
            void logout().catch(() => undefined).finally(() => navigate('/login', { replace: true, state: { supportAccessLost: true } }))
          }
        }
        throw caught
      }
    }
    return {
      ...createTicketClient('logistics', transport),
      changeStatus: (id, input, key) => transport<TicketMutation>(`/api/v1/logistics/support-tickets/${id}/status`, {
        method: 'POST', body: JSON.stringify(input), headers: { 'Idempotency-Key': key },
      }),
    } satisfies LogisticsTicketClient
  }, [navigate, logout])
  return { client, accessLost }
}
