import { Link, useNavigate } from 'react-router-dom'
import './linehaulTripList.css'
import { PortalButton, PortalState, PortalTable } from '@aisley/ui/portal'
import { manilaDate } from './PickupUi'
import type { LinehaulTrip } from '../types/linehaulTrips'

export function LinehaulTripList({
  trips,
  busy,
  onAction
}: {
  trips: LinehaulTrip[]
  busy: boolean
  onAction: (
    trip: LinehaulTrip,
    action: 'release' | 'depart' | 'cancel'
  ) => void
}) {
  const navigate = useNavigate()

  return (
    <section className="transport-panel linehaul-outbound-table mt-6">
      <div className="transport-toolbar">
        <div>
          <h2 className="font-semibold">Active outbound trips</h2>
          <p className="portal-secondary mt-1 text-sm">
            Release ready loads to their drivers. Drivers record actual
            departure.
          </p>
        </div>
      </div>
      {trips.length ? (
        <PortalTable label="Active outbound linehaul trips">
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Route / source lanes</th>
              <th scope="col">Truck / driver</th>
              <th scope="col" className="portal-number">Load</th>
              <th scope="col">Departure</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => {
              const destination = `/fleet-monitoring/${encodeURIComponent(trip.truck.id)}?${new URLSearchParams({ trip_id: trip.id })}#active-trip`
              return (
                <tr key={trip.id} data-href={destination} onClick={(event) => {
                  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  if ((event.target as HTMLElement).closest('a, button, input, select, textarea, [role="button"]')) return
                  if (window.getSelection()?.toString()) return
                  navigate(destination)
                }}>
                  <td>
                    <Link className="portal-link linehaul-trip-link" to={destination} aria-label={`Monitor trip: ${trip.from_hub.name} to ${trip.to_hub.name}, ${trip.truck.plate_number}`}>
                      {trip.from_hub.name} → {trip.to_hub.name}
                    </Link>
                    <p className="portal-secondary mt-1 text-xs">
                      {trip.direction === 'return' ? 'Return · ' : ''}Stored
                      lanes:{' '}
                      {[
                        ...new Set(
                          trip.parcels?.map(
                            (item) =>
                              item.sorting_assignment?.lane.code ??
                              'Unknown legacy label'
                          )
                        )
                      ].join(', ') || 'No cargo'}
                    </p>
                  </td>
                  <td>
                    <p className="font-medium">{trip.truck.plate_number}</p>
                    <p className="portal-secondary mt-1 text-xs">
                      {trip.driver.name}
                    </p>
                  </td>
                  <td className="portal-number">
                    {trip.parcel_count} / {trip.capacity_snapshot}
                  </td>
                  <td>
                    {manilaDate(trip.scheduled_for)}
                    {trip.released_for_departure_at && (
                      <p className="portal-secondary mt-2 text-xs">
                        Released to driver
                        <br />
                        {manilaDate(trip.released_for_departure_at)}
                      </p>
                    )}
                    {trip.courier_arrived_at && (
                      <p className="portal-secondary mt-2 text-xs">
                        Driver reported arrival
                        <br />
                        {manilaDate(trip.courier_arrived_at)}
                      </p>
                    )}
                  </td>
                  <td>
                    <span className="transport-status capitalize">
                      {trip.status.replaceAll('_', ' ')}
                    </span>
                    {trip.lane_blocked && (
                      <p role="status" className="mt-2 text-sm">
                        Departure blocked:{' '}
                        {trip.parcels
                          ?.filter(
                            (item) => item.lane?.operational_state !== 'open'
                          )
                          .map(
                            (item) =>
                              item.lane?.blocking_reason ??
                              'Source lane unavailable'
                          )
                          .join('; ')}
                      </p>
                    )}
                  </td>
                  <td className="linehaul-outbound-actions">
                    <div className="linehaul-trip-actions">
                      {trip.can_release && (
                        <PortalButton
                          variant="primary"
                          disabled={busy || trip.lane_blocked}
                          onClick={() => onAction(trip, 'release')}
                        >
                          Release to driver
                        </PortalButton>
                      )}
                      {trip.can_depart && (
                        <PortalButton
                          disabled={busy}
                          onClick={() => onAction(trip, 'depart')}
                        >
                          Confirm departure
                        </PortalButton>
                      )}
                      {['pending_acceptance', 'scheduled'].includes(
                        trip.status
                      ) && (
                        <PortalButton
                          disabled={busy}
                          onClick={() => onAction(trip, 'cancel')}
                        >
                          Cancel
                        </PortalButton>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </PortalTable>
      ) : (
        <PortalState
          title="No active outbound trips"
          description="Scheduled loads will appear here after you send a linehaul request."
        />
      )}
    </section>
  )
}
