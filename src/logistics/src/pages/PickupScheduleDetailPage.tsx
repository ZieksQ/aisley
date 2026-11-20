import { PortalButton } from '@aisley/ui/portal'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FaArrowLeft } from 'react-icons/fa6'
import { Link, useParams } from 'react-router-dom'
import { ErrorNotice, StatusLabel } from '../components/PickupUi'
import { ApiError, request } from '../lib/api'
import { formatPhtDateTime } from '../lib/pickupSchedule'
import type { PickupScheduleDetail } from '../types/pickups'

export function PickupScheduleDetailPage() {
  const { scheduleId = '' } = useParams()
  const [schedule, setSchedule] = useState<PickupScheduleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)

  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      const result = await request<{ data: PickupScheduleDetail }>(`/api/v1/logistics/pickup-schedules/${scheduleId}`)
      if (current === generation.current) setSchedule(result.data)
    } catch (caught) {
      if (current !== generation.current) return
      if (caught instanceof ApiError && [401, 403, 404, 419].includes(caught.status)) setSchedule(null)
      setError(caught instanceof ApiError ? caught.message : 'Pickup schedule could not be loaded.')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [scheduleId])

  useEffect(() => {
    document.title = 'Pickup schedule | Aisley Logistics'
    setSchedule(null)
    void load()
    return () => { generation.current += 1 }
  }, [load])

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <Link className="portal-link inline-flex min-h-11 items-center gap-2 text-sm" to="/pickups">
      <FaArrowLeft aria-hidden="true" />Back to pickups
    </Link>
    {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {loading && !schedule ? <p className="mt-4 text-sm" role="status">Loading pickup schedule…</p> : null}
    {schedule ? <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="break-all text-xl font-semibold">{schedule.reference}</h2>
            <StatusLabel status={schedule.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{schedule.parcel_count} {schedule.parcel_count === 1 ? 'parcel' : 'parcels'} · {formatPhtDateTime(schedule.starts_at)} PHT</p>
          <p className="mt-1 break-words text-sm">Courier: {schedule.courier.name || schedule.courier.email || 'Assigned Courier'}</p>
        </div>
        <PortalButton isLoading={loading} onClick={() => void load()}>Refresh</PortalButton>
      </div>
      <div className="mt-4 space-y-4">
        {schedule.pickup_requests.map((pickup) => <section className="portal-section overflow-hidden" key={pickup.id}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="min-w-0">
              <h3 className="break-words font-semibold">{pickup.shop.name}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{pickup.orders.length} {pickup.orders.length === 1 ? 'parcel' : 'parcels'} in this schedule</p>
            </div>
            <Link className="portal-link inline-flex min-h-11 items-center text-sm" to={`/pickups/${pickup.id}`}>View pickup request</Link>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {pickup.orders.map((order) => <li className="px-4 py-3" key={order.id}>
              <p className="break-all font-medium">{order.reference}</p>
              <p className="mt-1 break-all text-xs text-slate-600 dark:text-slate-400">{order.waybill ? `Tracking ID ${order.waybill.reference}` : 'Waybill unavailable'}</p>
            </li>)}
          </ul>
        </section>)}
        {!schedule.pickup_requests.length ? <p className="text-sm text-slate-600 dark:text-slate-400">No parcels are linked to this schedule.</p> : null}
      </div>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Open a pickup request for waybills, Seller contact, or schedule changes.</p>
    </> : null}
  </div>
}
