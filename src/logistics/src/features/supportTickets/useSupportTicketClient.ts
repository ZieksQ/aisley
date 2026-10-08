import { createTicketClient, type TicketTransport } from '@aisley/support-tickets'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, csrf, request, requestWithTimeout } from '../../lib/api'
import { useAuth } from '../../auth/useAuth'

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
    return createTicketClient('logistics', transport)
  }, [navigate, logout])
  return { client, accessLost }
}
