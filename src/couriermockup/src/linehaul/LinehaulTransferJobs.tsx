import { useEffect, useState } from 'react'
import { Button } from '@aisley/ui'
import { ApiError } from '../lib/api'
import { getLinehaulTrips } from './api'
import { LinehaulRouteMap } from './LinehaulRouteMap'
import type { LinehaulTrip } from './types'

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleString('en-PH') : '—'
}

const statusGuidance: Record<LinehaulTrip['status'], string> = {
  pending_acceptance: 'Waiting for the destination hub to approve this transfer.',
  scheduled: 'Scheduled by Logistics. Check the departure time and assigned truck.',
  in_transfer: 'Transfer in progress. The destination hub will confirm arrival and receive the load.',
  receiving: 'The destination hub is unloading and checking parcels.',
  received: 'Unloading closed. See the recorded outcome below.',
  rejected: 'The destination hub rejected this transfer.',
  cancelled: 'This transfer was cancelled.',
}

export function LinehaulTransferJobs({ token }: { token: string }) {
  const [trips, setTrips] = useState<LinehaulTrip[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getLinehaulTrips(token, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setTrips(data)
        setSelectedId((current) => data.some((trip) => trip.id === current) ? current : data[0]?.id ?? null)
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        setTrips([])
        setSelectedId(null)
        setError(caught instanceof ApiError ? caught.message : 'Could not load transfer jobs. Check your connection and retry.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token, refresh])

  const selected = trips.find((trip) => trip.id === selectedId)

  return (
    <section className="pickup-workspace linehaul-jobs" aria-labelledby="linehaul-heading" aria-busy={loading}>
      <div className="pickup-toolbar">
        <div>
          <h2 id="linehaul-heading">Linehaul transfer jobs</h2>
          <p className="panel-description">Transfers assigned to you by Logistics. Logistics confirms departure and hub receiving.</p>
        </div>
        <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={loading} isLoading={loading} onClick={() => setRefresh((value) => value + 1)} variant="outline">Refresh transfers</Button>
      </div>
      {loading ? <p className="empty-state" role="status">Loading transfer jobs…</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {!loading && !error && trips.length === 0 ? <p className="empty-state">No linehaul transfer jobs assigned.</p> : null}
      {!loading && trips.length > 0 ? (
        <div className="pickup-layout">
          <ul className="task-list" aria-label="Assigned linehaul transfers">
            {trips.map((trip) => (
              <li key={trip.id}>
                <button className="task-row" type="button" aria-current={trip.id === selectedId ? 'true' : undefined} onClick={() => setSelectedId(trip.id)}>
                  <span>
                    <strong>{trip.from_hub.name ?? 'Unknown hub'} → {trip.to_hub.name ?? 'Unknown hub'}</strong>
                    <span>{trip.direction === 'return' ? 'Return' : 'Outbound'} · {trip.parcel_count} parcels</span>
                    <span>{dateLabel(trip.scheduled_for)}</span>
                  </span>
                  <span>{trip.status.replaceAll('_', ' ')}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? (
            <div className="task-detail">
              <div className="linehaul-route">
                <h3>{selected.from_hub.name ?? 'Unknown hub'} → {selected.to_hub.name ?? 'Unknown hub'}</h3>
                <p>{statusGuidance[selected.status]}</p>
              </div>
              <dl className="task-facts">
                <div><dt>From</dt><dd>{selected.from_hub.name ?? 'Unknown hub'}</dd></div>
                <div><dt>To</dt><dd>{selected.to_hub.name ?? 'Unknown hub'}</dd></div>
                <div><dt>Status</dt><dd>{selected.status.replaceAll('_', ' ')}</dd></div>
                <div><dt>Scheduled departure</dt><dd>{dateLabel(selected.scheduled_for)}</dd></div>
                <div><dt>Company truck</dt><dd>{selected.truck.plate_number ?? 'Unavailable'} · {[selected.truck.make, selected.truck.model].filter(Boolean).join(' ') || 'Vehicle details unavailable'}</dd></div>
                <div><dt>Load</dt><dd>{selected.empty_return ? 'Empty return' : `${selected.parcel_count} parcels`}</dd></div>
                <div><dt>Departed</dt><dd>{dateLabel(selected.departed_at)}</dd></div>
                <div><dt>Arrived</dt><dd>{dateLabel(selected.arrived_at)}</dd></div>
                <div><dt>Unloading closed</dt><dd>{dateLabel(selected.unloading_closed_at)}</dd></div>
                {selected.unloading_outcome ? <div><dt>Unloading outcome</dt><dd>{selected.unloading_outcome.replaceAll('_', ' ')}</dd></div> : null}
              </dl>
              {selected.lane_blocked ? <p className="confirmation-note">Departure is blocked by the sorting lane. Contact Logistics.</p> : null}
              {selected.rejection_reason ? <p>Rejection reason: {selected.rejection_reason}</p> : null}
              <LinehaulRouteMap key={`${selected.id}:${refresh}`} tripId={selected.id} token={token} />
              <div>
                <h3>Parcel references</h3>
                {selected.references.length ? <ul className="linehaul-references">{selected.references.map((reference) => <li key={reference}>{reference}</li>)}</ul> : <p>{selected.empty_return ? 'No cargo on this return trip.' : 'No parcel references available.'}</p>}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
