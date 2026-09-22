import { useCallback, useEffect, useState } from 'react'
import { FlatpickrInput } from '../components/FlatpickrInput'
import { ActionButton, ErrorNotice, PrimaryButton, field, manilaDate, panel } from '../components/PickupUi'
import { csrf, requestWithTimeout } from '../lib/api'
import { defaultLinehaulTime } from '../types/linehaulTrips'
import type { LinehaulOverview, LinehaulTrip } from '../types/linehaulTrips'

export function InboundLinehaulPage() {
  const [overview, setOverview] = useState<LinehaulOverview | null>(null)
  const [scheduledFor, setScheduledFor] = useState(defaultLinehaulTime)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => { try { const response = await requestWithTimeout<{ data: LinehaulOverview }>('/api/v1/logistics/linehaul/trips'); setOverview(response.data) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Inbound linehaul could not be loaded.') } }, [])
  useEffect(() => { document.title = 'Inbound linehaul | Aisley Logistics'; void load() }, [load])

  async function post(trip: LinehaulTrip, action: string, body: object) {
    setBusy(true); setError(''); setNotice('')
    try { await csrf(); await requestWithTimeout(`/api/v1/logistics/linehaul/trips/${trip.id}/${action}`, { method: 'POST', headers: action === 'return' ? { 'Idempotency-Key': crypto.randomUUID() } : undefined, body: JSON.stringify(body) }); setNotice('Linehaul trip updated.'); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The linehaul action could not be completed.') }
    finally { setBusy(false) }
  }
  const pending = overview?.inbound.filter((trip) => trip.can_decide) ?? []
  const arriving = overview?.inbound.filter((trip) => trip.can_receive) ?? []

  return <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-white/10"><div><h2 className="text-xl font-semibold">Inbound linehaul</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Approve incoming transfer requests, receive physical arrivals, and schedule visiting trucks home.</p></div><ActionButton onClick={() => void load()}>Refresh</ActionButton></div>
    {error ? <div className="mt-3"><ErrorNotice message={error} retry={() => void load()} /></div> : null}{notice ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
    <section className={`${panel} mt-3 overflow-hidden`}><div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Approval requests</h3></div>{pending.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{pending.map((trip) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={trip.id}><div><p className="font-medium">{trip.from_hub.name} · {trip.parcel_count} parcels</p><p className="mt-1 text-xs text-zinc-500">{trip.truck.plate_number} · {trip.driver.name} · {manilaDate(trip.scheduled_for)}</p></div><div className="flex gap-2"><PrimaryButton disabled={busy} onClick={() => void post(trip, 'decision', { accept: true, expected_revision: trip.revision })}>Approve</PrimaryButton><ActionButton disabled={busy} onClick={() => { const reason = window.prompt('Reason for rejecting this transfer?'); if (reason) void post(trip, 'decision', { accept: false, reason, expected_revision: trip.revision }) }}>Reject</ActionButton></div></li>)}</ul> : <p className="p-4 text-sm text-zinc-500">No inbound requests await approval.</p>}</section>
    <section className={`${panel} mt-3 overflow-hidden`}><div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Arriving trips</h3></div>{arriving.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{arriving.map((trip) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={trip.id}><div><p className="font-medium">{trip.from_hub.name} → {trip.to_hub.name}</p><p className="text-xs text-zinc-500">{trip.parcel_count ? `${trip.parcel_count} parcels` : 'Empty return'} · {trip.truck.plate_number}</p></div><PrimaryButton disabled={busy} onClick={() => void post(trip, 'receive', { expected_revision: trip.revision })}>Confirm receipt</PrimaryButton></li>)}</ul> : <p className="p-4 text-sm text-zinc-500">No linehaul trips are awaiting receipt.</p>}</section>
    <section className={`${panel} mt-3 overflow-hidden`}><div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Visiting trucks</h3><p className="mt-1 text-xs text-zinc-500">A return is committed immediately; the owner and driver are notified without another acceptance step.</p></div><div className="grid gap-3 border-b border-zinc-200 p-4 dark:border-white/10 sm:grid-cols-[minmax(0,20rem)_1fr]"><label className="text-sm font-medium">Return schedule<FlatpickrInput className={`${field} mt-1`} value={scheduledFor} onChange={setScheduledFor} options={{ enableTime: true, time_24hr: true, dateFormat: 'Y-m-d H:i', minDate: 'today', minuteIncrement: 15 }} /></label></div>{overview?.visitors.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{overview.visitors.map((trip) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={trip.id}><div><p className="font-medium">{trip.truck.plate_number} · {trip.driver.name}</p><p className="text-xs text-zinc-500">Owned by {trip.from_hub.name}; confirmed at this hub</p></div><div className="flex flex-wrap gap-2"><PrimaryButton disabled={busy} onClick={() => void post(trip, 'return', { scheduled_for: new Date(scheduledFor.replace(' ', 'T')).toISOString(), empty_return: false })}>Schedule with return cargo</PrimaryButton><ActionButton disabled={busy} onClick={() => void post(trip, 'return', { scheduled_for: new Date(scheduledFor.replace(' ', 'T')).toISOString(), empty_return: true })}>Schedule empty return</ActionButton></div></li>)}</ul> : <p className="p-4 text-sm text-zinc-500">No visiting trucks are ready for a return.</p>}</section>
  </div>
}
