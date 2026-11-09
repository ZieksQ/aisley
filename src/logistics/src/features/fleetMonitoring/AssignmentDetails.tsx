import { Link } from 'react-router-dom'
import { AssignmentIcon } from './AssignmentIcon'
import { assignmentStatus, hasPin, stageLabels } from './assignmentTypes'
import type { FleetAssignment } from './assignmentTypes'
import { manilaTime } from './types'

const eventLabels: Record<string, string> = {
  accepted_at: 'Courier accepted', picked_up_at: 'Physical pickup', in_transit_at: 'In transit recorded',
  out_for_delivery_at: 'Out for delivery recorded', released_for_departure_at: 'Released to driver',
  departed_at: 'Truck departed', courier_arrived_at: 'Driver reported arrival', arrived_at: 'Hub confirmed arrival',
}

export function AssignmentDetails({ work }: { work: FleetAssignment }) {
  const destination = work.stage === 'first_mile' ? '/pickups' : work.stage === 'linehaul' ? '/linehaul-dispatch' : '/dispatch'
  return (
    <section className="border-t border-[var(--portal-border)] p-4 sm:p-5" aria-labelledby="selected-assignment-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id="selected-assignment-title" className="break-words font-semibold">{work.courier?.name ?? (work.truck ? 'Truck' : 'Courier unavailable')} · {work.reference}</h4>
          <p className="portal-secondary mt-1 text-sm">{assignmentStatus(work)}{work.availability ? ` · ${work.availability.replaceAll('_', ' ')}` : ''} · {work.parcel_count} parcel{work.parcel_count === 1 ? '' : 's'}{work.direction === 'return' ? ' · Return trip' : ''}</p>
        </div>
        <Link className="portal-button" to={destination}>Open {work.stage === 'first_mile' ? 'Pickups' : work.stage === 'linehaul' ? 'Linehaul' : 'Dispatch'}</Link>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <p className="text-sm font-medium">{stageLabels[work.stage]} schedule</p>
          <p className="portal-secondary mt-1 text-sm">{work.scheduled_for ? manilaTime(work.scheduled_for) : 'Schedule unavailable'}{work.schedule_ends_at ? ` – ${manilaTime(work.schedule_ends_at)}` : ''}</p>
          {work.schedule_reference ? <p className="portal-secondary mt-1 break-words text-sm">{work.schedule_reference}</p> : null}
          {work.truck ? <Link className="portal-link mt-2 inline-block text-sm" to={`/fleet-monitoring/${encodeURIComponent(work.truck.id)}`}>Truck {work.truck.plate_number}</Link> : null}
        </div>
        <ol className="space-y-3" aria-label="Assignment stops">
          {work.stops.map((stop, index) => (
            <li key={`${stop.kind}-${index}`} className="flex gap-2 text-sm">
              <span className={stop.kind === 'pickup' || stop.kind === 'delivery' ? `assignment-color-${work.stage}` : 'portal-secondary'}><AssignmentIcon stage={work.stage} hub={stop.kind !== 'pickup' && stop.kind !== 'delivery'} /></span>
              <div><p className="font-medium">{stop.kind === 'last_confirmed_hub' ? 'Last confirmed hub: ' : ''}{stop.label}</p><p className="portal-secondary">{stop.area || 'Area unavailable'}{hasPin(stop) ? '' : ' · Map pin unavailable'}</p></div>
            </li>
          ))}
        </ol>
        <dl className="space-y-2 text-sm">
          {Object.entries(work.events).map(([event, at]) => (
            <div key={event}><dt className="portal-secondary">{eventLabels[event] ?? event}</dt><dd>{manilaTime(at)}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  )
}
