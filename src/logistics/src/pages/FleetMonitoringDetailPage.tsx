import { useCallback, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PortalPagination, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { loadTruckMonitoring } from '../features/fleetMonitoring/api'
import { MonitoringRefresh } from '../features/fleetMonitoring/MonitoringRefresh'
import { MonitoringHistoryTable } from '../features/fleetMonitoring/MonitoringTables'
import { TripStatus, TripTimeline } from '../features/fleetMonitoring/TripDetails'
import { availabilityLabels, manilaTime, pageNumber } from '../features/fleetMonitoring/types'
import { useFleetMonitoring } from '../features/fleetMonitoring/useFleetMonitoring'

export function FleetMonitoringDetailPage() {
  const { truckId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const page = pageNumber(params.get('history_page'))
  const load = useCallback(() => loadTruckMonitoring(truckId, page), [truckId, page])
  const { data, loading, error, missing, refresh } = useFleetMonitoring(`${truckId}:${page}`, load)
  const back = new URLSearchParams(params)
  back.delete('history_page')
  const truck = data?.data
  const trip = truck?.active_trip

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
        <Link className="portal-button" to="/fleet">Manage company fleet</Link>
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
          <section className="portal-panel space-y-4 p-4 sm:p-6" aria-labelledby="active-trip-title">
            <h3 id="active-trip-title" className="text-lg font-semibold">Active trip</h3>
            {trip ? (
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
                <TripTimeline trip={trip} />
                <div className="portal-inline-actions">
                  <Link className="portal-button" to="/linehaul-dispatch">Open linehaul dispatch</Link>
                  <Link className="portal-button" to="/inbound-linehaul">Open linehaul inbound</Link>
                </div>
              </>
            ) : <PortalState title="No active trip" description="This truck has no pending, scheduled, in-transit or receiving assignment." />}
          </section>
          <section className="space-y-4" aria-labelledby="truck-history-title">
            <h3 id="truck-history-title" className="text-lg font-semibold">
              Trip history <span className="portal-secondary text-sm font-normal">({data.history.meta.total})</span>
            </h3>
            <MonitoringHistoryTable trips={data.history.data} />
            <PortalPagination
              page={data.history.meta.current_page} lastPage={data.history.meta.last_page}
              total={data.history.meta.total} disabled={loading}
              onPage={(next) => {
                const values = new URLSearchParams(params)
                values.set('history_page', String(next))
                setParams(values)
              }}
            />
          </section>
        </>
      ) : null}
    </div>
  )
}
