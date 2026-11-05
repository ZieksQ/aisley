import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { fetchPolicyConsentStatus } from '../lib/policyConsent'
import { routePermission } from '../lib/routePermissions'
import { ApiError } from '../lib/api'
import { DashboardSkeleton } from '@aisley/ui/portal'

type ConsentState = 'checking' | 'allowed' | 'required' | 'error'

export function SessionRoute() {
  const { admin, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return null
  if (!admin) return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/login" />
  if (admin.setup_required && location.pathname !== '/setup') return <Navigate replace to="/setup" />
  return <Outlet />
}

export function ProtectedRoute() {
  const { admin, isLoading } = useAuth()
  const location = useLocation()
  const isConsentRoute = ['/policy-consent', '/settings/terms'].includes(location.pathname)
  const [consentState, setConsentState] = useState<ConsentState>('checking')
  const [consentError, setConsentError] = useState('')
  const consentKey = `${admin?.id ?? ''}:${isConsentRoute}`
  const [resolvedKey, setResolvedKey] = useState('')

  useEffect(() => {
    if (!admin || admin.setup_required || isConsentRoute) {
      setResolvedKey(consentKey)
      setConsentState('allowed')
      setConsentError('')
      return
    }

    let mounted = true
    setConsentState('checking')
    setConsentError('')

    fetchPolicyConsentStatus()
      .then((response) => {
        if (mounted) {
          setResolvedKey(consentKey)
          setConsentState(response.data.all_required_accepted ? 'allowed' : 'required')
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setResolvedKey(consentKey)
        setConsentState('error')
        setConsentError(error instanceof ApiError ? error.message : 'We could not verify policy consent.')
      })

    return () => { mounted = false }
  }, [admin, isConsentRoute, consentKey])

  if (isLoading) return null

  if (!admin) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  if (admin.setup_required) return <Navigate replace to="/setup" />
  const requiredPermission = routePermission(location.pathname)
  if (requiredPermission && !admin.permissions.includes(requiredPermission)) {
    return <section className="portal-page"><h2 className="text-2xl font-semibold">Access restricted</h2><p className="mt-3">You do not have permission to open this page.</p></section>
  }
  if (isConsentRoute) return <Outlet />

  if (resolvedKey !== consentKey || consentState === 'checking') return location.pathname === '/dashboard' ? <div className="portal-page"><DashboardSkeleton /></div> : null

  if (consentState === 'error') {
    return <section className="grid place-items-center bg-slate-50 p-6 text-center dark:bg-[#100914]"><div className="max-w-md"><p className="text-sm text-slate-600 dark:text-purple-100/70" role="alert">{consentError}</p><button className="mt-4 inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-white/15" onClick={() => window.location.reload()} type="button">Try again</button></div></section>
  }

  if (consentState === 'required') {
    return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/settings/terms" />
  }

  return <Outlet />
}
