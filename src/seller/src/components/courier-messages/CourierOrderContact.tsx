import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { courierMessages, type CourierOrderContext } from '../../lib/courierMessages'
import { courierError, useCourierAccess } from './useCourierAccess'
import { useCourierRefresh } from './useCourierRefresh'

export function CourierOrderContact({ orderId }: { orderId: string }) {
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
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#171719]" aria-label="Courier contact">
      <h3 className="font-semibold">Pickup Courier</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {!context && !error
          ? 'Checking pickup availability…'
          : context?.send_allowed
            ? 'Coordinate pickup with the Courier who accepted this task.'
            : 'Messaging opens after the Courier accepts this first-mile pickup and closes at handoff.'}
      </p>
      {error && <>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>
        <button className="mt-2 min-h-11 text-sm underline focus-visible:outline-2" onClick={() => setRevision((value) => value + 1)} type="button">
          Check again
        </button>
      </>}
      {destination && (
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[#4C1268] underline underline-offset-4 focus-visible:outline-2 dark:text-[#e5bdf6]" to={destination}>
          {context?.send_allowed ? 'Message pickup Courier' : 'View Courier conversation'}
        </Link>
      )}
    </section>
  )
}
