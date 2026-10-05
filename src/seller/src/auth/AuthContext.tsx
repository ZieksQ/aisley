import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clearChatPrivateState } from '@aisley/chat-ui'
import type { PropsWithChildren } from 'react'
import { ApiError, apiRequest, initializeCsrf } from '../lib/api'
import type { AuthResponse, SellerUser } from '../types/auth'
import { AuthContext } from './context'
import type { AuthContextValue } from './context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [seller, setSeller] = useState<SellerUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const sellerId = useRef<string | null>(null)

  const adoptSeller = useCallback((next: SellerUser) => {
    if (sellerId.current && sellerId.current !== next.id) clearChatPrivateState()
    sellerId.current = next.id
    setSeller(next)
  }, [])

  useEffect(() => {
    let isMounted = true

    apiRequest<AuthResponse>('/api/v1/seller/auth/me')
      .then((response) => {
        if (isMounted) adoptSeller(response.seller)
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
  }, [adoptSeller])

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
        adoptSeller(response.seller)
      },
      logout: async () => {
        try {
          await apiRequest('/api/v1/seller/auth/logout', { method: 'POST' })
        } finally {
          clearChatPrivateState()
          sellerId.current = null
          setSeller(null)
        }
      },
      updateSeller: setSeller,
    }),
    [adoptSeller, seller, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
