"use client";

import { useCallback, useState } from 'react'
import { useAuth } from '@/components/auth/auth-provider'
import Link from 'next/link'
import { courierMessages, type CourierOrderContext } from "@/lib/courier-messages"
import { courierError, useCourierAccess } from "./use-courier-access"
import { useCourierRefresh } from "./use-courier-refresh"

export function CourierOrderContact({ orderId }: { orderId: string }) {
  const { auth } = useAuth()
  if (auth.status !== 'authenticated') return null
  return <AuthenticatedCourierContact key={`${auth.customer.id}:${orderId}`} orderId={orderId} />
}

function AuthenticatedCourierContact({ orderId }: { orderId: string }) {
  const [context, setContext] = useState<CourierOrderContext | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const accessError = useCourierAccess()
  const refresh = useCallback(async (signal: AbortSignal) => {
    try {
      const result = await courierMessages.context(orderId, signal)
      if (!signal.aborted) { setContext(result.data); setError('') }
    } catch (reason) {
      if (signal.aborted) return
      setContext(null)
      accessError(reason)
      setError(courierError(reason))
    }
  }, [orderId, accessError])
  useCourierRefresh(refresh, revision)

  const destination = context?.send_allowed
    ? `/courier-messages?order=${orderId}`
    : context?.conversation_id ? `/courier-messages?conversation=${context.conversation_id}` : null
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5" aria-label="Courier contact">
      <h3 className="font-semibold">Delivery Courier</h3>
      <p className="mt-2 text-sm text-zinc-600">
        {!context && !error
          ? 'Checking delivery availability…'
          : context?.send_allowed
            ? 'Coordinate delivery with the Courier who accepted this final-mile task.'
            : 'Messaging opens after final-mile acceptance and closes when the delivery relationship ends.'}
      </p>
      {error && <>
        <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>
        <button className="mt-2 min-h-11 text-sm underline focus-visible:outline-2" onClick={() => setRevision((value) => value + 1)} type="button">
          Check again
        </button>
      </>}
      {destination && (
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[#4C1268] underline underline-offset-4 focus-visible:outline-2" href={destination}>
          {context?.send_allowed ? 'Message delivery Courier' : 'View Courier conversation'}
        </Link>
      )}
    </section>
  )
}
