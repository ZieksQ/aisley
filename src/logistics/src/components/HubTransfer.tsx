import { useRef, useState } from 'react'
import { FaArrowsRotate, FaMagnifyingGlass } from 'react-icons/fa6'
import { ApiError, csrf, requestWithTimeout } from '../lib/api'
import type { HubRouteRecord } from '../types/hubRouting'
import { ErrorNotice, PrimaryButton, field, manilaDate, panel } from './PickupUi'

type TransferAttempt = {
  key: string
  action: 'departures' | 'arrivals'
  body: { reference: string; hop_id: string; expected_revision: number; expected_hop_revision: number }
}

export function HubTransfer({ hubId, online, onTransferred }: { hubId: string; online: boolean; onTransferred: () => Promise<void> }) {
  const [reference, setReference] = useState('')
  const [loadedReference, setLoadedReference] = useState('')
  const [record, setRecord] = useState<HubRouteRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(false)
  const attempt = useRef<TransferAttempt | null>(null)
  const route = record?.route
  const hop = route?.hops.find((candidate) => candidate.status !== 'arrived')
  const matchesLookup = reference.trim() === loadedReference
  const canDepart = matchesLookup && route?.status === 'planned' && record?.status === 'sorted_at_hub' && hop?.status === 'pending' && hop.from_hub?.id === hubId
  const canArrive = matchesLookup && route?.status === 'planned' && record?.status === 'in_transfer' && hop?.status === 'in_transfer' && hop.to_hub?.id === hubId

  async function lookup() {
    if (!reference.trim() || busy || !online || !navigator.onLine || retry) return
    setBusy(true); setError(''); setNotice(''); setRecord(null)
    try {
      const value = reference.trim()
      const result = await requestWithTimeout<{ data: HubRouteRecord }>('/api/v1/logistics/routes/' + encodeURIComponent(value), { cache: 'no-store' })
      setRecord(result.data); setLoadedReference(value)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The parcel route could not be loaded. Check the reference and connection.')
    } finally { setBusy(false) }
  }

  async function transfer() {
    if (busy || !online || !navigator.onLine || !record || !hop || (!attempt.current && !canDepart && !canArrive)) return
    if (!attempt.current) {
      const action = canArrive ? 'arrivals' : 'departures'
      if (!window.confirm(action === 'arrivals' ? 'Confirm this parcel has physically arrived at this hub?' : 'Confirm this sorted parcel has physically departed for ' + (hop.to_hub?.name ?? 'the next hub') + '?')) return
      attempt.current = { key: crypto.randomUUID(), action, body: { reference: loadedReference, hop_id: hop.id, expected_revision: record.revision, expected_hop_revision: hop.revision } }
    }
    const pending = attempt.current
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      const result = await requestWithTimeout<{ data: HubRouteRecord }>('/api/v1/logistics/transfers/' + pending.action, {
        method: 'POST', headers: { 'Idempotency-Key': pending.key }, body: JSON.stringify(pending.body),
      })
      setRecord(result.data); attempt.current = null; setRetry(false)
      setNotice(pending.action === 'arrivals' ? 'Arrival recorded. Sort this parcel in a receiving-hub session.' : 'Departure recorded. The next hub can confirm arrival.')
      await onTransferred()
    } catch (caught) {
      const uncertain = !(caught instanceof ApiError) || caught.status === 0 || caught.status === 408 || caught.status >= 500
      setRetry(uncertain)
      if (!uncertain) { attempt.current = null; setRecord(null) }
      setError(uncertain ? 'Confirmation was not received. Retry this transfer with the same request before looking up another parcel.' : caught instanceof ApiError ? caught.message + ' Look up the parcel again before continuing.' : 'The transfer could not be recorded.')
    } finally { setBusy(false) }
  }

  return <section className={panel} aria-labelledby="hub-transfer-title">
    <div className="border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h3 id="hub-transfer-title" className="font-semibold">Hub transfer</h3></div>
    <form className="flex gap-2 p-3" onSubmit={(event) => { event.preventDefault(); void lookup() }}>
      <label className="min-w-0 flex-1"><span className="sr-only">Transfer tracking ID or waybill reference</span><input className={field} value={reference} onChange={(event) => setReference(event.target.value)} disabled={busy || retry} maxLength={255} placeholder="Tracking ID or waybill reference" autoComplete="off" required /></label>
      <button type="submit" aria-label="Look up parcel route" title="Look up route" aria-busy={busy} disabled={busy || !online || retry} className="grid size-10 shrink-0 place-items-center rounded-md border border-zinc-300 hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10">{busy ? <FaArrowsRotate className="animate-spin" aria-hidden="true" /> : <FaMagnifyingGlass aria-hidden="true" />}</button>
    </form>
    {!online ? <p className="px-3 pb-3 text-xs text-amber-700 dark:text-amber-300">Transfers require a connection. Sorting scans remain available offline.</p> : null}
    {error ? <div className="px-3 pb-3"><ErrorNotice message={error} /></div> : null}
    {notice ? <p role="status" className="px-3 pb-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
    {record ? <div className="space-y-2 border-t border-zinc-200 p-3 text-sm dark:border-white/10">
      <p className="break-all font-mono font-medium">{loadedReference}</p>
      <p className="capitalize">{record.status.replaceAll('_', ' ')}</p>
      {route ? <>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs"><dt className="text-zinc-500">Current hub</dt><dd className="break-words">{route.current_hub?.name ?? 'Unavailable'}</dd><dt className="text-zinc-500">Next hub</dt><dd className="break-words">{route.next_hub?.name ?? (route.failure_code ? 'Unavailable' : 'No transfer required')}</dd><dt className="text-zinc-500">Destination</dt><dd className="break-words">{route.destination_hub?.name ?? 'Unresolved'}</dd></dl>
        {route.failure_code ? <p role="status" className="text-xs text-amber-700 dark:text-amber-300">Held: {route.failure_code.replaceAll('_', ' ').toLowerCase()}. Route recovery requires operations review.</p> : null}
        {route.hops.length ? <details><summary className="cursor-pointer py-1 text-xs font-medium">Route hops ({route.hops.length})</summary><ol className="divide-y divide-zinc-200 dark:divide-white/10">{route.hops.map((item) => <li key={item.id} className="py-2 text-xs"><p className="break-words">{item.sequence}. {item.from_hub?.name ?? 'Unavailable'} → {item.to_hub?.name ?? 'Unavailable'}</p><p className="mt-1 capitalize text-zinc-500">{item.status.replaceAll('_', ' ')}{item.distance_meters !== null ? ' · ' + (item.distance_meters / 1000).toFixed(1) + ' km' : ''}{item.duration_seconds !== null ? ' · ' + Math.ceil(item.duration_seconds / 60) + ' min estimated' : ''}</p>{item.arrived_at || item.departed_at ? <p className="mt-1 text-zinc-500">{item.arrived_at ? 'Arrived ' + manilaDate(item.arrived_at) : 'Departed ' + manilaDate(item.departed_at!)}</p> : null}</li>)}</ol><p className="pt-1 text-xs text-zinc-500">{route.attribution}</p></details> : null}
        {canDepart || canArrive || retry ? <PrimaryButton busy={busy} disabled={!online} className="w-full" onClick={() => void transfer()}>{retry ? 'Retry confirmation' : canArrive ? 'Confirm arrival' : 'Confirm departure'}</PrimaryButton> : <p className="text-xs text-zinc-500">{route.status === 'local' || route.status === 'completed' ? 'Use postal-code sorting and final-mile dispatch.' : record.status === 'received_at_hub' ? 'Sort into the mapped next-hub lane before departure.' : 'No transfer action is available at this hub.'}</p>}
      </> : <p className="text-xs text-zinc-500">No hub route. Continue the existing local sorting and dispatch flow.</p>}
    </div> : <p className="px-3 pb-3 text-xs text-zinc-500">{busy ? 'Loading route…' : 'Look up a parcel to confirm departure or arrival along its planned route.'}</p>}
  </section>
}
