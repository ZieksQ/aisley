import type { PasswordChangeSession } from "@aisley/ui/password-change"
import { createContext } from 'react'
import type { LoginCredentials, LogisticsUser } from '../types/auth'
export type AuthContextValue = { passwordSession: PasswordChangeSession; logistics: LogisticsUser | null; loading: boolean; login: (credentials: LoginCredentials) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void> }
export const AuthContext = createContext<AuthContextValue | null>(null)
