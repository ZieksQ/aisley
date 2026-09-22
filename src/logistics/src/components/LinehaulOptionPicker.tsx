import { useEffect, useMemo, useRef, useState } from 'react'
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6'
import { field } from './PickupUi'

export type LinehaulOption = {
  id: string
  title: string
  description: string
  detail?: string
}

type Props = {
  id: string
  label: string
  emptyLabel: string
  modalTitle: string
  modalDescription: string
  options: LinehaulOption[]
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}

export function LinehaulOptionPicker({ id, label, emptyLabel, modalTitle, modalDescription, options, value, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = options.find((option) => option.id === value)

  function close() {
    setOpen(false)
    window.setTimeout(() => trigger.current?.focus(), 0)
  }

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return needle ? options.filter((option) => `${option.title} ${option.description} ${option.detail ?? ''}`.toLowerCase().includes(needle)) : options
  }, [options, search])

  return <>
    <span className="block text-sm font-medium">{label}</span>
    <button aria-controls={`${id}-picker`} aria-expanded={open} aria-haspopup="dialog" className="mt-1 flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-sm outline-none hover:bg-zinc-50 focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111113] dark:hover:bg-white/5 dark:focus:border-purple-400" disabled={disabled || options.length === 0} onClick={() => { setSearch(''); setOpen(true) }} ref={trigger} type="button">
      {selected ? <span className="min-w-0"><span className="block truncate font-medium">{selected.title}</span><span className="mt-0.5 block truncate text-xs text-zinc-500">{selected.description}</span></span> : <span className="text-zinc-500">{options.length ? emptyLabel : `No ${label.toLowerCase()} available`}</span>}
      <span className="shrink-0 text-xs font-medium text-[#4C1268] dark:text-purple-300">{selected ? 'Change' : 'Select'}</span>
    </button>
    {open ? <div aria-labelledby={`${id}-picker-title`} aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3 sm:grid sm:place-items-center sm:p-4" id={`${id}-picker`} onMouseDown={(event) => { if (event.currentTarget === event.target) close() }} role="dialog">
      <div className="my-3 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col rounded-lg border border-zinc-200 bg-white shadow-lg sm:my-0 sm:max-h-[90vh] dark:border-white/10 dark:bg-[#18181b]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 p-4 dark:border-white/10 sm:p-5"><div><h3 className="text-lg font-semibold" id={`${id}-picker-title`}>{modalTitle}</h3><p className="mt-1 text-sm text-zinc-500">{modalDescription}</p></div><button aria-label={`Close ${label} picker`} className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10" onClick={close} type="button"><FaXmark aria-hidden="true" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <label className="relative block"><span className="sr-only">Search {label}</span><FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-zinc-400" /><input autoFocus className={`${field} pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${label.toLowerCase()}`} type="search" value={search} /></label>
          <div className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">{filtered.map((option) => <button className={`block w-full p-3 text-left hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#4C1268] dark:hover:bg-white/5 ${value === option.id ? 'bg-purple-50/70 dark:bg-purple-400/10' : ''}`} key={option.id} onClick={() => { onChange(option.id); close() }} type="button"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block truncate font-medium">{option.title}</strong><span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-300">{option.description}</span>{option.detail ? <span className="mt-1 block text-xs text-zinc-500">{option.detail}</span> : null}</span>{value === option.id ? <span className="shrink-0 text-xs font-semibold text-[#4C1268] dark:text-purple-300">Selected</span> : null}</span></button>)}{filtered.length === 0 ? <p className="p-4 text-sm text-zinc-500">No options match your search.</p> : null}</div>
        </div>
      </div>
    </div> : null}
  </>
}
