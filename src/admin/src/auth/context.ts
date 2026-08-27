import { createContext } from 'react'
import type { AdminUser, LoginCredentials } from '../types/auth'

export type AuthContextValue = {
  admin: AdminUser | null
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
