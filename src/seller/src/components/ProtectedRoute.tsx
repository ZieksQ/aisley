import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { fetchPolicyConsentStatus } from '../lib/policyConsent'
import { DashboardSkeleton } from '@aisley/ui/portal'

type ConsentState = 'checking' | 'allowed' | 'required' | 'error'

export function SessionRoute() {
  const { seller, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return null
  if (!seller) return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/login" />
  return <Outlet />
}

export function ProtectedRoute() {
  const { seller, isLoading } = useAuth()
  const location = useLocation()
  const isConsentRoute = location.pathname === '/policy-consent'
  const [consentState, setConsentState] = useState<ConsentState>('checking')
  const [consentError, setConsentError] = useState('')
  const consentKey = `${seller?.id ?? ''}:${isConsentRoute}`
  const [resolvedKey, setResolvedKey] = useState('')

  useEffect(() => {
    if (!seller || isConsentRoute) {
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
  }, [seller, isConsentRoute, consentKey])

  if (isLoading) return null

  if (!seller) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  if (isConsentRoute) return <Outlet />

  if (resolvedKey !== consentKey || consentState === 'checking') return location.pathname === '/dashboard' ? <div className="portal-page"><DashboardSkeleton /></div> : null

  if (consentState === 'error') {
    return <section className="grid place-items-center bg-zinc-50 p-6 text-center dark:bg-[#101012]"><div className="max-w-md"><p className="text-sm text-zinc-600 dark:text-zinc-300" role="alert">{consentError}</p><button className="mt-4 inline-flex h-10 items-center rounded-lg border border-zinc-300 px-4 text-sm font-semibold dark:border-white/15" onClick={() => window.location.reload()} type="button">Try again</button></div></section>
  }

  if (consentState === 'required') {
    return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/policy-consent" />
  }

  return <Outlet />
}
