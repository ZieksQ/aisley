import { useCallback, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { loadPastTransfer, loadTruck } from '../features/fleetMonitoring/api'
import { MonitoringRefresh } from '../features/fleetMonitoring/MonitoringRefresh'
import { PastTransferMap } from '../features/fleetMonitoring/PastTransferMap'
import { TripStatus, TripTimeline } from '../features/fleetMonitoring/TripDetails'
import { TripRouteDetails } from '../features/fleetMonitoring/TripRouteDetails'
import { manilaTime } from '../features/fleetMonitoring/types'
import { useFleetMonitoring } from '../features/fleetMonitoring/useFleetMonitoring'

export function FleetTransferDetailPage() {
  const { truckId = '', tripId = '' } = useParams()
  const [params] = useSearchParams()
  const load = useCallback(async () => {
    const [truck, trip] = await Promise.all([loadTruck(truckId), loadPastTransfer(truckId, tripId)])
    return { ...trip, truck: truck.data }
  }, [truckId, tripId])
  const { data, loading, error, missing, refresh } = useFleetMonitoring(`past:${truckId}:${tripId}`, load)
  useEffect(() => { document.title = 'Past transfer details | Aisley Logistics' }, [])
  const trip = data?.data

  return (
    <div className="portal-page space-y-6">
      <Link className="portal-link inline-flex min-h-11 items-center underline" to={`/fleet-monitoring/${truckId}/history?${params}`}>Back to past transfers</Link>
      <header className="portal-page-header">
        <div>
          <h2 className="portal-page-heading">Past transfer details</h2>
          <p className="portal-page-description">{data?.truck.plate_number ?? 'Truck'} · All times are in Manila.</p>
        </div>
      </header>
      <MonitoringRefresh loading={loading} error={missing ? '' : error} updatedAt={data?.meta.server_time} refresh={refresh} />
      {missing ? <PortalState error title="Transfer unavailable" description="This past transfer could not be found for this truck in your company fleet." /> : null}
      {loading && !data ? <PortalSkeleton label="Loading transfer details" /> : trip ? (
        <>
          <section className="portal-panel space-y-4 p-4 sm:p-6" aria-labelledby="transfer-schedule-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 id="transfer-schedule-title" className="text-lg font-semibold">Transfer schedule</h3>
              <TripStatus trip={trip} />
            </div>
            <TripRouteDetails trip={trip} />
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="portal-secondary">Scheduled departure</dt>
                <dd className="mt-1 font-medium">{manilaTime(trip.scheduled_for)}</dd>
              </div>
              <div>
                <dt className="portal-secondary">Driver</dt>
                <dd className="mt-1 font-medium">{trip.driver?.name ?? 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="portal-secondary">Parcels / capacity at scheduling</dt>
                <dd className="mt-1 font-medium tabular-nums">{trip.parcel_count} / {trip.capacity_snapshot}</dd>
              </div>
              <div>
                <dt className="portal-secondary">Trip type</dt>
                <dd className="mt-1 font-medium">{trip.direction === 'return' ? 'Return' : 'Outbound'}{trip.direction === 'return' && trip.parcel_count === 0 ? ' · Empty return' : ''}</dd>
              </div>
              <div className="min-w-0">
                <dt className="portal-secondary">Manifest</dt>
                <dd className="mt-1 break-words">{trip.manifest_id ?? 'No manifest recorded'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="portal-secondary">Trip reference</dt>
                <dd className="mt-1 break-words">{trip.id}</dd>
              </div>
            </dl>
          </section>
          <section className="portal-panel overflow-hidden" aria-label="Past transfer route map">
            {!trip.manifest_id ? <p className="portal-secondary px-4 pt-4 text-sm">No manifest recorded. The map shows the scheduled origin and destination hubs.</p> : null}
            <PastTransferMap key={trip.id} trip={trip} />
          </section>
          <section className="portal-panel space-y-4 p-4 sm:p-6" aria-labelledby="transfer-events-title">
            <h3 id="transfer-events-title" className="text-lg font-semibold">Recorded events</h3>
            <TripTimeline trip={trip} />
          </section>
        </>
      ) : null}
    </div>
  )
}
