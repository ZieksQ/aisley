import { ActionButton, manilaDate, panel } from './PickupUi'
import type { LinehaulTrip } from '../types/linehaulTrips'

export function LinehaulTripList({ trips, busy, onAction }: {
  trips: LinehaulTrip[]
  busy: boolean
  onAction: (trip: LinehaulTrip, action: 'release' | 'depart' | 'cancel') => void
}) {
  return (
    <section className={`${panel} mt-3 overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10">
        <h3 className="font-semibold">Active outbound trips</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Release a ready load to its driver. The driver records actual departure; confirm departure here only as an operational fallback.</p>
      </div>
      {trips.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">
        {trips.map((trip) => (
          <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" key={trip.id}>
            <div>
              <p className="font-medium">{trip.from_hub.name} → {trip.to_hub.name}{trip.direction === 'return' ? ' · Return' : ''}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{trip.truck.plate_number} · {trip.driver.name} · {trip.parcel_count}/{trip.capacity_snapshot} parcels</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{manilaDate(trip.scheduled_for)} · {trip.status.replaceAll('_', ' ')}</p>
              <p className="mt-1 text-xs">Stored lanes: {[...new Set(trip.parcels?.map((item) => item.sorting_assignment?.lane.code ?? 'Unknown legacy label'))].join(', ')}</p>
              {trip.released_for_departure_at ? <p className="mt-1 text-xs">Released to driver: {manilaDate(trip.released_for_departure_at)}</p> : null}
              {trip.courier_arrived_at ? <p className="mt-1 text-xs">Driver reported arrival: {manilaDate(trip.courier_arrived_at)}</p> : null}
              {trip.lane_blocked ? <p role="status" className="mt-1 text-sm">Departure blocked: {trip.parcels?.filter((item) => item.lane?.operational_state !== 'open').map((item) => item.lane?.blocking_reason ?? 'Source lane unavailable').join('; ')}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {trip.can_release ? <ActionButton className="border-[#2563EB]! bg-[#2563EB]! text-white hover:bg-[#1D4ED8]! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" disabled={busy || trip.lane_blocked} onClick={() => onAction(trip, 'release')}>Release to driver</ActionButton> : null}
              {trip.can_depart ? <ActionButton disabled={busy} onClick={() => onAction(trip, 'depart')}>Confirm departure</ActionButton> : null}
              {['pending_acceptance', 'scheduled'].includes(trip.status) ? <ActionButton disabled={busy} onClick={() => onAction(trip, 'cancel')}>Cancel</ActionButton> : null}
            </div>
          </li>
        ))}
      </ul> : <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No active outbound company-truck trips.</p>}
    </section>
  )
}
