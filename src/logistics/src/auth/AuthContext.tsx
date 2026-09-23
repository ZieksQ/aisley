import { clearReceivingSession, offlineReceivingSession, rememberReceivingSession } from '../features/linehaulReceiving/offlineSession'
import { clearLinehaulReceiving } from '../features/linehaulReceiving/db'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { ApiError, csrf, request } from '../lib/api'
import { clearParcelSearchCache } from '../lib/parcelSearchDb'
import { sortingDb } from '../lib/sortingDb'
import type { AuthResponse, LogisticsUser } from '../types/auth'
import { AuthContext } from './context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [logistics, setLogistics] = useState<LogisticsUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await request<AuthResponse>('/api/v1/logistics/auth/me')
    rememberReceivingSession(data.logistics)
    setLogistics(data.logistics)
  }, [])

  useEffect(() => {
    let mounted = true
    refresh().catch((error: unknown) => {
      const offline = offlineReceivingSession()
      if (offline) setLogistics(offline)
      if (error instanceof ApiError && [401, 403].includes(error.status)) clearReceivingSession()
      if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) console.error('Unable to restore Logistics session.', error)
    }).finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [refresh])

  const value = useMemo(() => ({
    logistics,
    loading,
    refresh,
    login: async (credentials: { email: string; password: string; remember: boolean }) => {
      await csrf()
      const data = await request<AuthResponse>('/api/v1/logistics/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
      rememberReceivingSession(data.logistics)
      setLogistics(data.logistics)
    },
    logout: async () => {
      try { await request('/api/v1/logistics/auth/logout', { method: 'POST' }) } finally {
        await Promise.all([
          clearLinehaulReceiving().catch(() => undefined),
          sortingDb.captures.clear().catch(() => undefined),
          clearParcelSearchCache().catch(() => undefined),
        ])
        clearReceivingSession()
        setLogistics(null)
      }
    },
  }), [logistics, loading, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
