import { Button } from '@aisley/ui'
import { useLinehaulTripAction } from './useLinehaulTripAction'
import type { LinehaulTrip } from './types'

export function LinehaulTripActions({ trip, token, onUpdated, onBusyChange }: {
  trip: LinehaulTrip
  token: string
  onUpdated: (trip: LinehaulTrip) => void
  onBusyChange: (busy: boolean) => void
}) {
  const { confirmed, setConfirmed, busy, error, notice, stale, action, retrying, submit } = useLinehaulTripAction(trip, token, onUpdated, onBusyChange)

  return (
    <section className="verification-panel" aria-label="Courier trip actions">
      {trip.status === 'scheduled' && !trip.released_for_departure_at ? <p>Waiting for origin Logistics to release the truck and load to you.</p> : null}
      {trip.status === 'scheduled' && trip.released_for_departure_at ? <p>Released to you. The scheduled time is a plan; confirm when you physically depart.</p> : null}
      {trip.courier_arrived_at ? <p>Arrival reported at {new Date(trip.courier_arrived_at).toLocaleString('en-PH')}. Logistics confirms parcel receipt separately.</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {action ? <>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} disabled={busy || stale} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>{action === 'depart' ? 'I confirm this truck has physically left the origin hub.' : 'I confirm this truck has physically arrived at the destination hub.'}</span>
        </label>
        <Button className="min-h-11 rounded-md px-4 shadow-none" disabled={!confirmed || stale || busy} isLoading={busy} loadingLabel="Recording" onClick={() => void submit()} variant="secondary">
          {retrying ? action === 'depart' ? 'Retry departure' : 'Retry arrival report' : action === 'depart' ? 'Depart' : 'Arrived at hub'}
        </Button>
      </> : null}
    </section>
  )
}
