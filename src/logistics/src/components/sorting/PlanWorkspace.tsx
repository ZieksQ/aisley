import { FaTrashCan, FaXmark } from 'react-icons/fa6'
import { ActionButton, PrimaryButton, field } from '../PickupUi'
import { PlanVersionControls } from './PlanVersionControls'
import { PlanList } from './PlanList'
import { PlanDuplicateDialog } from './PlanDuplicateDialog'
import { TimedNotice } from './TimedNotice'
import { DestinationMappingEditor } from './DestinationMappingEditor'
import type { SortPlanEditor } from './useSortPlanEditor'
const iconButton = 'grid size-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white'

export function PlanWorkspace({ editor }: { editor: SortPlanEditor }) {
  const {
    setWorkspaceOpen,
    overview,
    selectedPlanId,
    setSelectedPlanId,
    newPlanName,
    setNewPlanName,
    planName,
    setPlanName,
    busy,
    setVersionBlocked,
    setCopyBlocked,
    duplicatePlan,
    setDuplicatePlan,
    workBlocked,
    error,
    setError,
    notice,
    setNotice,
    planDialog,
    creatingPlan,
    setCreatingPlan,
    selectedPlan,
    load,
    selectPlan,
    deletePlan,
    createPlan,
    savePlan,
  } = editor
  async function copied(id: string, message: string) {
    setCreatingPlan(false)
    setSelectedPlanId(id)
    setNotice(message)
    await load()
    window.requestAnimationFrame(() => planDialog.current?.querySelector<HTMLInputElement>('#edit-plan-form input')?.focus())
  }

  return (
    <dialog aria-labelledby="plan-workspace-title" className="m-auto max-h-[96dvh] w-[min(98vw,1400px)] max-w-none overflow-hidden border border-zinc-200 bg-white p-0 text-zinc-950 shadow-none backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={planDialog} onClose={() => setWorkspaceOpen(false)} onCancel={(event) => { if (busy || workBlocked) event.preventDefault() }}>
      <div className="flex max-h-[96dvh] flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
          <h3 id="plan-workspace-title" className="font-semibold">
            Sort plan workspace
          </h3>
          <button aria-label="Close sort plan workspace" className={iconButton} type="button" disabled={busy || workBlocked} onClick={() => planDialog.current?.close()}>
            <FaXmark aria-hidden="true" />
          </button>
        </div>
        {error ? <p role="alert" className="mx-3 mt-2 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">
          {error}
        </p> : null}
        {notice ? <div className="mx-3 mt-2">
          <TimedNotice message={notice} onChange={setNotice} />
        </div> : null}
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_18rem] lg:overflow-hidden">
          <div className="min-w-0 space-y-3 p-3 lg:overflow-y-auto">
            {creatingPlan ? <form id="create-plan-form" onSubmit={(event) => void createPlan(event)}>
              <h4 className="mb-2 font-semibold">
                New plan
              </h4>
              <label className="block text-sm font-medium">
                Plan name
                <input autoFocus className={field + ' mt-1'} maxLength={80} required value={newPlanName} onChange={(event) => setNewPlanName(event.target.value)} />
              </label>
              <p className="mt-2 text-xs text-zinc-500">
                Create the plan first, then add destination mappings. Publish an immutable version when the mappings are ready.
              </p>
            </form> : selectedPlan ? <>
              <form id="edit-plan-form" onSubmit={(event) => { event.preventDefault(); void savePlan() }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold">
                    Plan information
                  </h4>
                  <span className="text-xs text-zinc-500">
                    Revision {selectedPlan.revision} · {selectedPlan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <label className="mt-2 block text-sm font-medium">
                  Plan name
                  <input className={field + ' mt-1'} maxLength={80} required value={planName} onChange={(event) => setPlanName(event.target.value)} />
                </label>
              </form>
              <DestinationMappingEditor editor={editor} />
              <PlanVersionControls key={selectedPlan.id} plan={selectedPlan} lanes={overview?.lanes ?? []} hubs={overview?.next_hubs ?? []} onBlocked={setVersionBlocked} onChanged={async (id) => { if (id) setSelectedPlanId(id); await load() }} />
            </> : <p className="text-sm text-zinc-500">
              Choose a plan from the list.
            </p>}
          </div>
          <aside className="order-first border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03] lg:order-last lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-l">
            <PlanList plans={overview?.plans ?? []} selectedId={selectedPlanId} creating={creatingPlan} blocked={busy || workBlocked} onSelect={selectPlan} onCreate={() => { setCreatingPlan(true); setNewPlanName(''); setError('') }} onDuplicate={setDuplicatePlan} />
            <div className="hidden grid-cols-2 gap-2 border-t border-zinc-200 p-3 dark:border-white/10 lg:grid">
              {creatingPlan ? <PrimaryButton className="col-span-2 w-full" busy={busy} form="create-plan-form" type="submit">
                Create plan
              </PrimaryButton> : selectedPlan ? <>
                <PrimaryButton className={selectedPlan.is_active ? 'col-span-2 w-full' : 'w-full'} busy={busy} disabled={workBlocked || Boolean(selectedPlan.archived_at)} form="edit-plan-form" type="submit">
                  Save plan
                </PrimaryButton>
                {!selectedPlan.is_active ? <ActionButton className="w-full" disabled={busy || workBlocked || Boolean(selectedPlan.archived_at)} onClick={() => void savePlan()}>
                  Save draft
                </ActionButton> : null}
                <ActionButton className="col-span-2 w-full" disabled={busy || workBlocked || selectedPlan.versions.length > 0 || selectedPlan.is_active} onClick={() => void deletePlan()}>
                  <FaTrashCan aria-hidden="true" />Delete unpublished draft
                </ActionButton>
              </> : null}
            </div>
          </aside>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#18181b] lg:hidden">
          {creatingPlan ? <PrimaryButton className="col-span-2 w-full" busy={busy} form="create-plan-form" type="submit">
            Create plan
          </PrimaryButton> : selectedPlan ? <>
            <PrimaryButton className={selectedPlan.is_active ? 'col-span-2 w-full' : 'w-full'} busy={busy} disabled={workBlocked || Boolean(selectedPlan.archived_at)} form="edit-plan-form" type="submit">
              Save plan
            </PrimaryButton>
            {!selectedPlan.is_active ? <ActionButton className="w-full" disabled={busy || workBlocked || Boolean(selectedPlan.archived_at)} onClick={() => void savePlan()}>
              Save draft
            </ActionButton> : null}
            <ActionButton className="col-span-2 w-full" disabled={busy || workBlocked || selectedPlan.versions.length > 0 || selectedPlan.is_active} onClick={() => void deletePlan()}>
              <FaTrashCan aria-hidden="true" />Delete unpublished draft
            </ActionButton>
          </> : null}
        </div>
      </div>
      <PlanDuplicateDialog plan={duplicatePlan} onClose={() => setDuplicatePlan(null)} onBlocked={setCopyBlocked} onCopied={copied} />
    </dialog>
  )
}
