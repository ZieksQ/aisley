import { useAuth } from '../auth/useAuth'
import { DashboardSkeleton } from '@aisley/ui/portal'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LuRefreshCw, LuArrowRight, LuMapPin } from 'react-icons/lu'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorNotice } from '../components/PickupUi'
import { DashboardQueueOverview } from '../components/DashboardQueueOverview'
import { ApiError, request } from '../lib/api'
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
  const { logistics } = useAuth()
  return logistics ? <DashboardOverview key={logistics.id} /> : null
}

function DashboardOverview() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const logoutRef = useRef(logout)
  logoutRef.current = logout
  const activeRequest = useRef<AbortController | null>(null)
  const [data, setData] = useState<Dashboard | null>(null)
  const [queue, setQueue] = useState<FulfillmentQueueResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [queueLoading, setQueueLoading] = useState(true)

  const load = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    setLoading(true)
    setQueueLoading(true)
    setError(null)
    setQueueError(null)

    const [hubResult, queueResult] = await Promise.allSettled([
      request<Dashboard>('/api/v1/logistics/dashboard', { signal, cache: 'no-store' }),
      request<FulfillmentQueueResponse>('/api/v1/logistics/dashboard/queue', { signal, cache: 'no-store' }),
    ])

    if (controller.signal.aborted) return
    const denial = [hubResult, queueResult].find((result) => result.status === 'rejected' && result.reason instanceof ApiError && [401, 403, 419].includes(result.reason.status))
    if (denial?.status === 'rejected') {
      setData(null)
      setQueue(null)
      setLoading(false)
      setQueueLoading(false)
      if (denial.reason.code === 'POLICY_CONSENT_REQUIRED') navigate('/settings/terms', { replace: true, state: { from: '/dashboard' } })
      else void logoutRef.current().catch(() => undefined).finally(() => navigate('/login', { replace: true }))
      return
    }

    if (hubResult.status === 'fulfilled') setData(hubResult.value)
    else setError(messageFor(hubResult.reason, 'We could not load the Logistics hub.'))

    if (queueResult.status === 'fulfilled') setQueue(queueResult.value)
    else setQueueError(messageFor(queueResult.reason, 'The operational queue could not be loaded.'))

    setLoading(false)
    setQueueLoading(false)
  }, [navigate])

  useEffect(() => {
    document.title = 'Dashboard | Aisley Logistics'
    void load()
    return () => activeRequest.current?.abort()
  }, [load])

  return <div className="portal-page dashboard-page">
    <div className="dashboard-heading">
      <div><h2 className="portal-page-heading">Operations overview</h2><p className="portal-secondary mt-1 text-sm">Shipments and pending actions at your operational hub.</p></div>
      <button className="portal-button" disabled={loading || queueLoading} onClick={() => void load()} type="button"><LuRefreshCw aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>

    {loading && !data && !queue ? <DashboardSkeleton className="mt-6" /> : null}
    {error ? <section className="mt-6"><ErrorNotice message={error} retry={() => void load()} /></section> : null}
    {data ? <div className="dashboard-hub-context"><span className="dashboard-context-icon" aria-hidden="true"><LuMapPin size={17} /></span><div><strong>{data.hub.name}</strong><p>{[data.hub.address.barangay, data.hub.address.city_municipality, data.hub.address.province].filter(Boolean).join(', ') || 'Hub address unavailable'}</p></div>{error && <span className="text-xs text-red-700 dark:text-red-300">Showing the last loaded hub details.</span>}</div> : null}

    {queueError ? <div className="mt-6"><ErrorNotice message={queueError} retry={() => void load()} /></div> : null}
    {queue ? <DashboardQueueOverview queue={queue} stale={Boolean(queueError || queueLoading)} /> : null}
    <section className="portal-panel mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Parcel records</h3><p className="portal-secondary mt-1 text-sm">Search tracking references and review custody, tasks, and evidence.</p></div><Link className="portal-button portal-button-primary" to="/operations">Search parcels <LuArrowRight aria-hidden="true" /></Link></div>
    </section>
  </div>
}
