import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { FaMagnifyingGlass, FaTruckFast, FaXmark } from 'react-icons/fa6'
import type { CourierAvailabilityOption } from '../types/pickups'
import { formatPhtDate, formatPhtTime, localParts, PICKUP_TIME_ZONE, toUtc, type ScheduleWindow } from '../lib/pickupSchedule'
import { FlatpickrInput } from './FlatpickrInput'
import { ActionButton, PrimaryButton, field } from './PickupUi'

type ScheduleFieldsProps = {
  couriers: CourierAvailabilityOption[]
  courierId: string
  setCourierId: (value: string) => void
  pickupDate: string
  setPickupDate: (value: string) => void
  startTime: string
  setStartTime: (value: string) => void
  endTime: string
  setEndTime: (value: string) => void
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
  pickupDate,
  setPickupDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  courierLoading = false,
  courierError = '',
  onWindowChange,
  onRefreshCouriers,
  idPrefix = 'schedule',
}: ScheduleFieldsProps) {
  const earliest = localParts(new Date(Date.now() + 60_000).toISOString())
  const minStartTime = pickupDate === earliest.date ? earliest.time : undefined

  function updateWindow(next: Partial<ScheduleWindow>) {
    const window = { date: pickupDate, startTime, endTime, ...next }
    onWindowChange?.(window)
  }

  return <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-medium sm:col-span-2" htmlFor={`${idPrefix}-date`}>
      Pickup date (PHT)
      <FlatpickrInput className={`${field} mt-1`} id={`${idPrefix}-date`} placeholder="Select pickup date" required value={pickupDate} onChange={(value) => { setPickupDate(value); updateWindow({ date: value }) }} options={{ dateFormat: 'Y-m-d', minDate: earliest.date }} />
    </label>
    <label className="text-sm font-medium" htmlFor={`${idPrefix}-start-time`}>
      Start time (PHT)
      <FlatpickrInput className={`${field} mt-1`} id={`${idPrefix}-start-time`} placeholder="Select start time" required value={startTime} onChange={(value) => { setStartTime(value); updateWindow({ startTime: value }) }} options={{ dateFormat: 'H:i', enableTime: true, minTime: minStartTime, minuteIncrement: 1, noCalendar: true, time_24hr: true }} />
    </label>
    <label className="text-sm font-medium" htmlFor={`${idPrefix}-end-time`}>
      End time (PHT)
      <FlatpickrInput className={`${field} mt-1`} id={`${idPrefix}-end-time`} placeholder="Select end time" required value={endTime} onChange={(value) => { setEndTime(value); updateWindow({ endTime: value }) }} options={{ dateFormat: 'H:i', enableTime: true, minTime: startTime || undefined, minuteIncrement: 1, noCalendar: true, time_24hr: true }} />
    </label>
    <p className="text-xs leading-5 text-zinc-500 sm:col-span-2">Choose the date separately from the time so the schedule works consistently across browsers. The API stores the selected window in UTC.</p>
    <div className="sm:col-span-2">
      <CourierPicker couriers={couriers} courierError={courierError} courierId={courierId} courierLoading={courierLoading} endTime={endTime} idPrefix={idPrefix} onRefreshCouriers={onRefreshCouriers} pickupDate={pickupDate} setCourierId={setCourierId} startTime={startTime} />
    </div>
  </div>
}

type CourierPickerProps = {
  couriers: CourierAvailabilityOption[]
  courierId: string
  setCourierId: (value: string) => void
  courierLoading: boolean
  courierError: string
  pickupDate: string
  startTime: string
  endTime: string
  onRefreshCouriers?: () => void
  idPrefix: string
}

function CourierPicker({ couriers, courierId, setCourierId, courierLoading, courierError, pickupDate, startTime, endTime, onRefreshCouriers, idPrefix }: CourierPickerProps) {
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
    <button ref={trigger} aria-controls={`${idPrefix}-courier-picker`} aria-expanded={open} aria-haspopup="dialog" className="mt-1 flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-left text-sm outline-none hover:bg-zinc-50 focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-[#111113] dark:hover:bg-white/5 dark:focus:border-purple-400" disabled={couriers.length === 0} onClick={() => { setSearch(''); setOpen(true) }} type="button">
      {selected ? <span className="min-w-0"><span className="block truncate font-medium">{selected.name || 'Courier'}</span><span className="mt-0.5 block truncate text-xs text-zinc-500">{selected.email}</span></span> : <span className="text-zinc-500">{couriers.length === 0 ? 'No eligible Couriers' : 'Choose a Courier'}</span>}
      <span className="shrink-0 text-xs font-medium text-[#4C1268] dark:text-purple-300">{selected ? 'Change' : 'Select'}</span>
    </button>
    {selected ? <p className="mt-1 text-xs text-zinc-500">{selected.contact_number ? `${selected.contact_number} · ` : ''}{selected.status === 'active' ? 'Account active' : `Account ${selected.status}`}</p> : null}
    {courierError ? <p className="mt-2 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{courierError}</p> : null}
    {open ? <CourierPickerModal couriers={couriers} courierError={courierError} courierId={courierId} courierLoading={courierLoading} endTime={endTime} id={idPrefix} onClose={close} onRefreshCouriers={onRefreshCouriers} onSelect={(id) => { setCourierId(id); close() }} pickupDate={pickupDate} search={search} setSearch={setSearch} startTime={startTime} /> : null}
  </>
}

type CourierPickerModalProps = {
  couriers: CourierAvailabilityOption[]
  courierId: string
  courierLoading: boolean
  courierError: string
  pickupDate: string
  startTime: string
  endTime: string
  id: string
  onClose: () => void
  onRefreshCouriers?: () => void
  onSelect: (id: string) => void
  search: string
  setSearch: (value: string) => void
}

function CourierPickerModal({ couriers, courierId, courierLoading, courierError, pickupDate, startTime, endTime, id, onClose, onRefreshCouriers, onSelect, search, setSearch }: CourierPickerModalProps) {
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
  const checkedWindow = Boolean(pickupDate && startTime && endTime)
  const windowLabel = checkedWindow ? `${formatPhtDate(pickupDate)} · ${formatPhtTime(toUtc(pickupDate, startTime))}–${formatPhtTime(toUtc(pickupDate, endTime))} PHT` : ''

  return <div aria-labelledby={`${id}-courier-picker-title`} aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" id={`${id}-courier-picker`} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }} role="dialog">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#18181b]">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5 dark:border-white/10">
        <div>
          <h3 className="text-lg font-semibold" id={`${id}-courier-picker-title`}>Choose a Courier</h3>
          <p className="mt-1 text-sm text-zinc-500">Active, approved Couriers from this Logistics hub. Check the selected date and time for schedule conflicts.</p>
        </div>
        <button aria-label="Close Courier picker" className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10" onClick={onClose} type="button"><FaXmark aria-hidden="true" /></button>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-zinc-500">{checkedWindow ? `Requested window: ${windowLabel}. Availability is checked against it.` : 'Choose a date and both times to check availability.'} Attendance tracking is not enabled yet, so account status is shown as active for now.</p>
          {onRefreshCouriers ? <ActionButton busy={courierLoading} onClick={onRefreshCouriers}>Refresh</ActionButton> : null}
        </div>
        {courierError ? <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{courierError}</p> : null}
        <label className="relative mt-4 block">
          <span className="sr-only">Search Couriers</span>
          <FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-zinc-400" />
          <input autoFocus className={`${field} h-11 pl-10`} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or contact number" type="search" value={search} />
        </label>
        {courierLoading && couriers.length === 0 ? <p className="p-5 text-sm" role="status">Checking active Couriers…</p> : <div className="mt-4 max-h-[55vh] divide-y divide-zinc-200 overflow-y-auto border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">
          {filtered.map((courier) => {
            const unavailable = courier.status !== 'active' || courier.availability === 'scheduled'
            return <button className={`block w-full p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#4C1268] ${unavailable ? 'cursor-not-allowed opacity-65' : 'hover:bg-zinc-50 dark:hover:bg-white/5'} ${courierId === courier.id ? 'bg-purple-50/70 dark:bg-purple-400/10' : ''}`} disabled={unavailable || courierLoading} key={courier.id} onClick={() => onSelect(courier.id)} type="button">
              <div className="flex items-start gap-3">
                <FaTruckFast aria-hidden="true" className="mt-1 shrink-0 text-[#4C1268] dark:text-purple-300" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-start justify-between gap-3"><strong className="font-medium">{courier.name || 'Courier'}</strong><span className={`text-xs font-semibold ${courier.status === 'active' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{courier.status === 'active' ? 'Active' : courier.status}</span></span>
                  <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-300">{courier.email}{courier.contact_number ? ` · ${courier.contact_number}` : ''}</span>
                  <span className={`mt-2 block text-xs font-medium ${courier.availability === 'available' ? 'text-emerald-700 dark:text-emerald-300' : courier.availability === 'scheduled' ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-500'}`}>{availabilityLabel(courier.availability)}</span>
                  {courier.schedules.length > 0 ? <span className="mt-2 block text-xs leading-5 text-zinc-500"><span className="font-medium text-zinc-700 dark:text-zinc-300">Schedules on this date:</span> {courier.schedules.map((schedule) => `${formatPhtTime(schedule.starts_at)}–${formatPhtTime(schedule.ends_at)}`).join(' · ')}</span> : null}
                </span>
              </div>
            </button>
          })}
          {filtered.length === 0 ? <p className="p-5 text-sm text-zinc-500">No Couriers match your search.</p> : null}
        </div>}
        <p className="mt-3 text-[11px] text-zinc-500">All times use {PICKUP_TIME_ZONE}. The API rechecks Courier status and overlapping schedules before assigning work.</p>
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
  const canSubmit = Boolean(fields.courierId && fields.pickupDate && fields.startTime && fields.endTime) && !fields.courierLoading

  return <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white">
    <h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p><ScheduleFields {...fields} />
    {error ? <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
    <p className="mt-3 text-xs text-zinc-500">Times are entered in Philippine Time ({PICKUP_TIME_ZONE}) and stored as UTC.</p>
    <div className="mt-5 flex justify-end gap-2"><ActionButton onClick={() => dialog.current?.close()} type="button">Cancel</ActionButton><PrimaryButton busy={busy} disabled={!canSubmit} onClick={submit} type="button">{submitLabel}</PrimaryButton></div>
  </dialog>
}
