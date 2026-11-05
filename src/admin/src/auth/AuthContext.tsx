import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { ApiError, apiRequest, initializeCsrf } from '../lib/api'
import type { AdminUser, AuthResponse } from '../types/auth'
import { AuthContext } from './context'
import type { AuthContextValue } from './context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const epoch = useRef(0)
  const mounted = useRef(true)
  const refreshSequence = useRef(0)
  const refreshAdmin = useCallback(async () => {
    const generation = epoch.current
    const sequence = ++refreshSequence.current
    try {
      const response = await apiRequest<AuthResponse>('/api/v1/admin/auth/me')
      if (mounted.current && generation === epoch.current && sequence === refreshSequence.current)
        setAdmin(response.admin)
    } catch (error) {
      if (
        mounted.current &&
        generation === epoch.current &&
        sequence === refreshSequence.current &&
        error instanceof ApiError &&
        [401, 403].includes(error.status)
      )
        setAdmin(null)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void refreshAdmin().finally(() => {
      if (mounted.current) setIsLoading(false)
    })
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshAdmin()
    }
    window.addEventListener('admin:authorization-changed', refresh)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 60000)
    const invalidate = () => {
      mounted.current = false
      epoch.current++
    }
    return () => {
      invalidate()
      window.removeEventListener('admin:authorization-changed', refresh)
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [refreshAdmin])

  const value = useMemo<AuthContextValue>(
    () => ({
      admin,
      isLoading,
      refreshAdmin,
      login: async (credentials) => {
        const generation = ++epoch.current
        await initializeCsrf()
        const response = await apiRequest<AuthResponse>('/api/v1/admin/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        })
        if (mounted.current && generation === epoch.current) setAdmin(response.admin)
      },
      logout: async () => {
        epoch.current++
        try {
          await apiRequest('/api/v1/admin/auth/logout', { method: 'POST' })
        } finally {
          if (mounted.current) setAdmin(null)
        }
      },
      updateAdmin: (updated) => {
        epoch.current++
        setAdmin(updated)
      },
    }),
    [admin, isLoading, refreshAdmin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
