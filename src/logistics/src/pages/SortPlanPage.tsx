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
  const [destinationType, setDestinationType] = useState<'postal_code' | 'hub'>('postal_code')
  const [destinationHubId, setDestinationHubId] = useState('')
  const helpDialog = useRef<HTMLDialogElement>(null)
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
  const planDialog = useRef<HTMLDialogElement>(null)
  const [creatingPlan, setCreatingPlan] = useState(false)

  function openPlanEditor(create: boolean) {
    setError('')
    setCreatingPlan(create)
    if (!create && selectedPlan) { setPlanName(selectedPlan.name); setPlanActive(selectedPlan.is_active) }
    planDialog.current?.showModal()
  }

  async function deletePlan() {
    if (!selectedPlan || !window.confirm('Delete ' + selectedPlan.name + ' and its mappings? ' + (selectedPlan.is_active ? 'Automatic sorting will use the exception lane until another plan is activated.' : 'Previous scan history is preserved.'))) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id, { method: 'DELETE', body: JSON.stringify({ expected_revision: selectedPlan.revision }) })
      setNotice('Sort plan deleted.')
      await load()
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The plan could not be deleted.') }
    finally { setBusy(false) }
  }

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
      const result = await request<{ data: { id: string } }>('/api/v1/logistics/sorting/plans', { method: 'POST', body: JSON.stringify({ name: newPlanName, is_active: newPlanActive }) })
      setSelectedPlanId(result.data.id)
      setNewPlanName('')
      planDialog.current?.close()
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
      planDialog.current?.close()
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
        body: JSON.stringify({ expected_revision: selectedPlan.revision, lane_id: laneId, destination_type: destinationType, ...(destinationType === 'hub' ? { destination_hub_id: destinationHubId } : { postal_code: postalCode }), position: Number(mappingPosition) }),
      })
      setPostalCode('')
      setDestinationHubId('')
      setNotice('Destination mapped to the sort plan.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The destination mapping could not be saved.')
    } finally { setBusy(false) }
  }

  async function removeMapping(mappingId: string, postal: string) {
    if (!selectedPlan || !window.confirm('Remove destination ' + postal + ' from ' + selectedPlan.name + '?')) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id + '/lanes/' + mappingId, {
        method: 'DELETE',
        body: JSON.stringify({ expected_revision: selectedPlan.revision }),
      })
      setNotice('Destination mapping removed.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The destination mapping could not be removed.')
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

  return <div className="mx-auto max-w-[1500px] px-3 py-3">
    <div className="relative flex items-start justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-white/10">
      <div className="flex min-w-0 items-start gap-2 pr-32"><FaRoute className="mt-1 shrink-0 text-[#4C1268] dark:text-purple-300" aria-hidden="true" /><div><h2 className="text-lg font-semibold">Sort plan</h2></div></div>
      <div className="absolute right-0 top-0 flex items-center gap-1"><button aria-label="How sort plans and linehaul work" title="Help" className={iconButton} onClick={() => helpDialog.current?.showModal()} type="button"><span aria-hidden="true">?</span></button><button aria-label="Refresh sort plan" className={iconButton} disabled={loading} onClick={() => void load()} title="Refresh" type="button"><FaArrowsRotate className={loading ? 'animate-spin' : ''} aria-hidden="true" /></button><Link aria-label="Open Sorting" title="Sorting" className={iconButton} to="/sorting"><FaWarehouse aria-hidden="true" /></Link></div>
    </div>

    {error ? <div className="mt-3"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice ? <p className="mt-3 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}

    <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <div className="space-y-3">
        <section className={panel}>
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><div><h3 className="font-semibold">Plans</h3><p className="text-xs text-zinc-500">Select a plan to manage its destination lanes. Only the active plan routes scans.</p></div><ActionButton onClick={() => openPlanEditor(true)}><FaPlus aria-hidden="true" />New plan</ActionButton></div>
          <div className="p-3">
            <div className="min-w-0">
              {overview?.plans.length ? <div className="divide-y divide-zinc-200 border border-zinc-200 dark:divide-white/10 dark:border-white/10">{overview.plans.map((plan) => <button className={(plan.id === selectedPlanId ? 'bg-purple-50/70 dark:bg-purple-400/10 ' : '') + 'flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04]'} key={plan.id} onClick={() => setSelectedPlanId(plan.id)} type="button"><span className="min-w-0"><strong className="block truncate text-sm">{plan.name}</strong><span className="block text-xs text-zinc-500">{plan.lanes.length} destination mapping{plan.lanes.length === 1 ? '' : 's'} · revision {plan.revision}</span></span>{plan.is_active ? <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">Active</span> : <span className="shrink-0 text-xs text-zinc-500">Inactive</span>}</button>)}</div> : <p className="border border-dashed border-zinc-300 px-3 py-5 text-center text-sm text-zinc-500 dark:border-white/15">No sort plans yet.</p>}
            </div>
          </div>
        </section>

        {selectedPlan ? <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"><div><h3 className="font-semibold">{selectedPlan.name}</h3><p className="text-xs text-zinc-500">{selectedPlan.is_active ? 'Active — routes current scans' : 'Inactive — activate to route scans'}</p></div><div className="flex gap-2"><ActionButton disabled={busy} onClick={() => openPlanEditor(false)}><FaPen aria-hidden="true" />Edit plan</ActionButton><ActionButton disabled={busy} onClick={() => void deletePlan()}><FaTrashCan aria-hidden="true" />Delete</ActionButton></div></div>
          <div className="border-t border-zinc-200 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"><div><h3 className="font-semibold">Destination → physical lane</h3><p className="text-xs text-zinc-500">Final mile uses the recipient postal code. Linehaul uses the next hub on the parcel route.</p></div><span className="text-xs text-zinc-500">{selectedPlan.lanes.length} mapped</span></div>
            <form className="grid gap-2 border-y border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_4rem_auto] sm:items-end" onSubmit={(event) => void addMapping(event)}>
              <label className="min-w-0 text-xs font-medium">Standard lane<select className={field + ' mt-1'} onChange={(event) => setLaneId(event.target.value)} required value={laneId}><option value="">Choose lane</option>{standardLanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.code} · {lane.name}</option>)}</select></label>
              <label className="text-xs font-medium">Destination type<select className={field + ' mt-1'} value={destinationType} onChange={(event) => setDestinationType(event.target.value as 'postal_code' | 'hub')}><option value="postal_code">Postal code</option><option value="hub">Next hub</option></select></label>
              {destinationType === 'hub' ? <label className="min-w-0 text-xs font-medium">Next hub<select className={field + ' mt-1'} required value={destinationHubId} onChange={(event) => setDestinationHubId(event.target.value)}><option value="">Choose active hub</option>{overview?.next_hubs?.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}</select></label> : <label className="text-xs font-medium">Postal code<input className={field + ' mt-1 font-mono'} inputMode="numeric" maxLength={4} onChange={(event) => setPostalCode(event.target.value)} pattern="\d{4}" placeholder="1000" required value={postalCode} /></label>}
              <label className="text-xs font-medium">Position<input className={field + ' mt-1'} min="1" max="999" onChange={(event) => setMappingPosition(event.target.value)} required type="number" value={mappingPosition} /></label>
              <PrimaryButton busy={busy} disabled={!standardLanes.length || (destinationType === 'hub' && !overview?.next_hubs?.length)} type="submit"><FaLink aria-hidden="true" />Map</PrimaryButton>
            </form>
            {destinationType === 'hub' ? <p className="px-3 py-2 text-xs text-zinc-500">{overview?.next_hubs?.length ? 'Map the next hub to its physical lane. Sorting uses it when the committed minimum-time route selects that hub.' : 'No accepted outgoing connections. Request a connection on the Linehaul page and ask the receiving Logistics organization to accept it.'}</p> : null}
            {selectedPlan.lanes.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{selectedPlan.lanes.map((mapping) => <li className="flex items-center justify-between gap-3 px-3 py-2.5" key={mapping.id}><div className="min-w-0"><p className="break-all text-sm font-semibold">{mapping.destination_type === 'hub' ? (overview?.next_hubs?.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'Unavailable hub') : mapping.postal_code}</p><p className="text-xs text-zinc-500">{mapping.destination_type === 'hub' ? 'Next hub' : 'Postal code'}</p><p className="truncate text-xs text-zinc-500">{mapping.lane?.code ?? 'Lane unavailable'}{mapping.lane?.name ? ' · ' + mapping.lane.name : ''}</p></div><button aria-label={'Remove destination ' + (mapping.postal_code ?? overview?.next_hubs?.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'unavailable hub')} className={iconButton} disabled={busy} onClick={() => void removeMapping(mapping.id, mapping.postal_code ?? overview?.next_hubs?.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'unavailable hub')} title="Remove mapping" type="button"><FaTrashCan aria-hidden="true" /></button></li>)}</ul> : <p className="px-3 py-5 text-center text-sm text-zinc-500">Map a destination to start automatic routing.</p>}
          </div>
        </section> : <section className={panel}><p className="p-5 text-sm text-zinc-500">Create or select a sort plan to configure destination routing.</p></section>}
      </div>

      <aside className="space-y-3">
        <section className={panel}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><div><h3 className="font-semibold">Hub lanes</h3><p className="text-xs text-zinc-500">Create physical lanes and print labels here.</p></div><button aria-label="Add sorting lane" className={iconButton} onClick={() => openLaneEditor()} title="Add lane" type="button"><FaPlus aria-hidden="true" /></button></div>
          {overview?.lanes.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{overview.lanes.map((lane) => <li className="flex items-center gap-1 px-1" key={lane.id}><div className="min-w-0 flex-1 px-2 py-2.5"><p className="flex items-center gap-2"><strong className="font-mono text-sm">{lane.code}</strong>{lane.type === 'exception' ? <span className="text-xs text-amber-700 dark:text-amber-300">Exception</span> : null}{!lane.is_active ? <span className="text-xs text-zinc-500">Inactive</span> : null}</p><p className="truncate text-xs text-zinc-500">{lane.name}</p></div><button aria-label={'Print ' + lane.code + ' label'} className={iconButton} onClick={() => void openLabel(lane)} title="Open printable label" type="button"><FaPrint aria-hidden="true" /></button><button aria-label={'Edit ' + lane.code} className={iconButton} onClick={() => openLaneEditor(lane)} title="Edit lane" type="button"><FaPen aria-hidden="true" /></button><button aria-label={(lane.is_active ? 'Deactivate ' : 'Activate ') + lane.code} className={iconButton} disabled={busy} onClick={() => void toggleLane(lane)} title={lane.is_active ? 'Deactivate lane' : 'Activate lane'} type="button"><FaPowerOff aria-hidden="true" /></button></li>)}</ul> : <p className="px-3 py-5 text-center text-sm text-zinc-500">Create a standard lane and an exception lane.</p>}
        </section>
        {!exceptionLanes.length ? <p className="text-xs text-amber-700 dark:text-amber-300">Create an active exception lane before scanning automatically.</p> : null}
      </aside>
    </div>

    <dialog aria-labelledby="plan-editor-title" className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto border border-zinc-200 bg-white p-4 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={planDialog}>
      <form onSubmit={(event) => void (creatingPlan ? createPlan(event) : savePlan(event))}>
        <div className="flex items-center justify-between"><h3 id="plan-editor-title" className="font-semibold">{creatingPlan ? 'Create sort plan' : 'Edit sort plan'}</h3><button aria-label="Close plan form" className={iconButton} type="button" onClick={() => planDialog.current?.close()}><FaXmark aria-hidden="true" /></button></div>
        {error ? <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
        <label className="mt-4 block text-sm font-medium">Plan name<input autoFocus className={field + ' mt-1'} maxLength={80} required value={creatingPlan ? newPlanName : planName} onChange={(event) => creatingPlan ? setNewPlanName(event.target.value) : setPlanName(event.target.value)} /></label>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={creatingPlan ? newPlanActive : planActive} onChange={(event) => creatingPlan ? setNewPlanActive(event.target.checked) : setPlanActive(event.target.checked)} />Use as the active plan</label>
        <p className="mt-2 text-xs text-zinc-500">Activating this plan replaces the current active plan. Mappings affect future scans.</p>
        <div className="mt-4 flex justify-end gap-2"><ActionButton type="button" disabled={busy} onClick={() => planDialog.current?.close()}>Cancel</ActionButton><PrimaryButton busy={busy} type="submit">{creatingPlan ? 'Create plan' : 'Save plan'}</PrimaryButton></div>
      </form>
    </dialog>
    <dialog aria-labelledby="sort-plan-help-title" className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={helpDialog}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h3 id="sort-plan-help-title" className="font-semibold">Sort plans and linehaul</h3><button aria-label="Close help" className={iconButton} onClick={() => helpDialog.current?.close()} type="button"><FaXmark aria-hidden="true" /></button></div>
      <ol className="list-decimal space-y-2 p-4 pl-8 text-sm"><li>Create standard lanes and one active exception lane. Print labels for the physical staging areas.</li><li>Map postal codes for local delivery. For transfers, map an allowed next hub to a standard lane.</li><li>Activate one plan. Automated sorting follows the parcel's committed next hop until it reaches the destination hub, then uses postal codes.</li><li>Missing routes, connections, or mappings hold parcels in the exception lane. Plan edits affect future scans, never rewrite a committed route.</li><li>Request and accept connections, then confirm physical departure and arrival from Linehaul. Final-mile dispatch becomes available at the destination hub.</li></ol>
    </dialog>
    <dialog className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={laneDialog}>
      <form onSubmit={(event) => void saveLane(event)}><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">{editingLane ? 'Edit lane' : 'Add lane'}</h3><button aria-label="Close lane form" className={iconButton} onClick={() => laneDialog.current?.close()} title="Close" type="button"><FaXmark aria-hidden="true" /></button></div><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="text-sm font-medium">Code<input autoFocus className={field + ' mt-1 uppercase'} maxLength={24} onChange={(event) => setLaneCode(event.target.value)} placeholder="NCR-01" required value={laneCode} /></label><label className="text-sm font-medium">Position<input className={field + ' mt-1'} min="1" max="999" onChange={(event) => setLanePosition(event.target.value)} required type="number" value={lanePosition} /></label><label className="text-sm font-medium sm:col-span-2">Name<input className={field + ' mt-1'} maxLength={80} onChange={(event) => setLaneName(event.target.value)} placeholder="NCR staging lane" required value={laneName} /></label><label className="text-sm font-medium sm:col-span-2">Type<select className={field + ' mt-1'} onChange={(event) => setLaneType(event.target.value as SortingLane['type'])} value={laneType}><option value="standard">Standard — maps destinations and marks sorted</option><option value="exception">Exception — holds unmatched parcels</option></select></label></div><div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10"><ActionButton onClick={() => laneDialog.current?.close()} type="button">Cancel</ActionButton><PrimaryButton busy={busy} type="submit">Save lane</PrimaryButton></div></form>
    </dialog>
  </div>
}
