import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, csrf, requestWithTimeout } from '../lib/api'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from './PickupUi'

type Manifest = { id: string; status: string; from_hub: string; to_hub: string; references: string[]; can_receive: boolean }
type Connection = { id: string; from_hub?: { name: string }; sender_requested: boolean; receiver_accepted: boolean; to_hub_id: string; is_active: boolean; revision: number; distance_meters: number | null; duration_seconds: number | null }
type Area = { postal_code: string; is_active: boolean; revision: number }
type ReadyGroup = { next_hub_id: string; next_hub: string; references: string[] }
type Overview = { enabled: boolean; ready_groups: ReadyGroup[]; manifests: Manifest[]; hubs: { id: string; name: string }[]; service_areas: Area[]; connections: Connection[]; incoming_connections: Connection[] }

export function Linehaul({ online }: { online: boolean }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [postal, setPostal] = useState('')
  const [target, setTarget] = useState('')
  const [distance, setDistance] = useState('')
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const pending = useRef<{ key: string; nextHubId: string } | null>(null)
  const connection = overview?.connections.find((item) => item.to_hub_id === target)
  const area = overview?.service_areas.find((item) => item.postal_code === postal)
  const load = useCallback(async () => {
    if (!online) return
    try { const result = await requestWithTimeout<{ data: Overview }>('/api/v1/logistics/linehaul'); setOverview(result.data) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Linehaul could not be loaded.') }
  }, [online])
  useEffect(() => { void load() }, [load])

  async function depart(group: ReadyGroup) {
    if (!pending.current) {
      if (!window.confirm('Confirm all ' + group.references.length + ' ready parcels have physically departed together for ' + group.next_hub + '?')) return
      pending.current = { key: crypto.randomUUID(), nextHubId: group.next_hub_id }
    }
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      const result = await requestWithTimeout<{ data: Manifest }>('/api/v1/logistics/linehaul/manifests', { method: 'POST', headers: { 'Idempotency-Key': pending.current.key }, body: JSON.stringify({ next_hub_id: pending.current.nextHubId }) })
      pending.current = null; setUncertain(false); setNotice('Manifest departed for ' + result.data.to_hub + '.')
      await load()
    } catch (caught) {
      const unknown = !(caught instanceof ApiError) || caught.status === 0 || caught.status === 408 || caught.status >= 500
      setUncertain(unknown)
      if (!unknown) pending.current = null
      setError(unknown ? 'Confirmation was not received. Retry the same manifest before changing its parcels.' : (caught as ApiError).message)
    } finally { setBusy(false) }
  }

  async function write(path: string, body: object) {
    setBusy(true); setError(''); setNotice('')
    try { await csrf(); await requestWithTimeout(path, { method: path.endsWith('/receive') ? 'POST' : 'PUT', body: JSON.stringify(body) }); setNotice('Linehaul updated.'); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The operation failed. Refresh and retry.') }
    finally { setBusy(false) }
  }

  return <section className={panel} aria-labelledby="linehaul-title">
    <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-white/10"><h3 id="linehaul-title" className="font-semibold">Linehaul</h3><ActionButton disabled={busy || !online} onClick={() => void load()}>Refresh</ActionButton></div>
    <div className="space-y-3 p-3">
      {error ? <ErrorNotice message={error} /> : null}
      {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
      {!online ? <p className="text-sm">Linehaul requires an internet connection.</p> : null}
      {overview && !overview.enabled ? <p className="text-sm text-amber-700 dark:text-amber-300">New routes and departures are paused. Incoming manifests can still be received.</p> : null}
      <details open className="border-t border-zinc-200 pt-3 dark:border-white/10"><summary className="cursor-pointer text-sm font-medium">Hub coverage and connections</summary>
        <p className="my-2 text-xs text-zinc-500">Request a directed connection to another hub. Its Logistics organization must accept before routing can use it.</p>
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void write('/api/v1/logistics/linehaul/service-areas', { postal_code: postal, is_active: !area?.is_active, expected_revision: area?.revision }) }}><label className="block text-xs">Recipient postal code<input className={field + ' mt-1'} required pattern="\d{4}" maxLength={4} value={postal} onChange={(event) => setPostal(event.target.value)} /></label><ActionButton type="submit" disabled={busy || !online}>{area?.is_active ? 'Stop serving postal code' : 'Serve postal code'}</ActionButton><p className="text-xs text-zinc-500">Serving: {overview?.service_areas.filter((item) => item.is_active).map((item) => item.postal_code).join(', ') || 'None'}</p></form>
        <div className="mt-4 space-y-2"><h4 className="text-sm font-semibold">Incoming connections</h4>
          {overview?.incoming_connections.length ? overview.incoming_connections.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 py-2 text-sm dark:border-white/10"><div>{item.from_hub?.name ?? 'Unavailable hub'}<p className="text-xs text-zinc-500">{item.is_active && item.receiver_accepted ? 'Connected' : item.sender_requested ? 'Not accepted' : 'Disconnected by sender'}</p></div><div className="flex gap-2">{!item.receiver_accepted && item.sender_requested ? <ActionButton disabled={busy || !online} onClick={() => void write('/api/v1/logistics/linehaul/connections/' + item.id + '/consent', { accept: true, expected_revision: item.revision })}>Accept connection</ActionButton> : null}{item.sender_requested ? <ActionButton disabled={busy || !online} onClick={() => { if (window.confirm('Decline or disconnect this incoming connection? New departures will be held; in-transit parcels can still be received.')) void write('/api/v1/logistics/linehaul/connections/' + item.id + '/consent', { accept: false, expected_revision: item.revision }) }}>{item.receiver_accepted ? 'Disconnect' : 'Decline'}</ActionButton> : null}</div></div>) : <p className="text-xs text-zinc-500">No incoming requests.</p>}
        </div>
        <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); void write('/api/v1/logistics/linehaul/connections', { to_hub_id: target, is_active: true, expected_revision: connection?.revision, distance_meters: distance ? Number(distance) * 1000 : null, duration_seconds: minutes ? Number(minutes) * 60 : null }) }}>
          <label className="block text-xs">Next hub<select className={field + ' mt-1'} required value={target} onChange={(event) => { const value = event.target.value; setTarget(value); const row = overview?.connections.find((item) => item.to_hub_id === value); setDistance(row?.distance_meters ? String(row.distance_meters / 1000) : ''); setMinutes(row?.duration_seconds ? String(row.duration_seconds / 60) : '') }}><option value="">Choose hub</option>{overview?.hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}</select></label>
          {connection ? <p className="text-xs text-zinc-500">{connection.is_active && connection.receiver_accepted ? 'Connected' : connection.sender_requested ? 'Not accepted by receiver' : 'Disconnected'}</p> : null}
          <label className="block text-xs">Known road distance (km, optional)<input className={field + ' mt-1'} type="number" min="0.001" step="any" value={distance} onChange={(event) => setDistance(event.target.value)} required={!!minutes} /></label>
          <label className="block text-xs">Known driving time (minutes, optional)<input className={field + ' mt-1'} type="number" min="0.01" step="any" value={minutes} onChange={(event) => setMinutes(event.target.value)} required={!!distance} /></label>
          <p className="text-xs text-zinc-500">Enter both measured road values, or leave both blank for Geoapify. Routing adds 30 minutes per transfer for handling.</p>
          <div className="flex flex-wrap gap-2"><ActionButton type="submit" disabled={busy || !online}>{connection?.is_active ? 'Save measurements' : 'Request connection'}</ActionButton>{connection?.sender_requested ? <ActionButton disabled={busy || !online} onClick={() => { if (window.confirm('Disable this connection? Existing route departures will be held.')) void write('/api/v1/logistics/linehaul/connections', { to_hub_id: target, is_active: false, expected_revision: connection.revision, distance_meters: connection.distance_meters, duration_seconds: connection.duration_seconds }) }}>Disconnect</ActionButton> : null}</div>
        </form>
      </details>
      {uncertain && pending.current ? <ActionButton disabled={busy || !online} onClick={() => void depart({ next_hub_id: pending.current!.nextHubId, next_hub: '', references: [] })}>Retry pending departure</ActionButton> : null}
      <div className="space-y-2">
        <div><h4 className="text-sm font-semibold">Ready linehaul groups</h4><p className="mt-1 text-xs text-zinc-500">The active sort plan and route decide group membership. Parcels going to the same next hub depart in one manifest.</p></div>
        {overview?.ready_groups.length ? overview.ready_groups.map((group) => <div key={group.next_hub_id} className="flex flex-wrap items-center justify-between gap-3 border border-zinc-200 p-3 text-sm dark:border-white/10"><div><p className="font-medium">{group.next_hub}</p><p className="text-xs text-zinc-500">{group.references.length} ready parcels · selected automatically from Sorting</p></div><PrimaryButton busy={busy && pending.current?.nextHubId === group.next_hub_id} disabled={!online || !overview.enabled || busy || uncertain} onClick={() => void depart(group)}>{uncertain && pending.current?.nextHubId === group.next_hub_id ? 'Retry departure' : 'Confirm departure'}</PrimaryButton></div>) : <p className="border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-white/15">No linehaul groups are ready. Complete the configured next-hub sort lane first.</p>}
        <p className="text-xs text-zinc-500">You confirm only the physical truck departure. You do not enter parcel IDs; the server takes the current eligible parcels for the selected route group.</p>
      </div>
      <div className="border-t border-zinc-200 pt-3 dark:border-white/10"><h4 className="text-sm font-semibold">Recent manifests</h4>
        {overview?.manifests.length ? overview.manifests.map((manifest) => <article className="border-b border-zinc-200 py-3 text-sm dark:border-white/10" key={manifest.id}><p>{manifest.from_hub} → {manifest.to_hub}</p><p className="text-xs text-zinc-500">{manifest.references.length} parcels · {manifest.status.replaceAll('_', ' ')}</p><details><summary className="cursor-pointer break-all text-xs">Manifest {manifest.id}</summary><ul className="break-all font-mono text-xs">{manifest.references.map((reference) => <li key={reference}>{reference}</li>)}</ul></details>{manifest.can_receive ? <ActionButton disabled={busy || !online} onClick={() => { if (window.confirm('Confirm all ' + manifest.references.length + ' parcels have physically arrived? Reconcile missing parcels before confirming.')) void write('/api/v1/logistics/linehaul/manifests/' + manifest.id + '/receive', {}) }}>Receive all parcels</ActionButton> : null}</article>) : <p className="py-2 text-xs text-zinc-500">No manifests yet.</p>}
      </div>

    </div>
  </section>
}
