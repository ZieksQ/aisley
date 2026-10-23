import { PortalButton } from '@aisley/ui/portal'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { FaArrowsRotate, FaMagnifyingGlass, FaTruckFast, FaXmark } from 'react-icons/fa6'
import type { CourierAvailabilityOption } from '../types/pickups'
import { formatPhtDateTime, localParts, PICKUP_TIME_ZONE, type ScheduleWindow } from '../lib/pickupSchedule'
import { FlatpickrInput } from './FlatpickrInput'


type ScheduleFieldsProps = {
  couriers: CourierAvailabilityOption[]
  courierId: string
  setCourierId: (value: string) => void
  startDateTime: string
  setStartDateTime: (value: string) => void
  endDateTime: string
  setEndDateTime: (value: string) => void
  courierLoading?: boolean
  courierError?: string
  onWindowChange?: (window: ScheduleWindow) => void
  onRefreshCouriers?: () => void
  idPrefix?: string
}

export function ScheduleFields({
  couriers,
  courierId,
  setCourierId,
  startDateTime,
  setStartDateTime,
  endDateTime,
  setEndDateTime,
  courierLoading = false,
  courierError = '',
  onWindowChange,
  onRefreshCouriers,
  idPrefix = 'schedule',
}: ScheduleFieldsProps) {
  const earliest = localParts(new Date(Date.now() + 60_000).toISOString())
  const earliestDateTime = `${earliest.date} ${earliest.time}`
  const minimumEndDateTime = startDateTime || earliestDateTime

  function updateWindow(next: Partial<ScheduleWindow>) {
    const window = { startDateTime, endDateTime, ...next }
    onWindowChange?.(window)
  }

  return <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-medium" htmlFor={`${idPrefix}-start`}>
      Start date &amp; time (PHT)
      <FlatpickrInput className={`portal-input mt-1`} id={`${idPrefix}-start`} placeholder="Select start date and time" required value={startDateTime} onChange={(value) => { setStartDateTime(value); updateWindow({ startDateTime: value }) }} options={{ dateFormat: 'Y-m-d H:i', enableTime: true, minDate: earliestDateTime, minuteIncrement: 1, time_24hr: true }} />
    </label>
    <label className="text-sm font-medium" htmlFor={`${idPrefix}-end`}>
      End date &amp; time (PHT)
      <FlatpickrInput className={`portal-input mt-1`} id={`${idPrefix}-end`} placeholder="Select end date and time" required value={endDateTime} onChange={(value) => { setEndDateTime(value); updateWindow({ endDateTime: value }) }} options={{ dateFormat: 'Y-m-d H:i', enableTime: true, minDate: minimumEndDateTime, minuteIncrement: 1, time_24hr: true }} />
    </label>
    <p className="text-xs leading-5 text-slate-600 dark:text-slate-400 sm:col-span-2">Choose the start and end of the pickup window. All times use Philippine time (PHT).</p>
    <div className="sm:col-span-2">
      <CourierPicker couriers={couriers} courierError={courierError} courierId={courierId} courierLoading={courierLoading} endDateTime={endDateTime} idPrefix={idPrefix} onRefreshCouriers={onRefreshCouriers} setCourierId={setCourierId} startDateTime={startDateTime} />
    </div>
  </div>
}

export type CourierPickerProps = {
  couriers: CourierAvailabilityOption[]
  courierId: string
  setCourierId: (value: string) => void
  courierLoading: boolean
  courierError: string
  startDateTime: string
  endDateTime: string
  onRefreshCouriers?: () => void
  idPrefix: string
  modalDescription?: string
  uncheckedAvailabilityText?: string
  modalFootnote?: string
}

export function CourierPicker({ couriers, courierId, setCourierId, courierLoading, courierError, startDateTime, endDateTime, onRefreshCouriers, idPrefix, modalDescription, uncheckedAvailabilityText, modalFootnote }: CourierPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = couriers.find((courier) => courier.id === courierId)

  function close() {
    setOpen(false)
    window.setTimeout(() => trigger.current?.focus(), 0)
  }

  return <>
    <span className="block text-sm font-medium">Courier</span>
    <button ref={trigger} aria-controls={`${idPrefix}-courier-picker`} aria-expanded={open} aria-haspopup="dialog" className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none hover:bg-slate-50 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-white/5 dark:focus:border-blue-400" disabled={couriers.length === 0} onClick={() => { setSearch(''); setOpen(true) }} type="button">
      {selected ? <span className="min-w-0"><span className="block truncate font-medium">{selected.name || 'Courier'}</span><span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-400">{selected.email}</span></span> : <span className="text-slate-600 dark:text-slate-400">{couriers.length === 0 ? 'No eligible Couriers' : 'Choose a Courier'}</span>}
      <span className="shrink-0 text-xs font-medium text-[#2563EB] dark:text-blue-300">{selected ? 'Change' : 'Select'}</span>
    </button>
    {selected ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{selected.contact_number ? `${selected.contact_number} · ` : ''}{selected.status === 'active' ? 'Account active' : `Account ${selected.status}`}</p> : null}
    {courierError ? <p className="mt-2 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{courierError}</p> : null}
    {open ? <CourierPickerModal couriers={couriers} courierError={courierError} courierId={courierId} courierLoading={courierLoading} endDateTime={endDateTime} id={idPrefix} modalDescription={modalDescription} modalFootnote={modalFootnote} onClose={close} onRefreshCouriers={onRefreshCouriers} onSelect={(id) => { setCourierId(id); close() }} startDateTime={startDateTime} search={search} setSearch={setSearch} uncheckedAvailabilityText={uncheckedAvailabilityText} /> : null}
  </>
}

type CourierPickerModalProps = {
  couriers: CourierAvailabilityOption[]
  courierId: string
  courierLoading: boolean
  courierError: string
  startDateTime: string
  endDateTime: string
  id: string
  onClose: () => void
  onRefreshCouriers?: () => void
  onSelect: (id: string) => void
  search: string
  setSearch: (value: string) => void
  modalDescription?: string
  uncheckedAvailabilityText?: string
  modalFootnote?: string
}

function CourierPickerModal({ couriers, courierId, courierLoading, courierError, startDateTime, endDateTime, id, modalDescription, modalFootnote, onClose, onRefreshCouriers, onSelect, search, setSearch, uncheckedAvailabilityText }: CourierPickerModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return couriers
    return couriers.filter((courier) => `${courier.name} ${courier.email} ${courier.contact_number ?? ''}`.toLowerCase().includes(needle))
  }, [couriers, search])
  const checkedWindow = Boolean(startDateTime && endDateTime)
  const windowLabel = checkedWindow ? `${formatPhtDateTime(startDateTime)}–${formatPhtDateTime(endDateTime)} PHT` : ''

  return <div aria-labelledby={`${id}-courier-picker-title`} aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3 sm:grid sm:place-items-center sm:p-4" id={`${id}-courier-picker`} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }} role="dialog">
    <div className="my-3 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-lg sm:my-0 sm:max-h-[90dvh] dark:border-slate-700 dark:bg-slate-800">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-700 sm:p-5">
        <div>
          <h3 className="text-lg font-semibold" id={`${id}-courier-picker-title`}>Choose a Courier</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{modalDescription ?? 'Active, approved Couriers from this Logistics hub. Check the selected date and time for schedule conflicts.'}</p>
        </div>
        <button aria-label="Close Courier picker" className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose} type="button"><FaXmark aria-hidden="true" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">{checkedWindow ? `Requested window: ${windowLabel}. Availability is checked against it.` : uncheckedAvailabilityText ?? 'Choose a date and both times to check availability.'} Attendance tracking is not enabled yet, so account status is shown as active for now.</p>
        {courierError ? <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{courierError}</p> : null}
        <div className="mt-3 flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search Couriers</span>
            <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input autoFocus className={`portal-input pl-10!`} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or contact number" type="search" value={search} />
          </label>
          {onRefreshCouriers ? <button aria-label="Refresh Couriers" aria-busy={courierLoading} className="grid size-11 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/10" disabled={courierLoading} onClick={onRefreshCouriers} title="Refresh Couriers" type="button"><FaArrowsRotate className={courierLoading ? 'animate-spin' : ''} aria-hidden="true" /></button> : null}
        </div>
        {courierLoading && couriers.length === 0 ? <p className="p-4 text-sm" role="status">Checking active Couriers…</p> : <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-slate-700">
          {filtered.map((courier) => {
            const unavailable = courier.status !== 'active' || courier.availability === 'scheduled'
            return <button className={`block w-full p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563EB] sm:p-4 ${unavailable ? 'cursor-not-allowed opacity-65' : 'hover:bg-slate-50 dark:hover:bg-white/5'} ${courierId === courier.id ? 'bg-blue-50/70 dark:bg-blue-400/10' : ''}`} disabled={unavailable || courierLoading} key={courier.id} onClick={() => onSelect(courier.id)} type="button">
              <div className="flex items-start gap-3">
                <FaTruckFast aria-hidden="true" className="mt-1 shrink-0 text-[#2563EB] dark:text-blue-300" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-start justify-between gap-3"><strong className="font-medium">{courier.name || 'Courier'}</strong><span className={`text-xs font-semibold ${courier.status === 'active' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{courier.status === 'active' ? 'Active' : courier.status}</span></span>
                  <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{courier.email}{courier.contact_number ? ` · ${courier.contact_number}` : ''}</span>
                  <span className={`mt-2 block text-xs font-medium ${courier.availability === 'available' ? 'text-emerald-700 dark:text-emerald-300' : courier.availability === 'scheduled' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'}`}>{availabilityLabel(courier.availability)}</span>
                  {courier.schedules.length > 0 ? <span className="mt-2 block text-xs leading-5 text-slate-600 dark:text-slate-400"><span className="font-medium text-slate-700 dark:text-slate-300">Schedules affecting these dates:</span> {courier.schedules.map((schedule) => `${formatPhtDateTime(schedule.starts_at)}–${formatPhtDateTime(schedule.ends_at)} PHT`).join(' · ')}</span> : null}
                </span>
              </div>
            </button>
          })}
          {filtered.length === 0 ? <p className="p-4 text-sm text-slate-600 dark:text-slate-400">No Couriers match your search.</p> : null}
        </div>}
        <p className="mt-2 pb-1 text-[11px] text-slate-600 dark:text-slate-400">{modalFootnote ?? `All times use ${PICKUP_TIME_ZONE}. The API rechecks Courier status and overlapping schedules before assigning work.`}</p>
      </div>
    </div>
  </div>
}

function availabilityLabel(value: CourierAvailabilityOption['availability']): string {
  if (value === 'available') return 'Open for this date and time'
  if (value === 'scheduled') return 'Has an overlapping pickup schedule'
  return 'Date and time not checked'
}

export function ScheduleDialog({ dialog, busy, error, title, description, submitLabel, submit, ...fields }: ScheduleFieldsProps & { dialog: RefObject<HTMLDialogElement | null>; busy: boolean; error: string; title: string; description: string; submitLabel: string; submit: () => void }) {
  const canSubmit = Boolean(fields.courierId && fields.startDateTime && fields.endDateTime) && !fields.courierLoading

  return <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-slate-200 bg-white p-5 text-slate-950 backdrop:bg-black/55 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
    <h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p><ScheduleFields {...fields} />
    {error ? <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
    <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">Times are entered in Philippine Time ({PICKUP_TIME_ZONE}) and stored as UTC.</p>
    <div className="mt-5 flex justify-end gap-2"><PortalButton onClick={() => dialog.current?.close()} type="button">Cancel</PortalButton><PortalButton variant="primary" isLoading={busy} disabled={!canSubmit} onClick={submit} type="button">{submitLabel}</PortalButton></div>
  </dialog>
}
