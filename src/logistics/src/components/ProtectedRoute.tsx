import { DashboardSkeleton } from '@aisley/ui/portal'
import { offlineReceivingSession, rememberReceivingConsent } from '../features/linehaulReceiving/offlineSession'
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { fetchPolicyConsentStatus } from '../lib/policyConsent'

type ConsentState = 'checking' | 'allowed' | 'required' | 'error'

export function SessionRoute() {
  const { logistics, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!logistics) return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/login" />
  return <Outlet />
}

export function ProtectedRoute() {
  const { logistics, loading } = useAuth()
  const location = useLocation()
  const isConsentRoute = location.pathname === '/policy-consent' || location.pathname === '/settings/terms'
  const [consentState, setConsentState] = useState<ConsentState>('checking')
  const [consentError, setConsentError] = useState('')
  const offlineIdentity = offlineReceivingSession()?.id ?? ''
  const consentKey = `${logistics?.id ?? ''}:${isConsentRoute}:${offlineIdentity}`
  const [resolvedKey, setResolvedKey] = useState('')

  useEffect(() => {
    if (!logistics || isConsentRoute) {
      setResolvedKey(consentKey)
      setConsentState('allowed')
      setConsentError('')
      return
    }

    let mounted = true
    setConsentState('checking')
    setConsentError('')

    if (offlineIdentity === logistics.id) {
      setResolvedKey(consentKey)
      setConsentState('allowed')
      return
    }

    fetchPolicyConsentStatus()
      .then((response) => {
        if (mounted) {
          setResolvedKey(consentKey)
          rememberReceivingConsent(logistics.id, response.data.all_required_accepted)
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
  }, [logistics, isConsentRoute, consentKey, offlineIdentity])

  if (loading) return null
  if (!logistics) return <Navigate replace state={{ from: location.pathname }} to="/login" />
  if (isConsentRoute) return <Outlet />
  if (resolvedKey !== consentKey || consentState === 'checking') return location.pathname === '/dashboard' ? <div className="portal-page"><DashboardSkeleton /></div> : null
  if (consentState === 'error') return <section className="grid place-items-center bg-[#f7f7f8] p-6 text-center text-zinc-950 dark:bg-[#101012] dark:text-white"><div className="max-w-md"><p className="text-sm text-zinc-600 dark:text-zinc-300" role="alert">{consentError}</p><button className="mt-4 inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-semibold dark:border-white/15" onClick={() => window.location.reload()} type="button">Try again</button></div></section>
  if (consentState === 'required') return <Navigate replace state={{ from: `${location.pathname}${location.search}` }} to="/settings/terms" />
  return <Outlet />
}
