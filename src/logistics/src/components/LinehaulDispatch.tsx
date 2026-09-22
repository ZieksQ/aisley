import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatpickrInput } from './FlatpickrInput'
import { ActionButton, ErrorNotice, PrimaryButton, field, manilaDate, panel } from './PickupUi'
import { ApiError, csrf, requestWithTimeout } from '../lib/api'
import { defaultLinehaulTime } from '../types/linehaulTrips'
import type { LinehaulOverview, LinehaulTrip } from '../types/linehaulTrips'

export function LinehaulDispatch() {
  const [overview, setOverview] = useState<LinehaulOverview | null>(null)
  const [groupId, setGroupId] = useState('')
  const [truckId, setTruckId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [scheduledFor, setScheduledFor] = useState(defaultLinehaulTime)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = useRef<{ body: string; key: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await requestWithTimeout<{ data: LinehaulOverview }>('/api/v1/logistics/linehaul/trips')
      setOverview(response.data)
      setGroupId((current) => response.data.ready_groups.some((item) => item.next_hub_id === current) ? current : '')
      setTruckId((current) => response.data.trucks.some((item) => item.id === current) ? current : '')
      setDriverId((current) => response.data.drivers.some((item) => item.id === current) ? current : '')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Linehaul dispatch could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  const group = overview?.ready_groups.find((item) => item.next_hub_id === groupId)
  const truck = overview?.trucks.find((item) => item.id === truckId)
  const reserved = Math.min(group?.references.length ?? 0, truck?.max_parcels ?? 0)

  async function schedule() {
    if (!groupId || !truckId || !driverId || !scheduledFor) return
    const body = JSON.stringify({ next_hub_id: groupId, company_truck_id: truckId, driver_id: driverId, scheduled_for: new Date(scheduledFor.replace(' ', 'T')).toISOString() })
    if (!window.confirm(`Send a ${reserved}-parcel linehaul request to ${group?.next_hub}? The destination must approve before departure.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() }
      const response = await requestWithTimeout<{ data: LinehaulTrip }>('/api/v1/logistics/linehaul/trips', { method: 'POST', headers: { 'Idempotency-Key': pending.current.key }, body })
      pending.current = null
      setNotice(`${response.data.parcel_count} parcels reserved. Waiting for ${response.data.to_hub.name ?? 'the destination'} to approve.`)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The linehaul request could not be scheduled.')
    } finally { setBusy(false) }
  }

  async function act(trip: LinehaulTrip, action: 'depart' | 'cancel') {
    if (!window.confirm(action === 'depart' ? `Confirm the physical departure of ${trip.parcel_count} parcels?` : 'Cancel this pre-departure trip and release its reservations?')) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await requestWithTimeout(`/api/v1/logistics/linehaul/trips/${trip.id}/${action}`, { method: 'POST', body: JSON.stringify({ expected_revision: trip.revision }) })
      setNotice(action === 'depart' ? 'Physical linehaul departure confirmed.' : 'Trip cancelled and reservations released.')
      await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The linehaul trip could not be updated.') }
    finally { setBusy(false) }
  }

  const active = useMemo(() => overview?.outbound.filter((trip) => ['pending_acceptance', 'scheduled', 'in_transfer'].includes(trip.status)) ?? [], [overview])

  return <section className={`${panel} mb-3 overflow-hidden`} aria-labelledby="linehaul-dispatch-title">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-white/10"><div><h3 className="font-semibold" id="linehaul-dispatch-title">Linehaul dispatch</h3><p className="mt-1 text-xs text-zinc-500">The server reserves parcels by destination Logistics, even when they are in different source lanes.</p></div><ActionButton busy={loading} onClick={() => void load()}>Refresh</ActionButton></div>
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
      <div className="grid content-start gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Destination group<select className={`${field} mt-1`} value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Choose ready parcels</option>{overview?.ready_groups.map((item) => <option key={item.next_hub_id} value={item.next_hub_id}>{item.next_hub} · {item.references.length} ready</option>)}</select></label>
        <label className="text-sm font-medium">Company truck<select className={`${field} mt-1`} value={truckId} onChange={(event) => setTruckId(event.target.value)}><option value="">Choose an available truck</option>{overview?.trucks.map((item) => <option key={item.id} value={item.id}>{item.plate_number} · {item.max_parcels} parcels</option>)}</select></label>
        <label className="text-sm font-medium">Qualified truck driver<select className={`${field} mt-1`} value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">Choose an eligible driver</option>{overview?.drivers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-medium">Departure schedule<FlatpickrInput className={`${field} mt-1`} value={scheduledFor} onChange={setScheduledFor} options={{ enableTime: true, time_24hr: true, dateFormat: 'Y-m-d H:i', minDate: 'today', minuteIncrement: 15 }} /></label>
        <div className="border border-zinc-200 p-3 text-sm dark:border-white/10 sm:col-span-2"><dl className="grid grid-cols-3 gap-3"><div><dt className="text-xs text-zinc-500">Truck capacity</dt><dd className="mt-1 font-semibold">{truck?.max_parcels ?? 0}</dd></div><div><dt className="text-xs text-zinc-500">Reserved load</dt><dd className="mt-1 font-semibold">{reserved}</dd></div><div><dt className="text-xs text-zinc-500">Remaining</dt><dd className="mt-1 font-semibold">{Math.max(0, (truck?.max_parcels ?? 0) - reserved)}</dd></div></dl>{group && truck && group.references.length > truck.max_parcels ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{group.references.length - truck.max_parcels} overflow parcels will remain ready for another trip.</p> : null}</div>
        <PrimaryButton busy={busy} className="sm:col-span-2" disabled={!overview?.enabled || !groupId || !truckId || !driverId || !scheduledFor || busy} onClick={() => void schedule()}>Send linehaul request</PrimaryButton>
      </div>
      <div><h4 className="text-sm font-semibold">Active outbound trips</h4>{active.length ? <ul className="mt-2 divide-y divide-zinc-200 border border-zinc-200 dark:divide-white/10 dark:border-white/10">{active.map((trip) => <li className="p-3 text-sm" key={trip.id}><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium">{trip.to_hub.name}</p><p className="mt-1 text-xs text-zinc-500">{trip.truck.plate_number} · {trip.driver.name} · {trip.parcel_count}/{trip.capacity_snapshot} parcels</p><p className="mt-1 text-xs text-zinc-500">{manilaDate(trip.scheduled_for)} · {trip.status.replaceAll('_', ' ')}</p></div><div className="flex gap-2">{trip.can_depart ? <PrimaryButton disabled={busy} onClick={() => void act(trip, 'depart')}>Confirm departure</PrimaryButton> : null}{['pending_acceptance', 'scheduled'].includes(trip.status) ? <ActionButton disabled={busy} onClick={() => void act(trip, 'cancel')}>Cancel</ActionButton> : null}</div></div></li>)}</ul> : <p className="mt-2 border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-white/15">No active outbound company-truck trips.</p>}</div>
    </div>
    {error ? <div className="px-4 pb-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}{notice ? <p className="px-4 pb-4 text-sm text-emerald-700 dark:text-emerald-300" role="status">{notice}</p> : null}
  </section>
}
