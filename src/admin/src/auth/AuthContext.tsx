import { useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { ApiError, apiRequest, initializeCsrf } from '../lib/api'
import type { AdminUser, AuthResponse } from '../types/auth'
import { AuthContext } from './context'
import type { AuthContextValue } from './context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    apiRequest<AuthResponse>('/api/v1/admin/auth/me')
      .then((response) => {
        if (isMounted) setAdmin(response.admin)
      })
      .catch((error: unknown) => {
        if (isMounted && error instanceof ApiError && error.status !== 401) {
          console.error('Unable to restore the administrator session.', error)
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      admin,
      isLoading,
      login: async (credentials) => {
        await initializeCsrf()
        const response = await apiRequest<AuthResponse>('/api/v1/admin/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        })
        setAdmin(response.admin)
      },
      logout: async () => {
        try {
          await apiRequest('/api/v1/admin/auth/logout', { method: 'POST' })
        } finally {
          setAdmin(null)
        }
      },
      updateAdmin: setAdmin,
    }),
    [admin, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
