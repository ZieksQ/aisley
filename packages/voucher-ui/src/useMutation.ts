import { useEffect, useRef, useState } from 'react'
import { denied, uncertain } from './model'
import type { Failure, Mutation, VoucherProps, Voucher } from './types'

export function useMutation(
  props: VoucherProps,
  onSuccess: (voucher: Voucher, action: string) => void,
  onDenied: () => void,
  accessLost = false,
) {
  const [pending, setPending] = useState<Mutation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Failure | null>(null)
  const active = useRef(true)
  const requestController = useRef<AbortController | null>(null)
  useEffect(() => {
    active.current = !accessLost
    if (accessLost) {
      requestController.current?.abort()
      setPending(null)
      setError(null)
      setBusy(false)
    }
    return () => {
      active.current = false
      requestController.current?.abort()
    }
  }, [accessLost])
  async function send(mutation: Mutation) {
    setBusy(true)
    setError(null)
    setPending(mutation)
    const controller = new AbortController()
    requestController.current = controller
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const result = await props.request<{ data: Voucher }>(mutation.path, {
        method: mutation.method,
        body: JSON.stringify(mutation.body),
        signal: controller.signal,
        headers: { 'Idempotency-Key': mutation.key },
      })
      if (!active.current) return
      setPending(null)
      onSuccess(result.data, mutation.action)
    } catch (cause) {
      if (!active.current) return
      const failure = cause as Failure
      if (denied(failure)) {
        setPending(null)
        setError(null)
        onDenied()
      } else {
        setError(failure)
        if (!uncertain(failure)) setPending(null)
      }
    } finally {
      clearTimeout(timer)
      if (active.current) setBusy(false)
    }
  }
  function run(
    action: string,
    id: string | null,
    body: Record<string, unknown>,
  ) {
    if (busy || pending) return
    void send({
      action,
      body,
      path: id
        ? `${props.prefix}/${id}/${action === 'save' ? 'draft' : action}`
        : props.prefix,
      key: crypto.randomUUID(),
      method: action === 'save' ? 'PUT' : 'POST',
    })
  }
  return {
    busy,
    pending,
    error,
    run,
    retry: () => {
      if (pending && !busy) void send(pending)
    },
  }
}
