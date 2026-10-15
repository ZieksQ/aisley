import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from './api'
import { useOrderAccessError } from './useSellerOrders'

export function useSellerRead<T>(path: string) {
  const { seller } = useAuth()
  const accessError = useOrderAccessError()
  const [result, setResult] = useState<{ identity: string; data: T } | null>(
    null,
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const request = useRef<AbortController | null>(null)
  const identity = `${seller?.id ?? 'signed-out'}:${path}`
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  const clear = useCallback(() => {
    request.current?.abort()
    setResult(null)
    setError('Your session or permissions changed. Sign in to continue.')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    void apiRequest<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ identity, data })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        if (accessError(cause)) setResult(null)
        else {
          if (cause instanceof ApiError && cause.status === 404) setResult(null)
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Unable to load this view. Check your connection and try again.',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, identity, revision, accessError])

  return {
    data: result?.identity === identity ? result.data : null,
    loading,
    error,
    refresh,
    clear,
  }
}
