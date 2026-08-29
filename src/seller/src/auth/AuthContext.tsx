import { useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { ApiError, apiRequest, initializeCsrf } from '../lib/api'
import type { AuthResponse, SellerUser } from '../types/auth'
import { AuthContext } from './context'
import type { AuthContextValue } from './context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [seller, setSeller] = useState<SellerUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    apiRequest<AuthResponse>('/api/v1/seller/auth/me')
      .then((response) => {
        if (isMounted) setSeller(response.seller)
      })
      .catch((error: unknown) => {
        if (isMounted && error instanceof ApiError && ![401, 403].includes(error.status)) {
          console.error('Unable to restore the Seller session.', error)
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
      seller,
      isLoading,
      login: async (credentials) => {
        await initializeCsrf()
        const response = await apiRequest<AuthResponse>('/api/v1/seller/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
        })
        setSeller(response.seller)
      },
      logout: async () => {
        try {
          await apiRequest('/api/v1/seller/auth/logout', { method: 'POST' })
        } finally {
          setSeller(null)
        }
      },
    }),
    [seller, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
