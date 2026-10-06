import { FaArrowsRotate, FaPen, FaPlus, FaPowerOff, FaPrint, FaRoute, FaWarehouse, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from '../components/PickupUi'
import { PlanWorkspace } from '../components/sorting/PlanWorkspace'
import { TimedNotice } from '../components/sorting/TimedNotice'
import { useSortPlanEditor } from '../components/sorting/useSortPlanEditor'
import { SupportedPostalCodes } from '../components/SupportedPostalCodes'
import { CompactPagination, COMPACT_PAGE_SIZE } from '../components/CompactPagination'
import type { SortingLane } from '../types/sorting'

const iconButton = 'grid size-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white'

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
  return <div className="mx-auto max-w-[1500px] px-3 py-3">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-white/10">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <FaRoute className="text-[#4C1268] dark:text-purple-300" aria-hidden="true" />Sort plan
      </h2>
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
    <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <section className={`${panel} min-w-0`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-white/10">
          <div>
            <h3 className="font-semibold">
              Active plan
            </h3>
            <p className="text-xs text-zinc-500">
              {activePlan ? activePlan.name + ' · ' + activeMappings.length + ' destination mappings' : 'No plan is active for new scans'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => openPlanEditor(true)}>
              <FaPlus aria-hidden="true" />New plan
            </ActionButton>
            <ActionButton onClick={() => { if (activePlan) selectPlan(activePlan.id); openPlanEditor(false) }}>
              {activePlan ? 'Edit active plan' : 'Manage plans'}
            </ActionButton>
          </div>
        </div>
        {activePlan ? <div className="overflow-x-auto">
          <table className="w-full min-w-[430px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs dark:border-white/10 dark:bg-white/[0.03]">
              <tr>
                <th className="px-3 py-2">
                  Lane no.
                </th>
                <th className="px-3 py-2">
                  Physical lane
                </th>
                <th className="px-3 py-2">
                  Destination
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
              {activeMappings.slice((currentMappingPage - 1) * COMPACT_PAGE_SIZE, currentMappingPage * COMPACT_PAGE_SIZE).map((mapping) => <tr key={mapping.id}>
                <td className="px-3 py-2 font-mono">
                  {mapping.lane?.position ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {mapping.lane?.code ?? 'Lane unavailable'}
                </td>
                <td className="px-3 py-2">
                  {mapping.destination_type === 'hub' ? (overview?.next_hubs?.find((hub) => hub.id === mapping.destination_hub_id)?.name ?? 'Unavailable hub') : mapping.postal_code}
                  <span className="ml-2 text-xs text-zinc-500">
                    {mapping.destination_type === 'hub' ? 'Next hub' : 'Postal'}
                  </span>
                </td>
              </tr>)}
              {!activeMappings.length ? <tr>
                <td colSpan={3} className="px-3 py-4 text-zinc-500">
                  No destinations mapped. Edit the active plan to add one.
                </td>
              </tr> : null}
            </tbody>
          </table>
        </div> : <p className="px-3 py-4 text-sm text-zinc-500">
          Open Manage plans to activate an existing plan, or create a new one.
        </p>}
        <CompactPagination label="Active plan lanes" page={currentMappingPage} total={activeMappings.length} onPageChange={setMappingPage} />
      </section>
      <div className="min-w-0 space-y-3">
        <section className={panel}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
            <h3 className="font-semibold">
              Physical lanes
            </h3>
            <button aria-label="Add sorting lane" className={iconButton} onClick={() => openLaneEditor()} title="Add lane" type="button">
              <FaPlus aria-hidden="true" />
            </button>
          </div>
          {orderedLanes.length ? <div className="divide-y divide-zinc-200 dark:divide-white/10">
            {orderedLanes.slice((currentLanePage - 1) * COMPACT_PAGE_SIZE, currentLanePage * COMPACT_PAGE_SIZE).map((lane) => <div className="flex flex-wrap items-center gap-1 px-2 py-1 text-sm" key={lane.id}>
              <span className="w-8 shrink-0 text-right font-mono text-zinc-500">
                {lane.position}
              </span>
              <div className="min-w-0 flex-1 basis-36 pl-2">
                <strong className="font-mono">
                  {lane.code}
                </strong>
                <span className="ml-2 text-xs text-zinc-500">
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
          </div> : <p className="px-3 py-4 text-sm text-zinc-500">
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
    <PlanWorkspace editor={editor} />
    <dialog aria-labelledby="sort-plan-help-title" className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] overflow-y-auto border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={helpDialog}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
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
    <dialog className="m-auto max-h-[90dvh] w-[min(92vw,30rem)] border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={laneDialog}>
      <form onSubmit={(event) => void saveLane(event)}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
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
            <input autoFocus className={field + ' mt-1 uppercase'} maxLength={24} onChange={(event) => setLaneCode(event.target.value)} placeholder="NCR-01" required value={laneCode} />
          </label>
          <label className="text-sm font-medium">
            Position
            <input className={field + ' mt-1'} min="1" max="999" onChange={(event) => setLanePosition(event.target.value)} required type="number" value={lanePosition} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Name
            <input className={field + ' mt-1'} maxLength={80} onChange={(event) => setLaneName(event.target.value)} placeholder="NCR staging lane" required value={laneName} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Type
            <select className={field + ' mt-1'} onChange={(event) => setLaneType(event.target.value as SortingLane['type'])} value={laneType}>
              <option value="standard">
                Standard — maps destinations and marks sorted
              </option>
              <option value="exception">
                Exception — holds unmatched parcels
              </option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10">
          <ActionButton onClick={() => laneDialog.current?.close()} type="button">
            Cancel
          </ActionButton>
          <PrimaryButton busy={busy} type="submit">
            Save lane
          </PrimaryButton>
        </div>
      </form>
    </dialog>
  </div>
}
