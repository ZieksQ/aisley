import { useCallback, useEffect, useRef, useState } from 'react'
import { SetupGuide, type SetupGuideSnapshot } from '@aisley/ui/portal'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'
import { fetchSetupGuide } from './api'
import { tasks } from './tasks'

export function DashboardSetupGuide({ refreshKey }: { refreshKey: number }) {
  const { seller, logout } = useAuth()
  const navigate = useNavigate()
  const logoutRef = useRef(logout)
  logoutRef.current = logout
  const [snapshot, setSnapshot] = useState<SetupGuideSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const denial = useCallback((caught: unknown) => {
    if (!(caught instanceof ApiError) || ![401, 403, 419].includes(caught.status)) return
    setSnapshot(null)
    if (caught.code === 'POLICY_CONSENT_REQUIRED') {
      navigate('/settings/terms', { replace: true, state: { from: '/dashboard' } })
    } else {
      void logoutRef.current().catch(() => undefined).finally(() => navigate('/login', { replace: true }))
    }
  }, [navigate])

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    setLoading(true)
    setError(false)
    fetchSetupGuide(signal)
      .then(value => { if (!controller.signal.aborted) setSnapshot(value) })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setError(true)
        denial(caught)
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [denial, refreshKey, retry])

  if (!seller) return null
  return <SetupGuide scope={`seller:${seller.id}`} snapshot={snapshot} tasks={tasks}
    loading={loading} error={error} onRetry={() => setRetry(value => value + 1)}
    renderLink={link => <Link to={link.to}>{link.label}</Link>} />
}
