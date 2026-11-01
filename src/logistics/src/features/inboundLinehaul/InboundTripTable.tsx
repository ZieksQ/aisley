import { Link } from 'react-router-dom'
import { PortalButton, PortalState, PortalTable } from '@aisley/ui/portal'
import { manilaDate } from '../../components/PickupUi'
import type { LinehaulTrip } from '../../types/linehaulTrips'

export type InboundView = 'requests' | 'arriving' | 'receiving' | 'visitors'

export function InboundTripTable({
  trips,
  view,
  busy,
  onApprove,
  onReject,
  onReceive,
  onReturn
}: {
  trips: LinehaulTrip[]
  view: InboundView
  busy: boolean
  onApprove: (trip: LinehaulTrip) => void
  onReject: (trip: LinehaulTrip) => void
  onReceive: (trip: LinehaulTrip) => void
  onReturn: (trip: LinehaulTrip, empty: boolean) => void
}) {
  if (!trips.length)
    return (
      <PortalState
        title={
          {
            requests: 'No requests awaiting approval',
            arriving: 'No trips awaiting receipt',
            receiving: 'No receiving trips',
            visitors: 'No visiting trucks ready to return'
          }[view]
        }
        description="Refresh to check for updates from your connected hubs."
      />
    )
  return (
    <PortalTable label={`Linehaul inbound ${view}`}>
      <thead>
        <tr>
          <th scope="col">Origin hub</th>
          <th scope="col">Truck / driver</th>
          <th scope="col">Load</th>
          <th scope="col">
            {view === 'receiving' ? 'Status' : 'Scheduled departure'}
          </th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {trips.map((trip) => (
          <tr key={trip.id}>
            <td>
              <p className="font-medium">{trip.from_hub.name}</p>
              <p className="portal-secondary mt-1 text-xs">
                To {trip.to_hub.name}
              </p>
            </td>
            <td>
              <p className="font-medium">{trip.truck.plate_number}</p>
              <p className="portal-secondary mt-1 text-xs">
                {trip.driver.name}
              </p>
            </td>
            <td>
              {trip.empty_return
                ? 'Empty return'
                : `${trip.parcel_count} parcels`}
            </td>
            <td>
              {view === 'receiving' ? (
                <span className="transport-status">
                  {trip.status === 'receiving'
                    ? 'Unloading'
                    : 'Unloading complete'}
                </span>
              ) : (
                manilaDate(trip.scheduled_for)
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
              <div className="portal-inline-actions">
                {view === 'requests' && (
                  <>
                    <PortalButton
                      variant="primary"
                      disabled={busy || !navigator.onLine}
                      onClick={() => onApprove(trip)}
                    >
                      Approve
                    </PortalButton>
                    <PortalButton
                      disabled={busy || !navigator.onLine}
                      onClick={() => onReject(trip)}
                    >
                      Reject
                    </PortalButton>
                  </>
                )}
                {view === 'arriving' && (
                  <PortalButton
                    variant="primary"
                    disabled={busy || !navigator.onLine}
                    onClick={() => onReceive(trip)}
                  >
                    {trip.empty_return ? 'Confirm arrival' : 'Start receiving'}
                  </PortalButton>
                )}
                {view === 'receiving' && (
                  <Link to={`/inbound-linehaul?view=receiving&trip=${trip.id}`}>
                    Review receipt and discrepancies
                  </Link>
                )}
                {view === 'visitors' && (
                  <>
                    <PortalButton
                      variant="primary"
                      disabled={busy || !navigator.onLine}
                      onClick={() => onReturn(trip, false)}
                    >
                      Schedule with return cargo
                    </PortalButton>
                    <PortalButton
                      disabled={busy || !navigator.onLine}
                      onClick={() => onReturn(trip, true)}
                    >
                      Schedule empty return
                    </PortalButton>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </PortalTable>
  )
}
