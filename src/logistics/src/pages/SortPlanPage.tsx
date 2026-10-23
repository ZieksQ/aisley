import { ActivePlanMappings } from '../components/sorting/ActivePlanMappings'
import '../features/hubOperations/workspaces.css'
import { PortalButton, PortalSkeleton } from '@aisley/ui/portal'
import { FaArrowsRotate, FaPen, FaPlus, FaPowerOff, FaPrint, FaWarehouse, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ErrorNotice } from '../components/PickupUi'
import { PlanWorkspace } from '../components/sorting/PlanWorkspace'
import { TimedNotice } from '../components/sorting/TimedNotice'
import { useSortPlanEditor } from '../components/sorting/useSortPlanEditor'
import { SupportedPostalCodes } from '../components/SupportedPostalCodes'
import { CompactPagination, COMPACT_PAGE_SIZE } from '../components/CompactPagination'
import type { SortingLane } from '../types/sorting'

const iconButton = 'grid size-11 shrink-0 place-items-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white'

export function SortPlanPage() {
  const editor = useSortPlanEditor()
  const {
    workspaceOpen,
    overview,
    setSupportedCodes,
    helpDialog,
    editingLane,
    laneCode,
    setLaneCode,
    laneName,
    setLaneName,
    laneType,
    setLaneType,
    lanePosition,
    setLanePosition,
    loading,
    busy,
    error,
    notice,
    setNotice,
    laneDialog,
    setMappingPage,
    setLanePage,
    activePlan,
    exceptionLanes,
    orderedLanes,
    activeMappings,
    currentMappingPage,
    currentLanePage,
    load,
    openPlanEditor,
    selectPlan,
    openLaneEditor,
    saveLane,
    toggleLane,
    openLabel,
  } = editor
  return <div className="portal-page hub-workspace">
    <header className="hub-page-header">
      <div><h2 className="portal-page-heading">Sort plan</h2><p className="portal-secondary mt-2 text-sm">Map destinations to physical lanes and control routing for future scans.</p></div>
      <div className="flex items-center gap-1">
        <button aria-label="How sort plans work" title="Help" className={iconButton} onClick={() => helpDialog.current?.showModal()} type="button">
          ?
        </button>
        <button aria-label="Refresh sort plan" className={iconButton} disabled={loading} onClick={() => void load()} title="Refresh" type="button">
          <FaArrowsRotate className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
        <Link aria-label="Open Sorting" title="Sorting" className={iconButton} to="/sorting">
          <FaWarehouse aria-hidden="true" />
        </Link>
      </div>
    </header>
    {error && !workspaceOpen ? <div className="mt-2">
      <ErrorNotice message={error} retry={() => void load()} />
    </div> : null}
    {notice && !workspaceOpen ? <div className="mt-2">
      <TimedNotice message={notice} onChange={setNotice} />
    </div> : null}
    {loading && !overview ? <PortalSkeleton label="Loading sort plan" /> : overview ? <>
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
      <section className={`portal-section min-w-0`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h3 className="font-semibold">
              Active plan
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {activePlan ? activePlan.name + ' · ' + activeMappings.length + ' destination mappings' : 'No plan is active for new scans'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PortalButton onClick={() => openPlanEditor(true)}>
              <FaPlus aria-hidden="true" />New plan
            </PortalButton>
            <PortalButton variant="primary" onClick={() => { if (activePlan) selectPlan(activePlan.id); openPlanEditor(false) }}>
              {activePlan ? 'Edit active plan' : 'Manage plans'}
            </PortalButton>
          </div>
        </div>
        {activePlan ? <ActivePlanMappings mappings={activeMappings.slice((currentMappingPage - 1) * COMPACT_PAGE_SIZE, currentMappingPage * COMPACT_PAGE_SIZE)} hubs={overview?.next_hubs ?? []} /> : <p className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400">
          Open Manage plans to activate an existing plan, or create a new one.
        </p>}
        <CompactPagination label="Active plan lanes" page={currentMappingPage} total={activeMappings.length} onPageChange={setMappingPage} />
      </section>
      <div className="min-w-0 space-y-5">
        <section className="portal-section">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h3 className="font-semibold">
              Physical lanes
            </h3>
            <button aria-label="Add sorting lane" className={iconButton} onClick={() => openLaneEditor()} title="Add lane" type="button">
              <FaPlus aria-hidden="true" />
            </button>
          </div>
          {orderedLanes.length ? <div className="divide-y divide-slate-200 dark:divide-white/10">
            {orderedLanes.slice((currentLanePage - 1) * COMPACT_PAGE_SIZE, currentLanePage * COMPACT_PAGE_SIZE).map((lane) => <div className="hub-lane-row" key={lane.id}>
              <span className="w-8 shrink-0 text-right font-mono text-slate-600 dark:text-slate-400">
                {lane.position}
              </span>
              <div className="min-w-0 flex-1 basis-36 pl-2">
                <strong className="font-mono">
                  {lane.code}
                </strong>
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                  {lane.name} · {lane.type}{lane.is_active ? '' : ' · Inactive'}
                </span>
              </div>
              <button aria-label={'Print ' + lane.code + ' label'} className={iconButton} onClick={() => void openLabel(lane)} title="Print label" type="button">
                <FaPrint aria-hidden="true" />
              </button>
              <button aria-label={'Edit ' + lane.code} className={iconButton} onClick={() => openLaneEditor(lane)} title="Edit lane" type="button">
                <FaPen aria-hidden="true" />
              </button>
              <button aria-label={(lane.is_active ? 'Deactivate ' : 'Activate ') + lane.code} className={iconButton} disabled={busy} onClick={() => void toggleLane(lane)} title={lane.is_active ? 'Deactivate lane' : 'Activate lane'} type="button">
                <FaPowerOff aria-hidden="true" />
              </button>
            </div>)}
          </div> : <p className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400">
            Create a standard lane and an exception lane.
          </p>}
          <CompactPagination label="Physical lanes" page={currentLanePage} total={orderedLanes.length} onPageChange={setLanePage} />
        </section>
        {!exceptionLanes.length ? <p className="text-xs text-amber-700 dark:text-amber-300">
          Create an active exception lane before automatic sorting.
        </p> : null}
        <SupportedPostalCodes onChange={setSupportedCodes} />
      </div>
    </div>
    </> : null}
    <PlanWorkspace editor={editor} />
    <dialog aria-labelledby="sort-plan-help-title" className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-950 backdrop:bg-black/55 dark:border-slate-600 dark:bg-slate-800 dark:text-white" ref={helpDialog}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 id="sort-plan-help-title" className="font-semibold">
          How sort plans work
        </h3>
        <button aria-label="Close help" className={iconButton} onClick={() => helpDialog.current?.close()} type="button">
          <FaXmark aria-hidden="true" />
        </button>
      </div>
      <ol className="list-decimal space-y-2 p-4 pl-8 text-sm">
        <li>
          Manage physical lanes and supported postal codes on this page. Multiple hubs may support the same postal code.
        </li>
        <li>
          The main table shows the active plan's lanes in lane-number order. Open the workspace to create, edit, or select another plan.
        </li>
        <li>
          Map supported local postal codes or connected next hubs to standard lanes, then publish an immutable version and activate it now or schedule one activation in Asia/Manila.
        </li>
        <li>
          For a destination served by several hubs, routing prefers local coverage, then the lowest-cost reachable route by road travel plus handling time.
        </li>
        <li>
          Unmatched scans go to the exception lane. Plan changes affect future scans only.
        </li>
        <li>
          Manage partner connections in Linehaul. Confirm physical handoffs in Sorting.
        </li>
      </ol>
    </dialog>
    <dialog className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] border border-slate-200 bg-white p-0 text-slate-950 backdrop:bg-black/55 dark:border-slate-600 dark:bg-slate-800 dark:text-white" ref={laneDialog}>
      <form onSubmit={(event) => void saveLane(event)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3 className="font-semibold">
            {editingLane ? 'Edit lane' : 'Add lane'}
          </h3>
          <button aria-label="Close lane form" className={iconButton} onClick={() => laneDialog.current?.close()} title="Close" type="button">
            <FaXmark aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Code
            <input autoFocus className={'portal-input  mt-1 uppercase'} maxLength={24} onChange={(event) => setLaneCode(event.target.value)} placeholder="NCR-01" required value={laneCode} />
          </label>
          <label className="text-sm font-medium">
            Position
            <input className={'portal-input  mt-1'} min="1" max="999" onChange={(event) => setLanePosition(event.target.value)} required type="number" value={lanePosition} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Name
            <input className={'portal-input  mt-1'} maxLength={80} onChange={(event) => setLaneName(event.target.value)} placeholder="NCR staging lane" required value={laneName} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Type
            <select className={'portal-input  mt-1'} onChange={(event) => setLaneType(event.target.value as SortingLane['type'])} value={laneType}>
              <option value="standard">
                Standard — maps destinations and marks sorted
              </option>
              <option value="exception">
                Exception — holds unmatched parcels
              </option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <PortalButton onClick={() => laneDialog.current?.close()} type="button">
            Cancel
          </PortalButton>
          <PortalButton variant="primary" isLoading={busy} type="submit">
            Save lane
          </PortalButton>
        </div>
      </form>
    </dialog>
  </div>
}
