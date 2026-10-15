import { useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest, initializeCsrf } from '../../lib/api'
import { useOrderAccessError } from '../../lib/useSellerOrders'

type Pending = { path: string; method: string; body: string }

export function useInventoryMutation(
  onCommitted: () => void,
  onAccessLost: () => void,
) {
  const accessError = useOrderAccessError()
  const active = useRef(true)
  const locked = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [notice, setNotice] = useState('')
  const [path, setPath] = useState('')
  const [lastCommit, setLastCommit] = useState<{
    path: string
    sequence: number
  } | null>(null)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      controller.current?.abort()
    }
  }, [])

  async function send(request: Pending, success: string) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    setNotice('')
    setPath(request.path)
    const requestController = new AbortController()
    controller.current = requestController
    const timer = window.setTimeout(() => requestController.abort(), 15000)
    try {
      await initializeCsrf(requestController.signal)
      await apiRequest(request.path, {
        method: request.method,
        body: request.body,
        signal: requestController.signal,
      })
      if (!active.current) return
      setPending(null)
      setNotice(success)
      setLastCommit((current) => ({
        path: request.path,
        sequence: (current?.sequence ?? 0) + 1,
      }))
      onCommitted()
    } catch (cause) {
      if (!active.current) return
      if (accessError(cause)) {
        setPending(null)
        setError(null)
        onAccessLost()
        return
      }
      const failure = requestController.signal.aborted
        ? new Error(
            'The update was not confirmed before the connection timed out.',
          )
        : cause instanceof Error
          ? cause
          : new Error('The stock update could not be confirmed.')
      setError(failure)
      if (
        !(cause instanceof ApiError) ||
        cause.status >= 500 ||
        cause.status === 0
      )
        setPending(request)
      else setPending(null)
    } finally {
      window.clearTimeout(timer)
      locked.current = false
      if (active.current) setBusy(false)
    }
  }
  return { send, busy, pending, error, notice, path, lastCommit }
}
