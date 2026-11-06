import { Navigate, useLocation } from 'react-router-dom'

export function LegacySettingsRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate replace to={`${to}${location.search}${location.hash}`} state={location.state} />
}
