import { manilaTime, tripLabels } from './types'
import type { MonitoringTrip } from './types'

export function TripStatus({ trip }: { trip: MonitoringTrip }) {
  return (
    <div className="space-y-1">
      <span className="portal-tag">{tripLabels[trip.status]}</span>
      {trip.overdue ? (
        <span className="portal-tag portal-tag-warning">
          {trip.status === 'pending_acceptance'
            ? 'Departure overdue · approval pending'
            : 'Departure overdue'}
        </span>
      ) : null}
    </div>
  )
}

export function TripTimeline({ trip }: { trip: MonitoringTrip }) {
  const events = [
    ['Decision recorded', trip.decided_at],
    ['Released to driver', trip.released_for_departure_at],
    ['Departed', trip.departed_at],
    ['Driver reported arrival', trip.courier_arrived_at],
    ['Logistics confirmed arrival', trip.arrived_at],
    ['Unloading closed', trip.unloading_closed_at ?? trip.received_at],
  ] as const

  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {events.map(([label, value]) => (
        <div key={label}>
          <dt className="portal-secondary">{label}</dt>
          <dd className="mt-1 font-medium">{manilaTime(value)}</dd>
        </div>
      ))}
    </dl>
  )
}
