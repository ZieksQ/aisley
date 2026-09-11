import type { RefObject } from 'react'
import type { CourierOption } from '../types/pickups'
import { ActionButton, PrimaryButton, field } from './PickupUi'

export const toUtc = (value: string) => new Date(`${value}:00+08:00`).toISOString()
export const localInput = (value: string) => new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value)).replace(' ', 'T')

type ScheduleFieldsProps = {
  couriers: CourierOption[]
  courierId: string
  setCourierId: (value: string) => void
  startsAt: string
  setStartsAt: (value: string) => void
  endsAt: string
  setEndsAt: (value: string) => void
}

export function ScheduleFields({ couriers, courierId, setCourierId, startsAt, setStartsAt, endsAt, setEndsAt }: ScheduleFieldsProps) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-medium sm:col-span-2">Courier<select className={`${field} mt-1`} required value={courierId} onChange={(event) => setCourierId(event.target.value)}><option value="">Select an eligible Courier</option>{couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name || 'Courier'} · {courier.email}</option>)}</select></label>
    <label className="text-sm font-medium">Starts (PHT)<input className={`${field} mt-1`} min={localInput(new Date(Date.now() + 60_000).toISOString())} required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
    <label className="text-sm font-medium">Ends (PHT)<input className={`${field} mt-1`} min={startsAt} required type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
  </div>
}

export function ScheduleDialog({ dialog, busy, error, title, description, submitLabel, submit, ...fields }: ScheduleFieldsProps & { dialog: RefObject<HTMLDialogElement | null>; busy: boolean; error: string; title: string; description: string; submitLabel: string; submit: () => void }) {
  return <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-zinc-200 bg-white p-5 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white">
    <h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p><ScheduleFields {...fields} />
    {error ? <p className="mt-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
    <p className="mt-3 text-xs text-zinc-500">Times are entered in Philippine Time (Asia/Manila) and stored as UTC.</p>
    <div className="mt-5 flex justify-end gap-2"><ActionButton onClick={() => dialog.current?.close()}>Cancel</ActionButton><PrimaryButton busy={busy} onClick={submit}>{submitLabel}</PrimaryButton></div>
  </dialog>
}
