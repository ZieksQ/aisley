import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from './api'

export function useOrderAccessError() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback((error: unknown) => {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      void logout().catch(() => undefined).finally(() => {
        navigate('/login', { replace: true, state: { from: location.pathname + location.search, notice: error.message } })
      })
      return true
    }
    return false
  }, [location.pathname, location.search, navigate, logout])
}

// One request at a time; refresh on return and every 30 seconds while visible.
export function useSellerOrders<T>(path: string) {
  const [result, setResult] = useState<{ path: string; data: T } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const accessError = useOrderAccessError()
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    async function load() {
      if (pending || controller.signal.aborted) return
      pending = true
      setLoading(true)
      try {
        const data = await apiRequest<T>(path, { signal: controller.signal })
        if (!controller.signal.aborted) {
          setResult({ path, data })
          setError('')
        }
      } catch (reason) {
        if (!controller.signal.aborted && !accessError(reason)) {
          if (reason instanceof ApiError && reason.status === 404) setResult(null)
          setError(reason instanceof ApiError && reason.status === 404
            ? 'This order or Shop is unavailable for your account.'
            : reason instanceof ApiError ? reason.message : 'Unable to refresh orders. Check your connection and try again.')
        }
      } finally {
        pending = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void load() }
    void load()
    const timer = window.setInterval(visibleRefresh, 30_000)
    window.addEventListener('focus', visibleRefresh)
    document.addEventListener('visibilitychange', visibleRefresh)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', visibleRefresh)
      document.removeEventListener('visibilitychange', visibleRefresh)
    }
  }, [path, revision, accessError])

  return { data: result?.path === path ? result.data : null, error, loading, refresh }
}
