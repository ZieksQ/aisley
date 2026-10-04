import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { financeClient } from './client'
import type { PaymentProps } from './types'

export function useFinanceRead<T>(props: PaymentProps, path: string) {
  const client = useMemo(() => financeClient(props.prefix, props.request), [props.prefix, props.request])
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    const lost = () => {
      controller.abort()
      setData(null)
      setLoading(false)
      setError('Your Finance access changed. Reload after signing in again.')
    }
    window.addEventListener('finance-access-lost', lost)
    client.read<T>(path, controller.signal).then((result) => {
      if (!controller.signal.aborted) setData(result)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Finance data is unavailable.')
        if ([401, 403].includes((cause as { status?: number })?.status ?? 0)) window.dispatchEvent(new Event('finance-access-lost'))
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); window.removeEventListener('finance-access-lost', lost) }
  }, [client, path, revision])
  return { data, error, loading, reload, client }
}

export function usePaymentAction() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const keys = useRef(new Map<string, string>())
  const locked = useRef(false)
  async function act(identity: string, action: (key: string) => Promise<void>, success: string) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    setMessage('')
    const key = keys.current.get(identity) ?? crypto.randomUUID()
    keys.current.set(identity, key)
    try {
      await action(key)
      keys.current.delete(identity)
      setMessage(success)
    } catch (cause) {
      if ([401, 403].includes((cause as { status?: number })?.status ?? 0)) {
        keys.current.clear()
        window.dispatchEvent(new Event('finance-access-lost'))
      }
      setError(cause instanceof Error ? cause.message : 'Action was not confirmed. Retry the same selection safely.')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return { busy, message, error, act }
}

export function useUnsavedPaymentForm(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
    function beforeNavigate(event: MouseEvent) {
      const anchor = (event.target as Element)?.closest('a[href]') as HTMLAnchorElement | null
      if (anchor && anchor.href !== window.location.href && !window.confirm('Discard unsaved payment settings or form changes?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', beforeNavigate, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', beforeNavigate, true)
    }
  }, [dirty])
}
