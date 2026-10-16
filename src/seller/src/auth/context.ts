import type { PasswordChangeSession } from "@aisley/ui/password-change"
import { createContext } from 'react'
import type { LoginCredentials, SellerUser } from '../types/auth'

export type AuthContextValue = { passwordSession: PasswordChangeSession;
  seller: SellerUser | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  updateSeller: (seller: SellerUser | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
