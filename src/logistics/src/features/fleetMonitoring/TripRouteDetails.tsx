import type { MonitoringTrip } from './types'

export function TripRouteDetails({ trip }: { trip: MonitoringTrip }) {
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <dt className="portal-secondary">Outbound Logistics · Sending</dt>
        <dd className="mt-1 font-medium">{trip.from_hub?.logistics?.name ?? 'Organization unavailable'}</dd>
        <dd>{trip.from_hub?.name ?? 'Hub unavailable'}</dd>
      </div>
      <div>
        <dt className="portal-secondary">Inbound Logistics · Receiving</dt>
        <dd className="mt-1 font-medium">{trip.to_hub?.logistics?.name ?? 'Organization unavailable'}</dd>
        <dd>{trip.to_hub?.name ?? 'Hub unavailable'}</dd>
      </div>
    </dl>
  )
}
