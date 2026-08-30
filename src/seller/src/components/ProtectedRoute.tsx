import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { LoadingScreen } from './LoadingScreen'

export function ProtectedRoute() {
  const { seller, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingScreen />

  if (!seller) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  return <Outlet />
}
