import { PortalState, PortalTable } from '@aisley/ui/portal'
import { Link } from 'react-router-dom'
import { TripStatus } from './TripDetails'
import { availabilityLabels, manilaTime } from './types'
import type { MonitoringTrip, MonitoringTruck } from './types'

export function MonitoringTrucks({ trucks, query }: { trucks: MonitoringTruck[]; query: string }) {
  if (!trucks.length) {
    return <PortalState title="No matching trucks" description="Try different filters, or register a truck in Company fleet." />
  }

  return (
    <div className="[&_table]:min-w-[960px]">
      <PortalTable label="Fleet monitoring trucks">
        <thead>
          <tr>
            <th scope="col">Truck</th>
            <th scope="col">Status / location</th>
            <th scope="col">Assignment</th>
            <th scope="col">Scheduled departure · Manila</th>
            <th scope="col" className="text-right">Parcel capacity</th>
          </tr>
        </thead>
        <tbody>
          {trucks.map((truck) => (
            <tr key={truck.id}>
              <td>
                <Link
                  className="portal-link inline-flex min-h-11 items-center font-medium underline"
                  to={`/fleet-monitoring/${truck.id}${query ? `?${query}` : ''}`}
                >
                  {truck.plate_number}
                </Link>
                <div>
                  <Link className="portal-button" to={`/fleet-monitoring/${truck.id}/history?${query}`}>Past transfers</Link>
                </div>
                <span className="portal-table-meta">
                  {[truck.make, truck.model].filter(Boolean).join(' ') || 'Make/model not set'}
                </span>
              </td>
              <td>
                <span className={`portal-tag ${truck.availability === 'available' ? 'portal-tag-success' : ''}`}>
                  {availabilityLabels[truck.availability]}
                </span>
                <span className="portal-table-meta">
                  Last confirmed: {truck.last_confirmed_hub?.name ?? 'Unavailable'}
                </span>
                {truck.availability === 'in_transit' && truck.active_trip ? (
                  <span className="portal-table-meta">
                    In transit: {truck.active_trip.from_hub?.name ?? 'Unknown hub'} → {truck.active_trip.to_hub?.name ?? 'Unknown hub'}
                  </span>
                ) : null}
              </td>
              <td>
                {truck.active_trip ? (
                  <>
                    <p>Outbound: {truck.active_trip.from_hub?.logistics?.name ?? 'Organization unavailable'} · {truck.active_trip.from_hub?.name ?? 'Unknown hub'}</p>
                    <p>Inbound: {truck.active_trip.to_hub?.logistics?.name ?? 'Organization unavailable'} · {truck.active_trip.to_hub?.name ?? 'Unknown hub'}</p>
                    <span className="portal-table-meta">
                      {truck.active_trip.driver?.name ?? 'Driver unavailable'} · {truck.active_trip.direction === 'return' ? 'Return' : 'Outbound'}
                    </span>
                  </>
                ) : <span className="portal-secondary">No active trip</span>}
              </td>
              <td>
                {truck.active_trip ? (
                  <div className="space-y-2">
                    <p>{manilaTime(truck.active_trip.scheduled_for)}</p>
                    <TripStatus trip={truck.active_trip} />
                  </div>
                ) : '—'}
              </td>
              <td className="text-right tabular-nums">
                <p className="font-medium">{truck.reserved_or_onboard_parcels} / {truck.max_parcels}</p>
                <span className="portal-table-meta">{truck.remaining_capacity} remaining</span>
              </td>
            </tr>
          ))}
        </tbody>
      </PortalTable>
    </div>
  )
}

export function MonitoringHistoryTable({ trips, truckId, query }: { trips: MonitoringTrip[]; truckId: string; query: string }) {
  if (!trips.length) {
    return <PortalState title="No past transfers" description="Completed, cancelled and rejected transfers will appear here." />
  }

  return (
    <div className="[&_table]:min-w-[960px]">
      <PortalTable label="Truck trip history">
        <thead>
          <tr>
            <th scope="col">Route</th>
            <th scope="col">Driver</th>
            <th scope="col">Scheduled departure · Manila</th>
            <th scope="col">Trip status</th>
            <th scope="col" className="text-right">Parcels / capacity</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr key={trip.id}>
              <td>
                <p>Outbound: {trip.from_hub?.name ?? 'Unknown hub'}</p>
                <p>Inbound: {trip.to_hub?.name ?? 'Unknown hub'}</p>
                <span className="portal-table-meta">
                  {trip.direction === 'return' ? 'Return' : 'Outbound'}
                  {trip.direction === 'return' && trip.parcel_count === 0 ? ' · Empty' : ''}
                </span>
              </td>
              <td>{trip.driver?.name ?? 'Unavailable'}</td>
              <td>{manilaTime(trip.scheduled_for)}</td>
              <td><TripStatus trip={trip} /></td>
              <td className="text-right tabular-nums">{trip.parcel_count} / {trip.capacity_snapshot}</td>
              <td>
                <Link className="portal-button" to={`/fleet-monitoring/${truckId}/history/${trip.id}?${query}`}>
                  View transfer<span className="sr-only"> {trip.id}</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </PortalTable>
    </div>
  )
}
