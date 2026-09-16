import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowsRotate, FaLink, FaPen, FaPlus, FaPowerOff, FaPrint, FaRoute, FaTrashCan, FaWarehouse, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from '../components/PickupUi'
import { ApiError, blob as requestBlob, csrf, request, requestWithTimeout } from '../lib/api'
import type { SortingLane, SortingPlansOverview } from '../types/sorting'

const iconButton = 'grid size-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white'

export function SortPlanPage() {
  const [overview, setOverview] = useState<SortingPlansOverview | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanActive, setNewPlanActive] = useState(true)
  const [planName, setPlanName] = useState('')
  const [planActive, setPlanActive] = useState(false)
  const [laneId, setLaneId] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [mappingPosition, setMappingPosition] = useState('1')
  const [editingLane, setEditingLane] = useState<SortingLane | null>(null)
  const [laneCode, setLaneCode] = useState('')
  const [laneName, setLaneName] = useState('')
  const [laneType, setLaneType] = useState<SortingLane['type']>('standard')
  const [lanePosition, setLanePosition] = useState('1')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const laneDialog = useRef<HTMLDialogElement>(null)

  const selectedPlan = overview?.plans.find((plan) => plan.id === selectedPlanId) ?? null
  const standardLanes = useMemo(() => overview?.lanes.filter((lane) => lane.type === 'standard' && lane.is_active) ?? [], [overview?.lanes])
  const exceptionLanes = useMemo(() => overview?.lanes.filter((lane) => lane.type === 'exception' && lane.is_active) ?? [], [overview?.lanes])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await requestWithTimeout<{ data: SortingPlansOverview }>('/api/v1/logistics/sorting/plans')
      setOverview(result.data)
      setSelectedPlanId((current) => result.data.plans.some((plan) => plan.id === current) ? current : (result.data.active_plan_id ?? result.data.plans[0]?.id ?? ''))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sort plans could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { document.title = 'Sort plan | Aisley Logistics'; void load() }, [load])
  useEffect(() => {
    if (!selectedPlan) return
    setPlanName(selectedPlan.name)
    setPlanActive(selectedPlan.is_active)
    setLaneId((current) => standardLanes.some((lane) => lane.id === current) ? current : (standardLanes[0]?.id ?? ''))
    setMappingPosition(String((selectedPlan.lanes.length || 0) + 1))
  }, [selectedPlan, standardLanes])

  async function createPlan(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans', { method: 'POST', body: JSON.stringify({ name: newPlanName, is_active: newPlanActive }) })
      setNewPlanName('')
      setNotice('Sort plan created.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sort plan could not be created.')
    } finally { setBusy(false) }
  }

  async function savePlan(event: FormEvent) {
    event.preventDefault()
    if (!selectedPlan) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id, {
        method: 'PATCH',
        body: JSON.stringify({ expected_revision: selectedPlan.revision, name: planName, is_active: planActive }),
      })
      setNotice('Sort plan updated.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sort plan could not be updated.')
    } finally { setBusy(false) }
  }

  async function addMapping(event: FormEvent) {
    event.preventDefault()
    if (!selectedPlan || !laneId) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id + '/lanes', {
        method: 'POST',
        body: JSON.stringify({ expected_revision: selectedPlan.revision, lane_id: laneId, postal_code: postalCode, position: Number(mappingPosition) }),
      })
      setPostalCode('')
      setNotice('Postal code mapped to the sort plan.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The postal-code mapping could not be saved.')
    } finally { setBusy(false) }
  }

  async function removeMapping(mappingId: string, postal: string) {
    if (!selectedPlan || !window.confirm('Remove postal code ' + postal + ' from ' + selectedPlan.name + '?')) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id + '/lanes/' + mappingId, {
        method: 'DELETE',
        body: JSON.stringify({ expected_revision: selectedPlan.revision }),
      })
      setNotice('Postal-code mapping removed.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The postal-code mapping could not be removed.')
    } finally { setBusy(false) }
  }

  function openLaneEditor(lane?: SortingLane) {
    setEditingLane(lane ?? null)
    setLaneCode(lane?.code ?? '')
    setLaneName(lane?.name ?? '')
    setLaneType(lane?.type ?? 'standard')
    setLanePosition(String(lane?.position ?? ((overview?.lanes.length ?? 0) + 1)))
    laneDialog.current?.showModal()
  }

  async function saveLane(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      const body = { code: laneCode, name: laneName, type: laneType, position: Number(lanePosition), ...(editingLane ? { expected_revision: editingLane.revision } : {}) }
      await request(editingLane ? '/api/v1/logistics/sorting/lanes/' + editingLane.id : '/api/v1/logistics/sorting/lanes', {
        method: editingLane ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      laneDialog.current?.close()
      setNotice(editingLane ? 'Sorting lane updated.' : 'Sorting lane created.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sorting lane could not be saved.')
    } finally { setBusy(false) }
  }

  async function toggleLane(lane: SortingLane) {
    if (lane.is_active && !window.confirm('Deactivate ' + lane.code + '? Automatic routing will use the exception lane until it is active again.')) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/lanes/' + lane.id, { method: 'PATCH', body: JSON.stringify({ expected_revision: lane.revision, is_active: !lane.is_active }) })
      setNotice(lane.is_active ? lane.code + ' deactivated.' : lane.code + ' activated.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sorting lane could not be changed.')
    } finally { setBusy(false) }
  }

  async function openLabel(lane: SortingLane) {
    const popup = window.open('about:blank', '_blank')
    if (!popup) { setError('Allow pop-ups to open the printable lane label.'); return }
    popup.opener = null
    try {
      const asset = await requestBlob(lane.label_url)
      const objectUrl = URL.createObjectURL(asset)
      popup.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (caught) {
      popup.close()
      setError(caught instanceof ApiError ? caught.message : 'The lane label could not be opened.')
    }
  }

  return <div className="mx-auto max-w-[1280px] px-3 py-3 sm:px-5 lg:px-6">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-white/10">
      <div className="flex min-w-0 items-start gap-3"><FaRoute className="mt-1 shrink-0 text-[#4C1268] dark:text-purple-300" aria-hidden="true" /><div><h2 className="text-xl font-semibold">Sort plan</h2><p className="max-w-2xl text-sm text-zinc-500">Map exact recipient postal codes to standard lanes. The active plan is used when a parcel waybill is scanned.</p></div></div>
      <div className="flex items-center gap-2"><button aria-label="Refresh sort plan" className={iconButton} disabled={loading} onClick={() => void load()} title="Refresh" type="button"><FaArrowsRotate className={loading ? 'animate-spin' : ''} aria-hidden="true" /></button><Link className="inline-flex h-9 items-center gap-2 border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/10" to="/sorting"><FaWarehouse aria-hidden="true" />Sorting</Link></div>
    </div>

    {error ? <div className="mt-3"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice ? <p className="mt-3 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}

    <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <div className="space-y-3">
        <section className={panel}>
          <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><h3 className="font-semibold">Plans</h3><p className="text-xs text-zinc-500">Only one plan can be active for this hub.</p></div>
          <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,20rem)]">
            <div className="min-w-0">
              {overview?.plans.length ? <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-white/10 dark:border-white/10">{overview.plans.map((plan) => <button className={(plan.id === selectedPlanId ? 'bg-purple-50/70 dark:bg-purple-400/10 ' : '') + 'flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04]'} key={plan.id} onClick={() => setSelectedPlanId(plan.id)} type="button"><span className="min-w-0"><strong className="block truncate text-sm">{plan.name}</strong><span className="block text-xs text-zinc-500">{plan.lanes.length} postal mapping{plan.lanes.length === 1 ? '' : 's'} · revision {plan.revision}</span></span>{plan.is_active ? <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">Active</span> : <span className="shrink-0 text-xs text-zinc-500">Inactive</span>}</button>)}</div> : <p className="border border-dashed border-zinc-300 px-3 py-5 text-center text-sm text-zinc-500 dark:border-white/15">No sort plans yet.</p>}
            </div>
            <form className="border border-zinc-200 p-3 dark:border-white/10" onSubmit={(event) => void createPlan(event)}>
              <h4 className="text-sm font-semibold">Create plan</h4>
              <label className="mt-3 block text-xs font-medium">Plan name<input className={field + ' mt-1'} maxLength={80} onChange={(event) => setNewPlanName(event.target.value)} placeholder="Metro Manila outbound" required value={newPlanName} /></label>
              <label className="mt-3 flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400"><input checked={newPlanActive} className="mt-0.5" onChange={(event) => setNewPlanActive(event.target.checked)} type="checkbox" /><span>Make this the active plan</span></label>
              <PrimaryButton className="mt-3 w-full" busy={busy} type="submit"><FaPlus aria-hidden="true" />Create plan</PrimaryButton>
            </form>
          </div>
        </section>

        {selectedPlan ? <section className={panel}>
          <form onSubmit={(event) => void savePlan(event)}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><div><h3 className="font-semibold">Plan settings</h3><p className="text-xs text-zinc-500">Changes affect future scans. A scan always rechecks the current active plan.</p></div><span className="text-xs text-zinc-500">Revision {selectedPlan.revision}</span></div>
            <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="text-sm font-medium">Name<input className={field + ' mt-1'} maxLength={80} onChange={(event) => setPlanName(event.target.value)} required value={planName} /></label><label className="flex items-center gap-2 pb-2 text-sm"><input checked={planActive} onChange={(event) => setPlanActive(event.target.checked)} type="checkbox" />Active plan</label></div>
            <div className="flex justify-end border-t border-zinc-200 px-3 py-2.5 dark:border-white/10"><PrimaryButton busy={busy} type="submit">Save plan</PrimaryButton></div>
          </form>
          <div className="border-t border-zinc-200 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"><div><h3 className="font-semibold">Postal-code routing</h3><p className="text-xs text-zinc-500">One exact four-digit postal code maps to one standard lane.</p></div><span className="text-xs text-zinc-500">{selectedPlan.lanes.length} mapped</span></div>
            <form className="grid gap-2 border-y border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_minmax(8rem,11rem)_5rem_auto] sm:items-end" onSubmit={(event) => void addMapping(event)}>
              <label className="text-xs font-medium">Standard lane<select className={field + ' mt-1'} onChange={(event) => setLaneId(event.target.value)} required value={laneId}><option value="">Choose lane</option>{standardLanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.code} · {lane.name}</option>)}</select></label>
              <label className="text-xs font-medium">Postal code<input className={field + ' mt-1 font-mono'} inputMode="numeric" maxLength={4} onChange={(event) => setPostalCode(event.target.value)} pattern="\d{4}" placeholder="1000" required value={postalCode} /></label>
              <label className="text-xs font-medium">Position<input className={field + ' mt-1'} min="1" max="999" onChange={(event) => setMappingPosition(event.target.value)} required type="number" value={mappingPosition} /></label>
              <PrimaryButton busy={busy} disabled={!standardLanes.length} type="submit"><FaLink aria-hidden="true" />Map</PrimaryButton>
            </form>
            {selectedPlan.lanes.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{selectedPlan.lanes.map((mapping) => <li className="flex items-center justify-between gap-3 px-3 py-2.5" key={mapping.id}><div className="min-w-0"><p className="font-mono text-sm font-semibold">{mapping.postal_code}</p><p className="truncate text-xs text-zinc-500">{mapping.lane?.code ?? 'Lane unavailable'}{mapping.lane?.name ? ' · ' + mapping.lane.name : ''}</p></div><button aria-label={'Remove postal code ' + mapping.postal_code} className={iconButton} disabled={busy} onClick={() => void removeMapping(mapping.id, mapping.postal_code)} title="Remove mapping" type="button"><FaTrashCan aria-hidden="true" /></button></li>)}</ul> : <p className="px-3 py-5 text-center text-sm text-zinc-500">Add a postal code to start automatic routing.</p>}
          </div>
        </section> : <section className={panel}><p className="p-5 text-sm text-zinc-500">Create or select a sort plan to configure postal-code routing.</p></section>}
      </div>

      <aside className="space-y-3">
        <section className={panel}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><div><h3 className="font-semibold">Hub lanes</h3><p className="text-xs text-zinc-500">Create physical lanes and print labels here.</p></div><button aria-label="Add sorting lane" className={iconButton} onClick={() => openLaneEditor()} title="Add lane" type="button"><FaPlus aria-hidden="true" /></button></div>
          {overview?.lanes.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{overview.lanes.map((lane) => <li className="flex items-center gap-1 px-1" key={lane.id}><div className="min-w-0 flex-1 px-2 py-2.5"><p className="flex items-center gap-2"><strong className="font-mono text-sm">{lane.code}</strong>{lane.type === 'exception' ? <span className="text-xs text-amber-700 dark:text-amber-300">Exception</span> : null}{!lane.is_active ? <span className="text-xs text-zinc-500">Inactive</span> : null}</p><p className="truncate text-xs text-zinc-500">{lane.name}</p></div><button aria-label={'Print ' + lane.code + ' label'} className={iconButton} onClick={() => void openLabel(lane)} title="Open printable label" type="button"><FaPrint aria-hidden="true" /></button><button aria-label={'Edit ' + lane.code} className={iconButton} onClick={() => openLaneEditor(lane)} title="Edit lane" type="button"><FaPen aria-hidden="true" /></button><button aria-label={(lane.is_active ? 'Deactivate ' : 'Activate ') + lane.code} className={iconButton} disabled={busy} onClick={() => void toggleLane(lane)} title={lane.is_active ? 'Deactivate lane' : 'Activate lane'} type="button"><FaPowerOff aria-hidden="true" /></button></li>)}</ul> : <p className="px-3 py-5 text-center text-sm text-zinc-500">Create a standard lane and an exception lane.</p>}
        </section>
        <section className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          <h3 className="font-semibold">Automatic routing rule</h3>
          <p className="mt-1 text-xs leading-5">A parcel scan resolves its tracking ID, reads the buyer postal code, and checks this hub's active plan. No plan, no postal-code match, or an unavailable mapped lane sends it to an active exception lane and keeps custody at received at hub.</p>
          {!exceptionLanes.length ? <p className="mt-2 text-xs font-semibold">Create an active exception lane before scanning automatically.</p> : null}
        </section>
      </aside>
    </div>

    <dialog className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={laneDialog}>
      <form onSubmit={(event) => void saveLane(event)}><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">{editingLane ? 'Edit lane' : 'Add lane'}</h3><button aria-label="Close lane form" className={iconButton} onClick={() => laneDialog.current?.close()} title="Close" type="button"><FaXmark aria-hidden="true" /></button></div><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="text-sm font-medium">Code<input autoFocus className={field + ' mt-1 uppercase'} maxLength={24} onChange={(event) => setLaneCode(event.target.value)} placeholder="NCR-01" required value={laneCode} /></label><label className="text-sm font-medium">Position<input className={field + ' mt-1'} min="1" max="999" onChange={(event) => setLanePosition(event.target.value)} required type="number" value={lanePosition} /></label><label className="text-sm font-medium sm:col-span-2">Name<input className={field + ' mt-1'} maxLength={80} onChange={(event) => setLaneName(event.target.value)} placeholder="NCR staging lane" required value={laneName} /></label><label className="text-sm font-medium sm:col-span-2">Type<select className={field + ' mt-1'} onChange={(event) => setLaneType(event.target.value as SortingLane['type'])} value={laneType}><option value="standard">Standard — maps postal codes and marks sorted</option><option value="exception">Exception — holds unmatched parcels</option></select></label></div><div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10"><ActionButton onClick={() => laneDialog.current?.close()} type="button">Cancel</ActionButton><PrimaryButton busy={busy} type="submit">Save lane</PrimaryButton></div></form>
    </dialog>
  </div>
}
