import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowsRotate, FaLink, FaPen, FaPlus, FaPowerOff, FaPrint, FaRoute, FaTrashCan, FaWarehouse, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from '../components/PickupUi'
import { SupportedPostalCodes } from '../components/SupportedPostalCodes'
import { CompactPagination, COMPACT_PAGE_SIZE } from '../components/CompactPagination'
import { ApiError, blob as requestBlob, csrf, request, requestWithTimeout } from '../lib/api'
import type { SortingLane, SortingPlansOverview } from '../types/sorting'

const iconButton = 'grid size-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white'

export function SortPlanPage() {
  const [overview, setOverview] = useState<SortingPlansOverview | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [newPlanName, setNewPlanName] = useState('')
  const [planName, setPlanName] = useState('')
  const [planActive, setPlanActive] = useState(false)
  const [laneId, setLaneId] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [supportedCodes, setSupportedCodes] = useState<string[]>([])
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
  const [mappingPage, setMappingPage] = useState(1)
  const [lanePage, setLanePage] = useState(1)

  function openPlanEditor(create: boolean) {
    setError('')
    setCreatingPlan(create)
    if (create) setNewPlanName('')
    else if (selectedPlan) { setPlanName(selectedPlan.name); setPlanActive(selectedPlan.is_active) }
    planDialog.current?.showModal()
  }

  function selectPlan(id: string) {
    setCreatingPlan(false)
    setSelectedPlanId(id)
    setError('')
    setNotice('')
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
  const activePlan = overview?.plans.find((plan) => plan.id === overview.active_plan_id) ?? null
  const standardLanes = useMemo(() => overview?.lanes.filter((lane) => lane.type === 'standard' && lane.is_active) ?? [], [overview?.lanes])
  const exceptionLanes = useMemo(() => overview?.lanes.filter((lane) => lane.type === 'exception' && lane.is_active) ?? [], [overview?.lanes])
  const orderedLanes = useMemo(() => [...(overview?.lanes ?? [])].sort((a, b) => a.position - b.position || a.code.localeCompare(b.code)), [overview?.lanes])
  const orderedMappings = useMemo(() => [...(selectedPlan?.lanes ?? [])].sort((a, b) => (a.lane?.position ?? 999) - (b.lane?.position ?? 999) || a.position - b.position), [selectedPlan?.lanes])
  const activeMappings = useMemo(() => [...(activePlan?.lanes ?? [])].sort((a, b) => (a.lane?.position ?? 999) - (b.lane?.position ?? 999) || a.position - b.position), [activePlan?.lanes])
  const unmappedCodes = useMemo(() => supportedCodes.filter((code) => !selectedPlan?.lanes.some((mapping) => mapping.postal_code === code)).sort(), [supportedCodes, selectedPlan?.lanes])
  const currentMappingPage = Math.min(mappingPage, Math.max(1, Math.ceil(activeMappings.length / COMPACT_PAGE_SIZE)))
  const currentLanePage = Math.min(lanePage, Math.max(1, Math.ceil(orderedLanes.length / COMPACT_PAGE_SIZE)))

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
      const result = await request<{ data: { id: string } }>('/api/v1/logistics/sorting/plans', { method: 'POST', body: JSON.stringify({ name: newPlanName, is_active: false }) })
      setSelectedPlanId(result.data.id)
      setNewPlanName('')
      setNotice('Sort plan created.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The sort plan could not be created.')
    } finally { setBusy(false) }
  }

  async function savePlan(activate = false) {
    if (!selectedPlan) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/plans/' + selectedPlan.id, {
        method: 'PATCH',
        body: JSON.stringify({ expected_revision: selectedPlan.revision, name: planName, is_active: activate || planActive }),
      })
      setNotice(activate ? 'Sort plan activated.' : 'Sort plan updated.')
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
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-white/10">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><FaRoute className="text-[#4C1268] dark:text-purple-300" aria-hidden="true" />Sort plan</h2>
      <div className="flex items-center gap-1">
        <button aria-label="How sort plans work" title="Help" className={iconButton} onClick={() => helpDialog.current?.showModal()} type="button">?</button>
        <button aria-label="Refresh sort plan" className={iconButton} disabled={loading} onClick={() => void load()} title="Refresh" type="button"><FaArrowsRotate className={loading ? 'animate-spin' : ''} aria-hidden="true" /></button>
        <Link aria-label="Open Sorting" title="Sorting" className={iconButton} to="/sorting"><FaWarehouse aria-hidden="true" /></Link>
      </div>
    </header>
    {error && !planDialog.current?.open ? <div className="mt-2"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice && !planDialog.current?.open ? <p className="mt-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}
    <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-white/10">
          <div>
            <h3 className="font-semibold">Active plan</h3>
            <p className="text-xs text-zinc-500">{activePlan ? activePlan.name + ' · ' + activeMappings.length + ' destination mappings' : 'No plan is active for new scans'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => openPlanEditor(true)}><FaPlus aria-hidden="true" />New plan</ActionButton>
            <ActionButton onClick={() => { if (activePlan) selectPlan(activePlan.id); openPlanEditor(false) }}>{activePlan ? 'Edit active plan' : 'Manage plans'}</ActionButton>
          </div>
        </div>
        {activePlan ? <div className="overflow-x-auto">
          <table className="w-full min-w-[430px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs dark:border-white/10 dark:bg-white/[0.03]">
              <tr><th className="px-3 py-2">Lane no.</th><th className="px-3 py-2">Physical lane</th><th className="px-3 py-2">Destination</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
              {activeMappings.slice((currentMappingPage - 1) * COMPACT_PAGE_SIZE, currentMappingPage * COMPACT_PAGE_SIZE).map((mapping) => <tr key={mapping.id}>
                <td className="px-3 py-2 font-mono">{mapping.lane?.position ?? '—'}</td>
                <td className="px-3 py-2">{mapping.lane?.code ?? 'Lane unavailable'}</td>
                <td className="px-3 py-2">{mapping.destination_type === 'hub' ? (overview?.next_hubs?.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'Unavailable hub') : mapping.postal_code}<span className="ml-2 text-xs text-zinc-500">{mapping.destination_type === 'hub' ? 'Next hub' : 'Postal'}</span></td>
              </tr>)}
              {!activeMappings.length ? <tr><td colSpan={3} className="px-3 py-4 text-zinc-500">No destinations mapped. Edit the active plan to add one.</td></tr> : null}
            </tbody>
          </table>
        </div> : <p className="px-3 py-4 text-sm text-zinc-500">Open Manage plans to activate an existing plan, or create a new one.</p>}
        <CompactPagination label="Active plan lanes" page={currentMappingPage} total={activeMappings.length} onPageChange={setMappingPage} />
      </section>
      <div className="space-y-3">
        <section className={panel}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
            <h3 className="font-semibold">Physical lanes</h3>
            <button aria-label="Add sorting lane" className={iconButton} onClick={() => openLaneEditor()} title="Add lane" type="button"><FaPlus aria-hidden="true" /></button>
          </div>
          {orderedLanes.length ? <div className="divide-y divide-zinc-200 dark:divide-white/10">{orderedLanes.slice((currentLanePage - 1) * COMPACT_PAGE_SIZE, currentLanePage * COMPACT_PAGE_SIZE).map((lane) => <div className="flex items-center gap-1 px-2 py-1 text-sm" key={lane.id}>
            <span className="w-8 shrink-0 text-right font-mono text-zinc-500">{lane.position}</span>
            <div className="min-w-0 flex-1 pl-2"><strong className="font-mono">{lane.code}</strong><span className="ml-2 text-xs text-zinc-500">{lane.name} · {lane.type}{lane.is_active ? '' : ' · Inactive'}</span></div>
            <button aria-label={'Print ' + lane.code + ' label'} className={iconButton} onClick={() => void openLabel(lane)} title="Print label" type="button"><FaPrint aria-hidden="true" /></button>
            <button aria-label={'Edit ' + lane.code} className={iconButton} onClick={() => openLaneEditor(lane)} title="Edit lane" type="button"><FaPen aria-hidden="true" /></button>
            <button aria-label={(lane.is_active ? 'Deactivate ' : 'Activate ') + lane.code} className={iconButton} disabled={busy} onClick={() => void toggleLane(lane)} title={lane.is_active ? 'Deactivate lane' : 'Activate lane'} type="button"><FaPowerOff aria-hidden="true" /></button>
          </div>)}</div> : <p className="px-3 py-4 text-sm text-zinc-500">Create a standard lane and an exception lane.</p>}
          <CompactPagination label="Physical lanes" page={currentLanePage} total={orderedLanes.length} onPageChange={setLanePage} />
        </section>
        {!exceptionLanes.length ? <p className="text-xs text-amber-700 dark:text-amber-300">Create an active exception lane before automatic sorting.</p> : null}
        <SupportedPostalCodes onChange={setSupportedCodes} />
      </div>
    </div>

    <dialog aria-labelledby="plan-workspace-title" className="m-auto max-h-[96dvh] w-[min(98vw,1400px)] max-w-none overflow-hidden border border-zinc-200 bg-white p-0 text-zinc-950 shadow-lg backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={planDialog}>
      <div className="flex max-h-[96dvh] flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
          <h3 id="plan-workspace-title" className="font-semibold">Sort plan workspace</h3>
          <button aria-label="Close sort plan workspace" className={iconButton} type="button" onClick={() => planDialog.current?.close()}><FaXmark aria-hidden="true" /></button>
        </div>
        {error ? <p role="alert" className="mx-3 mt-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{error}</p> : null}
        {notice ? <p role="status" className="mx-3 mt-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_18rem] lg:overflow-hidden">
          <div className="min-w-0 space-y-3 p-3 lg:overflow-y-auto">
            {creatingPlan ? <form id="create-plan-form" onSubmit={(event) => void createPlan(event)}>
              <h4 className="mb-2 font-semibold">New plan</h4>
              <label className="block text-sm font-medium">Plan name<input autoFocus className={field + ' mt-1'} maxLength={80} required value={newPlanName} onChange={(event) => setNewPlanName(event.target.value)} /></label>
              <p className="mt-2 text-xs text-zinc-500">Create the plan first, then add destination mappings. It will stay inactive until you activate it from the plan list.</p>
            </form> : selectedPlan ? <>
              <form id="edit-plan-form" onSubmit={(event) => { event.preventDefault(); void savePlan() }}>
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Plan information</h4><span className="text-xs text-zinc-500">Revision {selectedPlan.revision} · {selectedPlan.is_active ? 'Active' : 'Inactive'}</span></div>
                <label className="mt-2 block text-sm font-medium">Plan name<input className={field + ' mt-1'} maxLength={80} required value={planName} onChange={(event) => setPlanName(event.target.value)} /></label>
              </form>
              <section className="border border-zinc-200 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h4 className="font-semibold">Destination lanes</h4><span className="text-xs text-zinc-500">Ordered by lane no.</span></div>
                <form className="grid gap-2 border-b border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-white/[0.03] sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_5rem_auto] sm:items-end" onSubmit={(event) => void addMapping(event)}>
                  <label className="min-w-0 text-xs font-medium">Standard lane<select className={field + ' mt-1'} onChange={(event) => setLaneId(event.target.value)} required value={laneId}><option value="">Choose lane</option>{standardLanes.map((lane) => <option key={lane.id} value={lane.id}>{lane.position} · {lane.code} · {lane.name}</option>)}</select></label>
                  <label className="text-xs font-medium">Destination<select className={field + ' mt-1'} value={destinationType} onChange={(event) => setDestinationType(event.target.value as 'postal_code' | 'hub')}><option value="postal_code">Postal code</option><option value="hub">Next hub</option></select></label>
                  {destinationType === 'hub' ? <label className="min-w-0 text-xs font-medium">Next hub<select className={field + ' mt-1'} required value={destinationHubId} onChange={(event) => setDestinationHubId(event.target.value)}><option value="">Choose connected hub</option>{overview?.next_hubs?.map((hub) => <option key={hub.id} value={hub.id}>{hub.name}</option>)}</select></label> : <label className="text-xs font-medium">Postal code<select className={field + ' mt-1 font-mono'} onChange={(event) => setPostalCode(event.target.value)} required value={postalCode}><option value="">Choose supported code</option>{unmappedCodes.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>}
                  <label className="text-xs font-medium">Order<input className={field + ' mt-1'} min="1" max="999" onChange={(event) => setMappingPosition(event.target.value)} required type="number" value={mappingPosition} /></label>
                  <PrimaryButton busy={busy} disabled={!standardLanes.length || (destinationType === 'hub' ? !overview?.next_hubs?.length : !unmappedCodes.length)} type="submit"><FaLink aria-hidden="true" />Map</PrimaryButton>
                </form>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[430px] text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs dark:border-white/10 dark:bg-white/[0.03]"><tr><th className="px-2 py-2">Lane no.</th><th className="px-2 py-2">Physical lane</th><th className="px-2 py-2">Destination</th><th className="px-2 py-2 text-right">Action</th></tr></thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-white/10">{orderedMappings.map((mapping) => { const destination = mapping.destination_type === 'hub' ? (overview?.next_hubs?.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'Unavailable hub') : mapping.postal_code ?? 'Unavailable postal code'; return <tr key={mapping.id}><td className="px-2 py-2 font-mono">{mapping.lane?.position ?? '—'}</td><td className="px-2 py-2">{mapping.lane?.code ?? 'Lane unavailable'}</td><td className="px-2 py-2">{destination}<span className="ml-2 text-xs text-zinc-500">{mapping.destination_type === 'hub' ? 'Next hub' : 'Postal'}</span></td><td className="px-2 py-1 text-right"><button aria-label={'Remove ' + destination + ' mapping'} className={iconButton + ' ml-auto'} disabled={busy} onClick={() => void removeMapping(mapping.id, destination)} title="Remove mapping" type="button"><FaTrashCan aria-hidden="true" /></button></td></tr> })}
                      {!orderedMappings.length ? <tr><td colSpan={4} className="px-3 py-4 text-center text-zinc-500">No destinations mapped.</td></tr> : null}</tbody></table>
                </div>
              </section>
            </> : <p className="text-sm text-zinc-500">Choose a plan from the list.</p>}
          </div>
          <aside className="order-first border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03] lg:order-last lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-l">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h4 className="font-semibold">Plan list</h4><button aria-label="Create new plan" title="New plan" className={iconButton} onClick={() => { setCreatingPlan(true); setNewPlanName(''); setError('') }} type="button"><FaPlus aria-hidden="true" /></button></div>
            <div className="max-h-40 divide-y divide-zinc-200 overflow-y-auto dark:divide-white/10 lg:max-h-none lg:flex-1">{overview?.plans.map((plan) => <button aria-current={!creatingPlan && plan.id === selectedPlanId ? 'true' : undefined} className={'block w-full border-l-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-white/[0.06] ' + (!creatingPlan && plan.id === selectedPlanId ? 'border-[#4C1268] bg-purple-50 dark:bg-purple-400/10' : 'border-transparent')} key={plan.id} onClick={() => selectPlan(plan.id)} type="button"><strong className="block truncate">{plan.name}</strong><span className="text-xs text-zinc-500">{plan.is_active ? 'Active' : 'Inactive'} · {plan.lanes.length} mappings</span></button>)}{!overview?.plans.length ? <p className="px-3 py-3 text-xs text-zinc-500">No plans yet.</p> : null}</div>
            <div className="hidden grid-cols-2 gap-2 border-t border-zinc-200 p-3 dark:border-white/10 lg:grid">
              {creatingPlan ? <PrimaryButton className="col-span-2 w-full" busy={busy} form="create-plan-form" type="submit">Create plan</PrimaryButton> : selectedPlan ? <>
                <PrimaryButton className={selectedPlan.is_active ? 'col-span-2 w-full' : 'w-full'} busy={busy} form="edit-plan-form" type="submit">Save plan</PrimaryButton>
                {!selectedPlan.is_active ? <ActionButton className="w-full" disabled={busy} onClick={() => void savePlan(true)}>Activate plan</ActionButton> : null}
                <ActionButton className="col-span-2 w-full" disabled={busy} onClick={() => void deletePlan()}><FaTrashCan aria-hidden="true" />Delete plan</ActionButton>
              </> : null}
            </div>
          </aside>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#18181b] lg:hidden">
          {creatingPlan ? <PrimaryButton className="col-span-2 w-full" busy={busy} form="create-plan-form" type="submit">Create plan</PrimaryButton> : selectedPlan ? <>
            <PrimaryButton className={selectedPlan.is_active ? 'col-span-2 w-full' : 'w-full'} busy={busy} form="edit-plan-form" type="submit">Save plan</PrimaryButton>
            {!selectedPlan.is_active ? <ActionButton className="w-full" disabled={busy} onClick={() => void savePlan(true)}>Activate plan</ActionButton> : null}
            <ActionButton className="col-span-2 w-full" disabled={busy} onClick={() => void deletePlan()}><FaTrashCan aria-hidden="true" />Delete plan</ActionButton>
          </> : null}
        </div>
      </div>
    </dialog>
    <dialog aria-labelledby="sort-plan-help-title" className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={helpDialog}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h3 id="sort-plan-help-title" className="font-semibold">How sort plans work</h3><button aria-label="Close help" className={iconButton} onClick={() => helpDialog.current?.close()} type="button"><FaXmark aria-hidden="true" /></button></div>
      <ol className="list-decimal space-y-2 p-4 pl-8 text-sm"><li>Manage physical lanes and supported postal codes on this page. Multiple hubs may support the same postal code.</li><li>The main table shows the active plan's lanes in lane-number order. Open the workspace to create, edit, or select another plan.</li><li>Map supported local postal codes or connected next hubs to standard lanes, then save or activate the selected plan.</li><li>For a destination served by several hubs, routing prefers local coverage, then the lowest-cost reachable route by road travel plus handling time.</li><li>Unmatched scans go to the exception lane. Plan changes affect future scans only.</li><li>Manage partner connections in Linehaul. Confirm physical handoffs in Sorting.</li></ol>
    </dialog>
    <dialog className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={laneDialog}>
      <form onSubmit={(event) => void saveLane(event)}><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">{editingLane ? 'Edit lane' : 'Add lane'}</h3><button aria-label="Close lane form" className={iconButton} onClick={() => laneDialog.current?.close()} title="Close" type="button"><FaXmark aria-hidden="true" /></button></div><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="text-sm font-medium">Code<input autoFocus className={field + ' mt-1 uppercase'} maxLength={24} onChange={(event) => setLaneCode(event.target.value)} placeholder="NCR-01" required value={laneCode} /></label><label className="text-sm font-medium">Position<input className={field + ' mt-1'} min="1" max="999" onChange={(event) => setLanePosition(event.target.value)} required type="number" value={lanePosition} /></label><label className="text-sm font-medium sm:col-span-2">Name<input className={field + ' mt-1'} maxLength={80} onChange={(event) => setLaneName(event.target.value)} placeholder="NCR staging lane" required value={laneName} /></label><label className="text-sm font-medium sm:col-span-2">Type<select className={field + ' mt-1'} onChange={(event) => setLaneType(event.target.value as SortingLane['type'])} value={laneType}><option value="standard">Standard — maps destinations and marks sorted</option><option value="exception">Exception — holds unmatched parcels</option></select></label></div><div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10"><ActionButton onClick={() => laneDialog.current?.close()} type="button">Cancel</ActionButton><PrimaryButton busy={busy} type="submit">Save lane</PrimaryButton></div></form>
    </dialog>
  </div>
}
