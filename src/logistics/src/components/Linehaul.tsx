import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, csrf, requestWithTimeout } from '../lib/api'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from './PickupUi'

type Manifest = { id: string; status: string; from_hub: string; to_hub: string; references: string[]; can_receive: boolean }
type Connection = { to_hub_id: string; is_active: boolean; revision: number; distance_meters: number | null; duration_seconds: number | null }
type Area = { postal_code: string; is_active: boolean; revision: number }
type Overview = { enabled: boolean; ready_groups: { next_hub: string; references: string[] }[]; manifests: Manifest[]; hubs: { id: string; name: string }[]; service_areas: Area[]; connections: Connection[] }

export function Linehaul({ online, onTransferred }: { hubId: string; online: boolean; onTransferred: () => Promise<void> }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [references, setReferences] = useState('')
  const [postal, setPostal] = useState('')
  const [target, setTarget] = useState('')
  const [distance, setDistance] = useState('')
  const [minutes, setMinutes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const pending = useRef<{ key: string; references: string[] } | null>(null)
  const connection = overview?.connections.find((item) => item.to_hub_id === target)
  const area = overview?.service_areas.find((item) => item.postal_code === postal)
  const load = useCallback(async () => {
    if (!online) return
    try { const result = await requestWithTimeout<{ data: Overview }>('/api/v1/logistics/linehaul'); setOverview(result.data) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Linehaul could not be loaded.') }
  }, [online])
  useEffect(() => { void load() }, [load])

  async function depart() {
    if (!pending.current) {
      const values = references.split(/[\s,]+/).filter(Boolean)
      if (!values.length || !window.confirm('Confirm all ' + values.length + ' parcels have physically departed together for the same next hub?')) return
      pending.current = { key: crypto.randomUUID(), references: values }
    }
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      const result = await requestWithTimeout<{ data: Manifest }>('/api/v1/logistics/linehaul/manifests', { method: 'POST', headers: { 'Idempotency-Key': pending.current.key }, body: JSON.stringify({ references: pending.current.references }) })
      pending.current = null; setUncertain(false); setReferences(''); setNotice('Manifest departed for ' + result.data.to_hub + '.')
      await load(); await onTransferred()
    } catch (caught) {
      const unknown = !(caught instanceof ApiError) || caught.status === 0 || caught.status === 408 || caught.status >= 500
      setUncertain(unknown)
      if (!unknown) pending.current = null
      setError(unknown ? 'Confirmation was not received. Retry the same manifest before changing its parcels.' : (caught as ApiError).message)
    } finally { setBusy(false) }
  }

  async function write(path: string, body: object) {
    setBusy(true); setError(''); setNotice('')
    try { await csrf(); await requestWithTimeout(path, { method: path.endsWith('/receive') ? 'POST' : 'PUT', body: JSON.stringify(body) }); setNotice('Linehaul updated.'); await load(); await onTransferred() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The operation failed. Refresh and retry.') }
    finally { setBusy(false) }
  }

  return <section className={panel} aria-labelledby="linehaul-title">
    <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-white/10"><h3 id="linehaul-title" className="font-semibold">Linehaul</h3><ActionButton disabled={busy || !online} onClick={() => void load()}>Refresh</ActionButton></div>
    <div className="space-y-3 p-3">
      {error ? <ErrorNotice message={error} /> : null}
      {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
      {!online ? <p className="text-sm">Linehaul requires a connection.</p> : null}
      {overview && !overview.enabled ? <p className="text-sm text-amber-700 dark:text-amber-300">New routes and departures are paused. Incoming manifests can still be received.</p> : null}
      <form onSubmit={(event) => { event.preventDefault(); void depart() }} className="space-y-2">
        {overview?.ready_groups.map((group) => <div key={group.next_hub} className="flex flex-wrap items-center justify-between gap-2 border border-zinc-200 p-2 text-sm dark:border-white/10"><span>{group.next_hub} · {group.references.length} ready parcels</span><ActionButton disabled={busy || uncertain} onClick={() => setReferences(group.references.join('\n'))}>Use this group</ActionButton></div>)}
        <label className="block text-sm font-medium">Parcels for one next hub<textarea className={field + ' mt-1 min-h-24'} required value={references} disabled={busy || uncertain} onChange={(event) => setReferences(event.target.value)} placeholder="One tracking ID per line" /></label>
        <p className="text-xs text-zinc-500">Up to 100 sorted parcels. The server checks each route and transfers the complete manifest together.</p>
        <PrimaryButton type="submit" busy={busy} disabled={!online || (!uncertain && !overview?.enabled)}>{uncertain ? 'Retry manifest departure' : 'Confirm manifest departure'}</PrimaryButton>
      </form>
      <div className="border-t border-zinc-200 pt-3 dark:border-white/10"><h4 className="text-sm font-semibold">Recent manifests</h4>
        {overview?.manifests.length ? overview.manifests.map((manifest) => <article className="border-b border-zinc-200 py-3 text-sm dark:border-white/10" key={manifest.id}><p>{manifest.from_hub} → {manifest.to_hub}</p><p className="text-xs text-zinc-500">{manifest.references.length} parcels · {manifest.status.replaceAll('_', ' ')}</p><details><summary className="cursor-pointer break-all text-xs">Manifest {manifest.id}</summary><ul className="break-all font-mono text-xs">{manifest.references.map((reference) => <li key={reference}>{reference}</li>)}</ul></details>{manifest.can_receive ? <ActionButton disabled={busy || !online} onClick={() => { if (window.confirm('Confirm all ' + manifest.references.length + ' parcels have physically arrived? Reconcile missing parcels before confirming.')) void write('/api/v1/logistics/linehaul/manifests/' + manifest.id + '/receive', {}) }}>Receive all parcels</ActionButton> : null}</article>) : <p className="py-2 text-xs text-zinc-500">No manifests yet.</p>}
      </div>
      <details className="border-t border-zinc-200 pt-3 dark:border-white/10"><summary className="cursor-pointer text-sm font-medium">Hub coverage and outgoing connections</summary>
        <p className="my-2 text-xs text-zinc-500">Manage this hub's routes without platform approval. Changes apply to future parcel routes.</p>
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void write('/api/v1/logistics/linehaul/service-areas', { postal_code: postal, is_active: !area?.is_active, expected_revision: area?.revision }) }}><label className="block text-xs">Recipient postal code<input className={field + ' mt-1'} required pattern="\d{4}" maxLength={4} value={postal} onChange={(event) => setPostal(event.target.value)} /></label><ActionButton type="submit" disabled={busy || !online}>{area?.is_active ? 'Stop serving postal code' : 'Serve postal code'}</ActionButton><p className="text-xs text-zinc-500">Serving: {overview?.service_areas.filter((item) => item.is_active).map((item) => item.postal_code).join(', ') || 'None'}</p></form>
        <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); void write('/api/v1/logistics/linehaul/connections', { to_hub_id: target, is_active: true, expected_revision: connection?.revision, distance_meters: distance ? Number(distance) * 1000 : null, duration_seconds: minutes ? Number(minutes) * 60 : null }) }}>
          <label className="block text-xs">Next hub<select className={field + ' mt-1'} required value={target} onChange={(event) => { const value = event.target.value; setTarget(value); const row = overview?.connections.find((item) => item.to_hub_id === value); setDistance(row?.distance_meters ? String(row.distance_meters / 1000) : ''); setMinutes(row?.duration_seconds ? String(row.duration_seconds / 60) : '') }}><option value="">Choose hub</option>{overview?.hubs.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}</select></label>
          <label className="block text-xs">Known road distance (km, optional)<input className={field + ' mt-1'} type="number" min="0.001" step="any" value={distance} onChange={(event) => setDistance(event.target.value)} required={!!minutes} /></label>
          <label className="block text-xs">Known driving time (minutes, optional)<input className={field + ' mt-1'} type="number" min="0.01" step="any" value={minutes} onChange={(event) => setMinutes(event.target.value)} required={!!distance} /></label>
          <p className="text-xs text-zinc-500">Enter both measured road values, or leave both blank for Geoapify. Routing adds 30 minutes per transfer for handling.</p>
          <div className="flex flex-wrap gap-2"><ActionButton type="submit" disabled={busy || !online}>Save connection</ActionButton>{connection?.is_active ? <ActionButton disabled={busy || !online} onClick={() => { if (window.confirm('Disable this connection? Existing route departures will be held.')) void write('/api/v1/logistics/linehaul/connections', { to_hub_id: target, is_active: false, expected_revision: connection.revision, distance_meters: connection.distance_meters, duration_seconds: connection.duration_seconds }) }}>Disable connection</ActionButton> : null}</div>
        </form>
      </details>
    </div>
  </section>
}
