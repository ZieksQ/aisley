import { useCallback, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { loadPastTransfer, loadTruck } from '../features/fleetMonitoring/api'
import { MonitoringRefresh } from '../features/fleetMonitoring/MonitoringRefresh'
import { TripRouteDetails } from '../features/fleetMonitoring/TripRouteDetails'
import { TripStatus, TripTimeline } from '../features/fleetMonitoring/TripDetails'
import { availabilityLabels, manilaTime } from '../features/fleetMonitoring/types'
import { useFleetMonitoring } from '../features/fleetMonitoring/useFleetMonitoring'

export function FleetMonitoringDetailPage() {
  const { truckId = '' } = useParams()
  const [params] = useSearchParams()
  const requestedTrip = params.get('trip_id') ?? ''
  const navigate = useNavigate()
  const tripSection = useRef<HTMLElement>(null)
  const load = useCallback(async () => {
    const response = await loadTruck(truckId)
    if (!requestedTrip || response.data.active_trip?.id === requestedTrip) {
      return { ...response, pastTripId: '', selectedTripMissing: false }
    }
    try {
      const past = await loadPastTransfer(truckId, requestedTrip)
      return { ...response, pastTripId: past.data.id === requestedTrip ? requestedTrip : '', selectedTripMissing: past.data.id !== requestedTrip }
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 404) throw caught
      return { ...response, pastTripId: '', selectedTripMissing: true }
    }
  }, [truckId, requestedTrip])
  const { data, loading, error, missing, refresh } = useFleetMonitoring(`${truckId}:trip:${requestedTrip}`, load)
  const back = new URLSearchParams(params)
  back.delete('trip_id')
  const onward = back.toString()
  back.delete('history_page')
  const truck = data?.data
  const trip = requestedTrip && truck?.active_trip?.id !== requestedTrip ? null : truck?.active_trip
  const pastTripId = data?.pastTripId

  useEffect(() => {
    if (!pastTripId) return
    navigate(`/fleet-monitoring/${encodeURIComponent(truckId)}/history/${encodeURIComponent(pastTripId)}${onward ? `?${onward}` : ''}`, { replace: true })
  }, [pastTripId, truckId, onward, navigate])

  useEffect(() => {
    if (!requestedTrip || trip?.id !== requestedTrip) return
    tripSection.current?.scrollIntoView({ block: 'start' })
    tripSection.current?.focus({ preventScroll: true })
  }, [requestedTrip, trip?.id])

  useEffect(() => { document.title = `${truck?.plate_number ?? 'Truck'} monitoring | Aisley Logistics` }, [truck?.plate_number])

  return (
    <div className="portal-page space-y-6">
      <Link
        className="portal-link inline-flex min-h-11 items-center underline"
        to={`/fleet-monitoring${back.size ? `?${back}` : ''}`}
      >
        Back to fleet monitoring
      </Link>
      <header className="portal-page-header">
        <div>
          <h2 className="portal-page-heading">{truck?.plate_number ?? 'Truck monitoring'}</h2>
          <p className="portal-page-description">Operational location and recorded trip history. All times are in Manila.</p>
        </div>
        <div className="portal-inline-actions">
          <Link className="portal-button" to={`/fleet-monitoring/${truckId}/history${onward ? `?${onward}` : ''}`}>Past transfers</Link>
          <Link className="portal-button" to="/fleet">Manage company fleet</Link>
        </div>
      </header>
      <MonitoringRefresh loading={loading} error={missing ? '' : error} updatedAt={data?.meta.server_time} refresh={refresh} />
      {missing ? <PortalState error title="Truck unavailable" description="This truck could not be found in your company fleet." /> : null}
      {loading && !data ? <PortalSkeleton label="Loading truck monitoring" /> : truck && data ? (
        <>
          <section className="portal-panel space-y-4 p-4 sm:p-6" aria-labelledby="truck-overview-title">
            <h3 id="truck-overview-title" className="text-lg font-semibold">Truck overview</h3>
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="portal-secondary">Availability</dt>
                <dd className="mt-1 font-medium">{availabilityLabels[truck.availability]} · {truck.is_active ? 'Active' : 'Inactive'}</dd>
              </div>
              <div>
                <dt className="portal-secondary">Make / model</dt>
                <dd className="mt-1 font-medium">{[truck.make, truck.model].filter(Boolean).join(' ') || 'Not set'}</dd>
              </div>
              <div>
                <dt className="portal-secondary">Home hub</dt>
                <dd className="mt-1 font-medium">{truck.home_hub?.name ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="portal-secondary">Last confirmed hub</dt>
                <dd className="mt-1 font-medium">{truck.last_confirmed_hub?.name ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="portal-secondary">Reserved / onboard parcels</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {truck.reserved_or_onboard_parcels} / {truck.max_parcels} · {truck.remaining_capacity} remaining
                </dd>
              </div>
            </dl>
            <p className="portal-secondary text-sm">
              Locations are based on confirmed events. Parcel counts reflect committed assignments, not measured physical occupancy.
            </p>
          </section>
          <section ref={tripSection} id="active-trip" tabIndex={-1} className="portal-panel space-y-4 p-4 sm:p-6 scroll-mt-20" aria-labelledby="active-trip-title">
            <h3 id="active-trip-title" className="text-lg font-semibold">Active trip</h3>
            {data.selectedTripMissing ? (
              <>
                <PortalState title="Selected trip unavailable" description="The selected trip could not be found for this truck in your company fleet. Its current assignment may have changed." />
                <div className="portal-inline-actions">
                  <Link className="portal-button" to={`/fleet-monitoring/${truckId}${onward ? `?${onward}` : ''}`}>View current truck monitoring</Link>
                  <Link className="portal-button" to={`/fleet-monitoring/${truckId}/history${onward ? `?${onward}` : ''}`}>Past transfers</Link>
                </div>
              </>
            ) : pastTripId ? <PortalSkeleton label="Opening selected past transfer" /> : trip ? (
              <>
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {truck.availability === 'in_transit' ? 'In transit: ' : ''}
                      {trip.from_hub?.name ?? 'Unknown hub'} → {trip.to_hub?.name ?? 'Unknown hub'}
                    </p>
                    <p className="portal-secondary mt-1 text-sm">
                      {trip.driver?.name ?? 'Driver unavailable'} · {trip.direction === 'return' ? 'Return' : 'Outbound'}
                      {trip.direction === 'return' && trip.parcel_count === 0 ? ' · Empty return' : ''}
                    </p>
                    <p className="mt-2 text-sm">Scheduled departure: {manilaTime(trip.scheduled_for)}</p>
                  </div>
                  <TripStatus trip={trip} />
                </div>
                <TripRouteDetails trip={trip} />
                <TripTimeline trip={trip} />
                <div className="portal-inline-actions">
                  <Link className="portal-button" to="/linehaul-dispatch">Open linehaul dispatch</Link>
                  <Link className="portal-button" to="/inbound-linehaul">Open linehaul inbound</Link>
                </div>
              </>
            ) : <PortalState title="No active trip" description="This truck has no pending, scheduled, in-transit or receiving assignment." />}
          </section>
        </>
      ) : null}
    </div>
  )
}
