import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'
import { fetchDashboard } from '../../lib/dashboard'
import type { DashboardData } from '../../types/dashboard'

export function useDashboard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let busy = false
    let recoveryBlocked = false
    async function load() {
      if (busy || controller.signal.aborted) return
      busy = true
      setLoading(true)
      setError(null)
      try {
        const response = await fetchDashboard(controller.signal)
        if (!controller.signal.aborted) { setData(response.data); setDenied(false) }
      } catch (caught) {
        if (controller.signal.aborted) return
        if (caught instanceof ApiError && caught.status === 429) recoveryBlocked = true
        if (caught instanceof ApiError && [401, 403].includes(caught.status)) {
          setData(null)
          setDenied(true)
          if (caught.status === 401) {
            void logout().catch(() => undefined).finally(() => navigate('/login', { replace: true }))
          } else if (caught.code === 'POLICY_CONSENT_REQUIRED') {
            navigate('/policy-consent', { replace: true, state: { from: '/dashboard' } })
          }
          setError(caught.message)
        } else {
          // Server/infrastructure failure is not an authorized successful snapshot.
          if (caught instanceof ApiError && caught.status >= 500) setData(null)
          setError(caught instanceof ApiError
            ? caught.status === 429 ? 'Too many requests. Wait before refreshing again.' : caught.message
            : navigator.onLine ? 'The dashboard could not be reached. Please retry.' : 'You are offline. Reconnect and refresh the dashboard.')
        }
      } finally {
        busy = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    // A throttled response requires an explicit later retry, not a focus/reconnect loop.
    const recover = () => { if (!recoveryBlocked && !document.hidden && navigator.onLine) void load() }
    window.addEventListener('focus', recover)
    window.addEventListener('online', recover)
    document.addEventListener('visibilitychange', recover)
    return () => {
      controller.abort()
      window.removeEventListener('focus', recover)
      window.removeEventListener('online', recover)
      document.removeEventListener('visibilitychange', recover)
    }
  }, [logout, navigate, revision])

  return { data, loading, error, denied, refresh }
}
