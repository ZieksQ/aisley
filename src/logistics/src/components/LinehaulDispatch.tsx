import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaArrowsRotate, FaTruckFast } from 'react-icons/fa6'
import { FlatpickrInput } from './FlatpickrInput'
import { LinehaulOptionPicker } from './LinehaulOptionPicker'
import { ActionButton, ErrorNotice, PrimaryButton, field, manilaDate, panel } from './PickupUi'
import { ApiError, csrf, requestWithTimeout } from '../lib/api'
import { defaultLinehaulTime } from '../types/linehaulTrips'
import type { LinehaulLaneGroup, LinehaulOverview, LinehaulReadyParcel, LinehaulTrip } from '../types/linehaulTrips'

type DispatchLaneGroup = LinehaulLaneGroup & {
  key: string
  nextHubId: string
  nextHub: string
}

function laneLabel(group: DispatchLaneGroup): string {
  return group.lane_code ? `${group.lane_code} · ${group.lane_name ?? 'Unnamed lane'}` : 'Unassigned lane'
}

export function LinehaulDispatch() {
  const [overview, setOverview] = useState<LinehaulOverview | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [laneGroupKey, setLaneGroupKey] = useState('')
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
    setError('')
    try {
      const response = await requestWithTimeout<{ data: LinehaulOverview }>('/api/v1/logistics/linehaul/trips')
      setOverview(response.data)
      const availableIds = new Set(response.data.ready_groups.flatMap((destination) => destination.lane_groups.flatMap((lane) => lane.parcels.map((parcel) => parcel.shipment_id))))
      setSelected((current) => current.filter((id) => availableIds.has(id)))
      setTruckId((current) => response.data.trucks.some((item) => item.id === current) ? current : '')
      setDriverId((current) => response.data.drivers.some((item) => item.id === current) ? current : '')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Linehaul dispatch could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const laneGroups = useMemo<DispatchLaneGroup[]>(() => overview?.ready_groups.flatMap((destination) => destination.lane_groups.map((lane) => ({
    ...lane,
    key: `${destination.next_hub_id}:${lane.lane_id ?? 'unassigned'}`,
    nextHubId: destination.next_hub_id,
    nextHub: destination.next_hub,
  }))) ?? [], [overview])
  const parcels = useMemo(() => laneGroups.flatMap((group) => group.parcels), [laneGroups])
  const selectedParcel = parcels.find((parcel) => selected.includes(parcel.shipment_id))
  const selectedDestination = selectedParcel ? laneGroups.find((group) => group.parcels.some((parcel) => parcel.shipment_id === selectedParcel.shipment_id)) : undefined
  const visibleGroups = laneGroupKey ? laneGroups.filter((group) => group.key === laneGroupKey) : laneGroups
  const visibleDestinations = new Set(visibleGroups.map((group) => group.nextHubId))
  const truck = overview?.trucks.find((item) => item.id === truckId)
  const capacity = truck?.max_parcels ?? Number.POSITIVE_INFINITY
  const capacityExceeded = selected.length > capacity
  const active = useMemo(() => overview?.outbound.filter((trip) => ['pending_acceptance', 'scheduled', 'in_transfer'].includes(trip.status)) ?? [], [overview])
  const truckOptions = overview?.trucks.map((item) => ({ id: item.id, title: item.plate_number, description: [item.make, item.model].filter(Boolean).join(' ') || 'Company truck', detail: `${item.max_parcels} parcel capacity` })) ?? []
  const driverOptions = overview?.drivers.map((item) => ({ id: item.id, title: item.name, description: 'Approved company-truck driver' })) ?? []

  function canSelect(group: DispatchLaneGroup): boolean {
    return !selectedDestination || selectedDestination.nextHubId === group.nextHubId
  }

  function toggle(parcel: LinehaulReadyParcel, group: DispatchLaneGroup) {
    setSelected((current) => {
      if (current.includes(parcel.shipment_id)) return current.filter((id) => id !== parcel.shipment_id)
      if (!canSelect(group) || current.length >= capacity) return current
      return [...current, parcel.shipment_id]
    })
  }

  function toggleGroup(group: DispatchLaneGroup) {
    if (!canSelect(group)) return
    setSelected((current) => {
      const ids = group.parcels.map((parcel) => parcel.shipment_id)
      const allSelected = ids.every((id) => current.includes(id))
      if (allSelected) return current.filter((id) => !ids.includes(id))
      const additions = ids.filter((id) => !current.includes(id)).slice(0, Math.max(0, capacity - current.length))
      return [...current, ...additions]
    })
  }

  function toggleVisible() {
    const destinationId = selectedDestination?.nextHubId ?? (visibleDestinations.size === 1 ? visibleGroups[0]?.nextHubId : null)
    if (!destinationId) return
    const ids = visibleGroups.filter((group) => group.nextHubId === destinationId).flatMap((group) => group.parcels.map((parcel) => parcel.shipment_id))
    setSelected((current) => {
      const allSelected = ids.every((id) => current.includes(id))
      if (allSelected) return current.filter((id) => !ids.includes(id))
      const additions = ids.filter((id) => !current.includes(id)).slice(0, Math.max(0, capacity - current.length))
      return [...current, ...additions]
    })
  }

  async function schedule() {
    if (!selectedDestination || !truckId || !driverId || !scheduledFor || capacityExceeded) return
    const body = JSON.stringify({
      next_hub_id: selectedDestination.nextHubId,
      company_truck_id: truckId,
      driver_id: driverId,
      scheduled_for: new Date(scheduledFor.replace(' ', 'T')).toISOString(),
      shipment_ids: selected,
    })
    if (!window.confirm(`Send a ${selected.length}-parcel linehaul request to ${selectedDestination.nextHub}? The destination must approve before departure.`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await csrf()
      if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() }
      const response = await requestWithTimeout<{ data: LinehaulTrip }>('/api/v1/logistics/linehaul/trips', { method: 'POST', headers: { 'Idempotency-Key': pending.current.key }, body })
      pending.current = null
      setNotice(`${response.data.parcel_count} parcels reserved. Waiting for ${response.data.to_hub.name ?? 'the destination'} to approve.`)
      setSelected([])
      setTruckId('')
      setDriverId('')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The linehaul request could not be scheduled.')
    } finally {
      setBusy(false)
    }
  }

  async function act(trip: LinehaulTrip, action: 'depart' | 'cancel') {
    if (!window.confirm(action === 'depart' ? `Confirm the physical departure of ${trip.parcel_count} parcels?` : 'Cancel this pre-departure trip and release its reservations?')) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await csrf()
      await requestWithTimeout(`/api/v1/logistics/linehaul/trips/${trip.id}/${action}`, { method: 'POST', body: JSON.stringify({ expected_revision: trip.revision }) })
      setNotice(action === 'depart' ? 'Physical linehaul departure confirmed.' : 'Trip cancelled and reservations released.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The linehaul trip could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  const visibleSelectableParcels = visibleGroups.filter((group) => !selectedDestination || group.nextHubId === selectedDestination.nextHubId).flatMap((group) => group.parcels)
  const allVisibleSelected = visibleSelectableParcels.length > 0 && visibleSelectableParcels.every((parcel) => selected.includes(parcel.shipment_id))
  const canSelectVisible = Boolean(selectedDestination || visibleDestinations.size === 1)

  return <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-white/10"><div><div className="flex items-center gap-3"><FaTruckFast aria-hidden="true" className="text-[#4C1268] dark:text-purple-300" /><h2 className="text-xl font-semibold">Linehaul dispatch</h2></div><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Select sorted parcels across lane groups for one destination, then assign a company truck and qualified driver.</p></div><ActionButton busy={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton></div>
    {error ? <div className="mt-3"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice ? <p className="mt-3 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}

    <div className="mt-3 grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section aria-labelledby="available-linehaul-parcels" className={`${panel} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-3 dark:border-white/10"><div><h3 className="font-semibold" id="available-linehaul-parcels">Available for dispatch</h3><p className="mt-1 text-xs text-zinc-500">{parcels.length} parcels · {selected.length} selected{selectedDestination ? ` · ${selectedDestination.nextHub}` : ''}</p></div><ActionButton disabled={busy || loading || !visibleGroups.length || !canSelectVisible} onClick={toggleVisible}>{allVisibleSelected ? 'Clear visible' : 'Select all visible'}</ActionButton></div>
        <div className="border-b border-zinc-200 p-3 dark:border-white/10"><label className="block text-sm font-medium" htmlFor="linehaul-lane-group">Lane group<select className={`${field} mt-1`} id="linehaul-lane-group" onChange={(event) => setLaneGroupKey(event.target.value)} value={laneGroupKey}><option value="">All lane groups</option>{overview?.ready_groups.map((destination) => <optgroup key={destination.next_hub_id} label={destination.next_hub}>{destination.lane_groups.map((lane) => { const key = `${destination.next_hub_id}:${lane.lane_id ?? 'unassigned'}`; return <option key={key} value={key}>{lane.lane_code ?? 'Unassigned'} · {lane.lane_name ?? 'No lane'} · {lane.parcels.length}</option> })}</optgroup>)}</select></label>{!selectedDestination && visibleDestinations.size > 1 ? <p className="mt-2 text-xs text-zinc-500">Choose a lane group or one parcel first to set the destination before selecting all.</p> : null}</div>
        {loading ? <p className="p-4 text-sm">Loading available parcels…</p> : visibleGroups.length ? <div className="divide-y divide-zinc-200 dark:divide-white/10">{visibleGroups.map((group) => {
          const compatible = canSelect(group)
          const selectedInGroup = group.parcels.filter((parcel) => selected.includes(parcel.shipment_id)).length
          return <section aria-labelledby={`lane-${group.key}`} key={group.key}>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 px-3 py-2 dark:bg-white/[0.03]"><div><h4 className="text-sm font-semibold" id={`lane-${group.key}`}>{laneLabel(group)}</h4><p className="mt-0.5 text-xs text-zinc-500">To {group.nextHub} · {selectedInGroup}/{group.parcels.length} selected</p></div><button className="text-sm font-medium text-[#4C1268] disabled:cursor-not-allowed disabled:opacity-50 dark:text-purple-300" disabled={busy || !compatible} onClick={() => toggleGroup(group)} type="button">{selectedInGroup === group.parcels.length ? 'Clear group' : 'Select all'}</button></div>
            <ul className="divide-y divide-zinc-200 dark:divide-white/10">{group.parcels.map((parcel) => {
              const checked = selected.includes(parcel.shipment_id)
              const atCapacity = !checked && selected.length >= capacity
              return <li className={checked ? 'bg-purple-50/70 dark:bg-purple-400/10' : ''} key={parcel.shipment_id}><label className={`flex items-start gap-3 px-3 py-2.5 ${compatible && !atCapacity ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}><input checked={checked} className="mt-1 size-4 shrink-0 accent-[#4C1268]" disabled={busy || (!checked && (!compatible || atCapacity))} onChange={() => toggle(parcel, group)} type="checkbox" /><span className="min-w-0"><span className="block break-all font-medium">{parcel.parcel_reference ?? parcel.reference}</span><span className="mt-1 block break-all font-mono text-xs text-zinc-500">{parcel.reference}</span><span className="mt-1 block text-xs text-zinc-500">Received {parcel.received_at ? manilaDate(parcel.received_at) : 'time unavailable'}</span></span></label></li>
            })}</ul>
          </section>
        })}</div> : <p className="p-5 text-sm text-zinc-500">No sorted parcels are available for linehaul dispatch.</p>}
      </section>

      <aside className={`${panel} p-3 lg:sticky lg:top-20`}>
        <h3 className="font-semibold">Create linehaul request</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-500">The destination must approve this request before physical departure.</p>
        <div className="mt-3"><LinehaulOptionPicker disabled={busy || loading} emptyLabel="Choose an available truck" id="linehaul-truck" label="Company truck" modalDescription="Active company-owned trucks currently available at this hub." modalTitle="Choose a company truck" onChange={setTruckId} options={truckOptions} value={truckId} /></div>
        <div className="mt-3"><LinehaulOptionPicker disabled={busy || loading} emptyLabel="Choose a qualified driver" id="linehaul-driver" label="Qualified driver" modalDescription="Active, approved Couriers authorized to drive a company truck for this Logistics organization." modalTitle="Choose a qualified driver" onChange={setDriverId} options={driverOptions} value={driverId} /></div>
        <label className="mt-3 block text-sm font-medium">Departure schedule<FlatpickrInput className={`${field} mt-1`} value={scheduledFor} onChange={setScheduledFor} options={{ enableTime: true, time_24hr: true, dateFormat: 'Y-m-d H:i', minDate: 'today', minuteIncrement: 15 }} /></label>
        <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-zinc-200 py-3 text-sm dark:border-white/10"><div><dt className="text-xs text-zinc-500">Capacity</dt><dd className="mt-1 font-semibold">{truck?.max_parcels ?? '—'}</dd></div><div><dt className="text-xs text-zinc-500">Selected</dt><dd className="mt-1 font-semibold">{selected.length}</dd></div><div><dt className="text-xs text-zinc-500">Remaining</dt><dd className="mt-1 font-semibold">{truck ? Math.max(0, truck.max_parcels - selected.length) : '—'}</dd></div></dl>
        {capacityExceeded ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">Remove {selected.length - capacity} parcel{selected.length - capacity === 1 ? '' : 's'} or choose a larger truck.</p> : null}
        <PrimaryButton busy={busy} className="mt-3 w-full" disabled={!overview?.enabled || !selected.length || !selectedDestination || !truckId || !driverId || !scheduledFor || capacityExceeded} onClick={() => void schedule()}>Send request for {selected.length || ''} parcel{selected.length === 1 ? '' : 's'}</PrimaryButton>
      </aside>
    </div>

    <section className={`${panel} mt-3 overflow-hidden`}><div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Active outbound trips</h3></div>{active.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{active.map((trip) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" key={trip.id}><div><p className="font-medium">{trip.to_hub.name}</p><p className="mt-1 text-xs text-zinc-500">{trip.truck.plate_number} · {trip.driver.name} · {trip.parcel_count}/{trip.capacity_snapshot} parcels</p><p className="mt-1 text-xs text-zinc-500">{manilaDate(trip.scheduled_for)} · {trip.status.replaceAll('_', ' ')}</p></div><div className="flex gap-2">{trip.can_depart ? <PrimaryButton disabled={busy} onClick={() => void act(trip, 'depart')}>Confirm departure</PrimaryButton> : null}{['pending_acceptance', 'scheduled'].includes(trip.status) ? <ActionButton disabled={busy} onClick={() => void act(trip, 'cancel')}>Cancel</ActionButton> : null}</div></li>)}</ul> : <p className="p-4 text-sm text-zinc-500">No active outbound company-truck trips.</p>}</section>
  </div>
}
