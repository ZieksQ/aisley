import { useCallback, useEffect, useState } from 'react'
import { FaArrowsRotate, FaArrowRight } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ErrorNotice, panel } from '../components/PickupUi'
import { ApiError, request, requestWithTimeout } from '../lib/api'
import type { FulfillmentQueueResponse } from '../types/fulfillment'

type Dashboard = {
  hub: {
    id: string
    name: string
    address: {
      barangay: string | null
      city_municipality: string | null
      province: string | null
      region: string | null
    }
  }
  summary: null
  orders: unknown[]
  freshness: { generated_at: string; state: 'scaffold' | string }
}

function messageFor(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [queue, setQueue] = useState<FulfillmentQueueResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [queueLoading, setQueueLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setQueueLoading(true)
    setError(null)
    setQueueError(null)

    const [hubResult, queueResult] = await Promise.allSettled([
      request<Dashboard>('/api/v1/logistics/dashboard'),
      requestWithTimeout<FulfillmentQueueResponse>('/api/v1/logistics/dashboard/queue'),
    ])

    if (hubResult.status === 'fulfilled') setData(hubResult.value)
    else setError(messageFor(hubResult.reason, 'We could not load the Logistics hub.'))

    if (queueResult.status === 'fulfilled') setQueue(queueResult.value)
    else setQueueError(messageFor(queueResult.reason, 'The operational queue could not be loaded.'))

    setLoading(false)
    setQueueLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) return <div className="p-6"><div className="h-24 animate-pulse border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" /></div>

  return <div className="max-w-5xl p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Dashboard</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">A secure starting point for your sole operational hub.</p></div>
      <button className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/10" onClick={() => void load()} type="button"><FaArrowsRotate aria-hidden="true" /> Refresh</button>
    </div>

    {error ? <section className="mt-6"><ErrorNotice message={error} retry={() => void load()} /></section> : null}
    {data ? <section className={`${panel} mt-6 p-5`}><h3 className="font-semibold">{data.hub.name}</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{[data.hub.address.barangay, data.hub.address.city_municipality, data.hub.address.province, data.hub.address.region].filter(Boolean).join(', ') || 'Hub address unavailable'}</p></section> : null}

    <section className={`${panel} mt-4 p-5`} aria-busy={queueLoading}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Operational queue</h3><p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Authoritative Shipment, hub, task, and evidence work for this Logistics organization.</p></div><Link className="inline-flex h-10 items-center gap-2 rounded-md border border-[#4C1268] px-3 text-sm font-medium text-[#4C1268] hover:bg-purple-50 dark:border-purple-300 dark:text-purple-200 dark:hover:bg-purple-400/10" to="/operations">Open hub operations <FaArrowRight aria-hidden="true" /></Link></div>
      {queueError ? <div className="mt-4"><ErrorNotice message={queueError} retry={() => void load()} /></div> : null}
      {queue ? <>
        <dl className="mt-5 grid gap-4 border-y border-zinc-200 py-4 text-sm dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-zinc-500">Active shipments</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{queue.summary.total}</dd></div><div><dt className="text-zinc-500">Evidence pending</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{queue.summary.pending_evidence}</dd></div><div><dt className="text-zinc-500">Completion intents</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{queue.summary.pending_completion}</dd></div><div><dt className="text-zinc-500">Out for delivery</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{queue.summary.by_status.out_for_delivery ?? 0}</dd></div></dl>
        {queue.data.length ? <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{queue.data.length} record{queue.data.length === 1 ? '' : 's'} on the first page. Open hub operations to review transitions, evidence, and final-mile offers.</p> : <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">No authoritative fulfillment records are currently available for this hub.</p>}
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">Last checked {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(queue.freshness.generated_at))}. Counts are scoped to this organization and hub.</p>
      </> : !queueLoading && !queueError ? <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">The queue returned no data.</p> : null}
    </section>
  </div>
}
