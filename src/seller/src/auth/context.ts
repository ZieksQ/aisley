import { createContext } from 'react'
import type { LoginCredentials, SellerUser } from '../types/auth'

export type AuthContextValue = {
  seller: SellerUser | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  updateSeller: (seller: SellerUser) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
