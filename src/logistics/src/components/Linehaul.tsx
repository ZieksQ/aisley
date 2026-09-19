import { Link } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, csrf, requestWithTimeout } from '../lib/api'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from './PickupUi'

type Manifest = { id: string; status: string; from_hub: string; to_hub: string; references: string[]; can_receive: boolean }
type Connection = { id: string; from_hub_id: string; from_hub?: { name: string }; sender_requested: boolean; receiver_accepted: boolean; to_hub_id: string; is_active: boolean; revision: number }
type Area = { postal_code: string; is_active: boolean; revision: number }
type ReadyGroup = { next_hub_id: string; next_hub: string; references: string[] }
type Overview = { enabled: boolean; ready_groups: ReadyGroup[]; manifests: Manifest[]; hubs: { id: string; name: string; business_name: string; city_municipality: string | null; province: string | null }[]; hub_directory: { current_page: number; last_page: number; total: number }; service_areas: Area[]; connections: Connection[]; incoming_connections: Connection[] }

export function Linehaul({ online, mode = 'partners' }: { online: boolean; mode?: 'partners' | 'operations' }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const loadVersion = useRef(0)
  const pending = useRef<{ key: string; nextHubId: string } | null>(null)
  const requestsDialog = useRef<HTMLDialogElement>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  const load = useCallback(async () => {
    const version = ++loadVersion.current
    if (!online) return
    try { const result = await requestWithTimeout<{ data: Overview }>('/api/v1/logistics/linehaul?' + new URLSearchParams({ search, page: String(page) })); if (version === loadVersion.current) setOverview(result.data) }
    catch (caught) { if (version === loadVersion.current) setError(caught instanceof Error ? caught.message : 'Linehaul could not be loaded.') }
  }, [online, search, page])
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

  const incomingRequests = overview?.incoming_connections.filter((item) => item.sender_requested && !item.receiver_accepted) ?? []
  return <section className={panel} aria-labelledby="linehaul-title">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h3 id="linehaul-title" className="font-semibold">{mode === 'partners' ? 'Linehaul partners' : 'Linehaul handoffs'}</h3><div className="flex gap-1">{mode === 'partners' ? <ActionButton disabled={!online} onClick={() => requestsDialog.current?.showModal()}>Connection requests ({incomingRequests.length})</ActionButton> : null}<button aria-label="How Linehaul works" className="grid size-9 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10" onClick={() => helpDialog.current?.showModal()} title="Help" type="button">?</button><ActionButton disabled={busy || !online} onClick={() => void load()}>Refresh</ActionButton></div></div>
    <div className="space-y-2 p-3">
      {error ? <ErrorNotice message={error} /> : null}
      {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
      {!online ? <p className="text-sm">Linehaul requires an internet connection.</p> : null}
      {overview && !overview.enabled ? <p className="text-sm text-amber-700 dark:text-amber-300">New routes and departures are paused. Incoming manifests can still be received.</p> : null}
      {mode === 'partners' ? <div className="space-y-2">
        <h4 className="text-sm font-semibold">Logistics partners</h4>
        <label className="block text-xs">Search Logistics or location<input type="search" className={field + ' mt-1'} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label>
        <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-white/10 dark:border-white/10">
          {overview?.hubs.map((hub) => {
            const outgoing = overview.connections.find((item) => item.to_hub_id === hub.id)
            const incoming = overview.incoming_connections.find((item) => item.from_hub_id === hub.id)
            const connected = (outgoing?.is_active && outgoing.receiver_accepted) || (incoming?.is_active && incoming.receiver_accepted)
            return <div key={hub.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 text-sm last:border-0 dark:border-white/10">
              <div><p className="font-medium">{hub.business_name}</p><p className="text-xs text-zinc-500">{hub.name} · {[hub.city_municipality, hub.province].filter(Boolean).join(', ') || 'Location unavailable'}</p><p className="mt-1 text-xs">{connected ? 'Connected' : outgoing?.sender_requested ? 'Request pending' : incoming?.sender_requested ? 'Decision pending' : 'Not connected'}</p></div>
              <div className="flex flex-wrap gap-2">
                {!outgoing?.sender_requested && !connected ? <ActionButton disabled={busy || !online} onClick={() => void write('/api/v1/logistics/linehaul/connections', { to_hub_id: hub.id, is_active: true, expected_revision: outgoing?.revision })}>Request</ActionButton> : null}
                {outgoing?.sender_requested ? <ActionButton disabled={busy || !online} onClick={() => { if (window.confirm(connected ? 'Disconnect this Logistics partner? New departures will be held.' : 'Withdraw this connection request?')) void write('/api/v1/logistics/linehaul/connections', { to_hub_id: hub.id, is_active: false, expected_revision: outgoing.revision }) }}>{outgoing.receiver_accepted ? 'Disconnect' : 'Withdraw request'}</ActionButton> : null}
                {incoming?.is_active && incoming.receiver_accepted && !outgoing?.sender_requested ? <ActionButton disabled={busy || !online} onClick={() => { if (window.confirm('Disconnect this Logistics partner? New departures will be held.')) void write('/api/v1/logistics/linehaul/connections/' + incoming.id + '/consent', { accept: false, expected_revision: incoming.revision }) }}>Disconnect</ActionButton> : null}
              </div>
            </div>
          })}
          {overview && !overview.hubs.length ? <p className="p-3 text-sm text-zinc-500">No Logistics partners found.</p> : null}
        </div>
        {overview ? <div className="flex items-center justify-between gap-2 text-xs"><span>{overview.hub_directory.total} Logistics partners · Page {overview.hub_directory.current_page} of {overview.hub_directory.last_page}</span><div className="flex gap-2"><ActionButton disabled={busy || !online || page <= 1} onClick={() => setPage(page - 1)}>Previous</ActionButton><ActionButton disabled={busy || !online || page >= overview.hub_directory.last_page} onClick={() => setPage(page + 1)}>Next</ActionButton></div></div> : null}
        <Link to="/sort-plan" className="inline-block text-sm text-primary underline">Open sort plan</Link>
      </div> : null}
      {mode === 'operations' ? <>
      {uncertain && pending.current ? <ActionButton disabled={busy || !online} onClick={() => void depart({ next_hub_id: pending.current!.nextHubId, next_hub: '', references: [] })}>Retry pending departure</ActionButton> : null}
      <div className="space-y-2">
        <div><h4 className="text-sm font-semibold">Ready linehaul groups</h4><p className="mt-1 text-xs text-zinc-500">The active sort plan and route decide group membership. Parcels going to the same next hub depart in one manifest.</p></div>
        {overview?.ready_groups.length ? overview.ready_groups.map((group) => <div key={group.next_hub_id} className="flex flex-wrap items-center justify-between gap-3 border border-zinc-200 p-3 text-sm dark:border-white/10"><div><p className="font-medium">{group.next_hub}</p><p className="text-xs text-zinc-500">{group.references.length} ready parcels · selected automatically from Sorting</p></div><PrimaryButton busy={busy && pending.current?.nextHubId === group.next_hub_id} disabled={!online || !overview.enabled || busy || uncertain} onClick={() => void depart(group)}>{uncertain && pending.current?.nextHubId === group.next_hub_id ? 'Retry departure' : 'Confirm departure'}</PrimaryButton></div>) : <p className="border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-white/15">No linehaul groups are ready. Complete the configured next-hub sort lane first.</p>}
        <p className="text-xs text-zinc-500">You confirm only the physical truck departure. You do not enter parcel IDs; the server takes the current eligible parcels for the selected route group.</p>
      </div>
      <div className="border-t border-zinc-200 pt-3 dark:border-white/10"><h4 className="text-sm font-semibold">Recent manifests</h4>
        {overview?.manifests.length ? overview.manifests.map((manifest) => <article className="border-b border-zinc-200 py-3 text-sm dark:border-white/10" key={manifest.id}><p>{manifest.from_hub} → {manifest.to_hub}</p><p className="text-xs text-zinc-500">{manifest.references.length} parcels · {manifest.status.replaceAll('_', ' ')}</p><details><summary className="cursor-pointer break-all text-xs">Manifest {manifest.id}</summary><ul className="break-all font-mono text-xs">{manifest.references.map((reference) => <li key={reference}>{reference}</li>)}</ul></details>{manifest.can_receive ? <ActionButton disabled={busy || !online} onClick={() => { if (window.confirm('Confirm all ' + manifest.references.length + ' parcels have physically arrived? Reconcile missing parcels before confirming.')) void write('/api/v1/logistics/linehaul/manifests/' + manifest.id + '/receive', {}) }}>Receive all parcels</ActionButton> : null}</article>) : <p className="py-2 text-xs text-zinc-500">No manifests yet.</p>}
      </div>
      </> : null}

    </div>
    <dialog aria-labelledby="linehaul-requests-title" className="m-auto max-h-[90dvh] w-[min(94vw,38rem)] overflow-y-auto border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={requestsDialog}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h4 id="linehaul-requests-title" className="font-semibold">Connection requests</h4><ActionButton onClick={() => requestsDialog.current?.close()}>Close</ActionButton></div>
      {incomingRequests.length ? <div className="divide-y divide-zinc-200 dark:divide-white/10">{incomingRequests.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"><span>{item.from_hub?.name ?? 'Unavailable hub'}</span><div className="flex gap-2"><ActionButton disabled={busy || !online} onClick={() => void write('/api/v1/logistics/linehaul/connections/' + item.id + '/consent', { accept: true, expected_revision: item.revision })}>Accept</ActionButton><ActionButton disabled={busy || !online} onClick={() => { if (window.confirm('Decline this connection request?')) void write('/api/v1/logistics/linehaul/connections/' + item.id + '/consent', { accept: false, expected_revision: item.revision }) }}>Decline</ActionButton></div></div>)}</div> : <p className="px-3 py-4 text-sm text-zinc-500">No pending requests.</p>}
    </dialog>
    <dialog aria-labelledby="linehaul-help-title" className="m-auto max-h-[90dvh] w-[min(94vw,32rem)] overflow-y-auto border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={helpDialog}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h4 id="linehaul-help-title" className="font-semibold">How Linehaul works</h4><ActionButton onClick={() => helpDialog.current?.close()}>Close</ActionButton></div>
      {mode === 'partners' ? <ol className="list-decimal space-y-2 p-4 pl-8 text-sm"><li>Search for another Logistics partner and request a connection.</li><li>The receiving partner accepts from Connection requests. Pending requests can be withdrawn.</li><li>Connected next hubs can be mapped to physical lanes in Sort plan.</li><li>Use Sorting to confirm grouped departures and incoming receipts.</li></ol> : <ol className="list-decimal space-y-2 p-4 pl-8 text-sm"><li>Sort transfer parcels into their mapped next-hub lane.</li><li>Confirm physical departure for a ready group. The server selects eligible parcels and freezes the manifest.</li><li>The receiving hub checks every parcel and confirms the complete receipt before sorting again.</li><li>Retry a departure with the same request if the network result is uncertain.</li></ol>}
    </dialog>
  </section>
}
