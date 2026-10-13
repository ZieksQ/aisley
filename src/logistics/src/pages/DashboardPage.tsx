import { useCallback, useEffect, useState } from 'react'
import { LuRefreshCw, LuArrowRight } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../components/PickupUi'
import { DashboardQueueOverview } from '../components/DashboardQueueOverview'
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

  if (loading && !data && !queue) return <div className="portal-page" role="status" aria-label="Loading dashboard"><span className="sr-only">Loading dashboard</span><div className="h-24 animate-pulse rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)]" /></div>

  return <div className="portal-page">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="portal-page-heading">Hub overview</h2><p className="portal-secondary mt-1 text-sm">Shipments and pending actions at your operational hub.</p></div>
      <button className="portal-button" disabled={loading || queueLoading} onClick={() => void load()} type="button"><LuRefreshCw aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>

    {error ? <section className="mt-6"><ErrorNotice message={error} retry={() => void load()} /></section> : null}
    {data ? <section className="portal-panel mt-6"><h3 className="font-semibold">{data.hub.name}</h3><p className="portal-secondary mt-1 text-sm">{[data.hub.address.barangay, data.hub.address.city_municipality, data.hub.address.province, data.hub.address.region].filter(Boolean).join(', ') || 'Hub address unavailable'}</p>{error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">Showing the last loaded hub details.</p>}</section> : null}

    <section className="portal-panel mt-6" aria-busy={queueLoading}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Parcel records</h3><p className="portal-secondary mt-1 text-sm leading-6">Shipment, hub, task, and evidence records for this Logistics organization.</p></div><Link className="portal-button portal-button-primary" to="/operations">Search parcels <LuArrowRight aria-hidden="true" /></Link></div>
      {queueError ? <div className="mt-4"><ErrorNotice message={queueError} retry={() => void load()} /></div> : null}
      {queue ? <DashboardQueueOverview queue={queue} stale={Boolean(queueError || queueLoading)} /> : !queueLoading && !queueError ? <p className="portal-secondary mt-4 text-sm">The queue returned no data.</p> : null}
    </section>
  </div>
}
