import { useRef, useState } from 'react'
import { FaEllipsisVertical, FaPlus, FaRegCopy } from 'react-icons/fa6'
import type { SortingPlan } from '../../types/sorting'

function PlanMenu({ plan, disabled, onDuplicate }: { plan: SortingPlan; disabled: boolean; onDuplicate: (plan: SortingPlan) => void }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [open, setOpen] = useState(false)
  function show() {
    if (open) { popup.current?.hidePopover(); return }
    const rect = trigger.current!.getBoundingClientRect()
    setPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 60), left: Math.max(8, Math.min(rect.right - 184, window.innerWidth - 192)) })
    popup.current?.showPopover()
    window.requestAnimationFrame(() => popup.current?.querySelector('button')?.focus())
  }
  function dismiss() {
    popup.current?.hidePopover()
    trigger.current?.focus()
  }
  return <>
    <button ref={trigger} type="button" disabled={disabled} aria-label={`Options for ${plan.name}`} aria-haspopup="menu" aria-controls={`plan-menu-${plan.id}`} aria-expanded={open} className="grid size-9 shrink-0 place-items-center rounded-md text-zinc-600 hover:bg-zinc-200 focus-visible:outline-2 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-white/10" onClick={show}>
      <FaEllipsisVertical aria-hidden="true" />
    </button>
    <div ref={popup} id={`plan-menu-${plan.id}`} role="menu" aria-label={`${plan.name} actions`} popover="auto" onToggle={(event) => setOpen(event.newState === 'open')} style={position} className="fixed m-0 w-46 rounded-md border border-zinc-200 bg-white p-1 text-zinc-950 shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:border-white/20 dark:bg-zinc-900 dark:text-white" onKeyDown={(event) => {
      if (event.key === 'Escape' || event.key === 'Tab') { dismiss(); if (event.key === 'Escape') event.preventDefault() }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); popup.current?.querySelector('button')?.focus() }
    }}>

      <button type="button" role="menuitem" disabled={Boolean(plan.archived_at)} className="flex min-h-10 w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-zinc-100 focus:bg-zinc-100 focus-visible:outline-2 disabled:opacity-40 dark:hover:bg-white/10 dark:focus:bg-white/10" onClick={() => { dismiss(); onDuplicate(plan) }}>
        <FaRegCopy aria-hidden="true" />Duplicate plan
      </button>

    </div>
  </>
}

export function PlanList({ plans, selectedId, creating, blocked, onSelect, onCreate, onDuplicate }: {
  plans: SortingPlan[]
  selectedId: string
  creating: boolean
  blocked: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onDuplicate: (plan: SortingPlan) => void
}) {
  const [search, setSearch] = useState('')
  const visible = plans.filter((plan) => plan.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <>
    <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">

      <h4 className="font-semibold">
        Plan list
      </h4>

      <button type="button" aria-label="Create new plan" title="New plan" disabled={blocked} className="grid size-9 place-items-center rounded-md hover:bg-zinc-100 focus-visible:outline-2 disabled:opacity-40 dark:hover:bg-white/10" onClick={onCreate}>
        <FaPlus aria-hidden="true" />
      </button>

    </div>
    <div className="px-3 py-2">

      <label className="block text-sm">
        Search plans
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-2 outline-none focus-visible:ring-2 focus-visible:ring-[#4C1268] dark:border-white/20 dark:bg-zinc-900" />
      </label>

    </div>
    <div className="max-h-40 divide-y divide-zinc-200 overflow-y-auto dark:divide-white/10 lg:max-h-none lg:flex-1">
      {visible.map((plan) => <div key={plan.id} className={`flex items-center border-l-2 pr-2 ${!creating && plan.id === selectedId ? 'border-[#4C1268] bg-purple-50 dark:bg-purple-400/10' : 'border-transparent'}`}>

        <button type="button" aria-current={!creating && plan.id === selectedId ? 'true' : undefined} disabled={blocked} onClick={() => onSelect(plan.id)} className="min-w-0 flex-1 px-3 py-2 text-left text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] disabled:opacity-40 dark:hover:bg-white/5">

          <strong className="block break-words">
            {plan.name}
          </strong>

          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {plan.archived_at ? 'Archived' : plan.is_active ? 'Active' : 'Inactive'} · {plan.lanes.length} mappings
          </span>

        </button>

        <PlanMenu plan={plan} disabled={blocked} onDuplicate={onDuplicate} />

      </div>)}
      {!visible.length ? <p className="px-3 py-3 text-sm text-zinc-600 dark:text-zinc-400">
        {plans.length ? 'No matching plans.' : 'No plans yet.'}
      </p> : null}

    </div>
  </>
}
