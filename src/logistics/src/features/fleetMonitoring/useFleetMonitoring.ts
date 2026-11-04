import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'
import type { Meta } from './types'

type State<T> = { key: string; data: T | null; loading: boolean; error: string; missing: boolean }

export function useFleetMonitoring<T extends { meta: Meta }>(resource: string, load: () => Promise<T>) {
  const { logistics, logout } = useAuth()
  const navigate = useNavigate()
  const key = `${logistics?.id ?? ''}:${resource}`
  const [state, setState] = useState<State<T>>({ key, data: null, loading: true, error: '', missing: false })
  const refresh = useRef<() => void>(() => undefined)

  useEffect(() => {
    let disposed = false
    let inFlight = false
    let revoked = false
    setState({ key, data: null, loading: true, error: '', missing: false })
    async function read() {
      if (disposed || inFlight || revoked || !logistics?.id) return
      inFlight = true
      setState((previous) => ({ ...previous, loading: true }))
      try {
        const data = await load()
        if (!disposed) setState({ key, data, loading: false, error: '', missing: false })
      } catch (caught) {
        if (disposed) return
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 403)) {
          revoked = true
          setState({ key, data: null, loading: false, error: caught.message, missing: false })
          if (caught.code === 'POLICY_CONSENT_REQUIRED') navigate('/policy-consent', { replace: true })
          else {
            await logout().catch(() => undefined)
            if (!disposed) navigate('/login', { replace: true })
          }
          return
        }
        const missing = caught instanceof ApiError && caught.status === 404
        setState((previous) => ({
          key, data: missing ? null : previous.data, loading: false, missing,
          error: caught instanceof Error ? caught.message : 'Fleet monitoring could not be refreshed.',
        }))
      } finally { inFlight = false }
    }
    const run = () => { void read() }
    refresh.current = run
    const visible = () => { if (document.visibilityState === 'visible') run() }
    const interval = window.setInterval(visible, 30_000)
    document.addEventListener('visibilitychange', visible)
    run()
    return () => {
      disposed = true
      refresh.current = () => undefined
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [key, load, logistics?.id, logout, navigate])

  return {
    ...(state.key === key ? state : { data: null, loading: true, error: '', missing: false }),
    refresh: () => refresh.current(),
  }
}
