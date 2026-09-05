import { createContext } from 'react'
import type { LoginCredentials, LogisticsUser } from '../types/auth'
export type AuthContextValue = { logistics: LogisticsUser | null; loading: boolean; login: (credentials: LoginCredentials) => Promise<void>; logout: () => Promise<void> }
export const AuthContext = createContext<AuthContextValue | null>(null)
