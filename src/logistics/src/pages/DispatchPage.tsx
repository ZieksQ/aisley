import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaArrowsRotate, FaTruckFast } from 'react-icons/fa6'
import { FlatpickrInput } from '../components/FlatpickrInput'
import { CourierPicker } from '../components/PickupScheduleDialog'
import { ActionButton, ErrorNotice, PrimaryButton, field, manilaDate, panel } from '../components/PickupUi'
import { ApiError, csrf, request, requestWithTimeout } from '../lib/api'
import type { FulfillmentQueueResponse, FulfillmentShipment, FulfillmentTask } from '../types/fulfillment'
import type { CourierAvailabilityOption } from '../types/pickups'

type DispatchCourier = { courier_id: string; name: string; email: string; contact_number: string | null }
type DispatchSchedule = {
  id: string
  reference: string
  status: string
  scheduled_for: string
  parcel_count: number
  courier: { id: string; name: string; email: string; contact_number: string | null }
  parcels: Array<{ shipment_id: string; order_reference: string | null; waybill_reference: string | null; sequence: number }>
}

function localDefault(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function DispatchPage() {
  const [queue, setQueue] = useState<FulfillmentQueueResponse | null>(null)
  const [rejected, setRejected] = useState<FulfillmentShipment[]>([])
  const [couriers, setCouriers] = useState<DispatchCourier[]>([])
  const [schedules, setSchedules] = useState<DispatchSchedule[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [courierId, setCourierId] = useState('')
  const [scheduledFor, setScheduledFor] = useState(localDefault)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ready, rejectedResponse, courierResponse, scheduleResponse] = await Promise.all([
        requestWithTimeout<FulfillmentQueueResponse>('/api/v1/logistics/dashboard/queue?status=sorted_at_hub&per_page=25'),
        requestWithTimeout<FulfillmentQueueResponse>('/api/v1/logistics/dashboard/queue?status=delivery_assigned&per_page=25'),
        requestWithTimeout<{ data: DispatchCourier[] }>('/api/v1/logistics/dispatch/couriers'),
        requestWithTimeout<{ data: DispatchSchedule[] }>('/api/v1/logistics/dispatch/schedules'),
      ])
      setQueue(ready)
      setRejected(rejectedResponse.data.filter((shipment) => shipment.tasks.some((task) => task.leg === 'final_mile' && task.status === 'rejected')))
      setCouriers(courierResponse.data)
      setSchedules(scheduleResponse.data)
      setSelected((current) => current.filter((id) => ready.data.some((item) => item.shipment_id === id)))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Dispatch data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { document.title = 'Dispatch | Aisley Logistics'; void load() }, [load])

  const selectedCourier = useMemo(() => couriers.find((courier) => courier.courier_id === courierId), [courierId, couriers])
  const pickerCouriers = useMemo<CourierAvailabilityOption[]>(() => couriers.map((courier) => ({ id: courier.courier_id, name: courier.name, email: courier.email, contact_number: courier.contact_number, status: 'active', availability: 'not_checked', schedules: [] })), [couriers])

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 15 ? [...current, id] : current)
  }

  async function createSchedule() {
    if (!selected.length || !courierId || !scheduledFor) return
    if (!window.confirm(`Schedule ${selected.length} parcel${selected.length === 1 ? '' : 's'} with ${selectedCourier?.name ?? 'this Courier'}? The Customer will see the delivery assignment.`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await csrf()
      const response = await request<{ data: DispatchSchedule }>('/api/v1/logistics/dispatch/schedules', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ shipment_ids: selected, courier_id: courierId, scheduled_for: new Date(scheduledFor.replace(' ', 'T')).toISOString() }),
      })
      setNotice(`${response.data.reference} created for ${response.data.parcel_count} parcel${response.data.parcel_count === 1 ? '' : 's'}.`)
      setSelected([])
      setCourierId('')
      setScheduledFor(localDefault())
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The dispatch schedule could not be created.')
    } finally {
      setBusy(false)
    }
  }

  async function reoffer(shipment: FulfillmentShipment, task: FulfillmentTask) {
    if (!courierId) {
      setError('Choose an approved Courier before re-offering a rejected delivery.')
      return
    }
    if (!window.confirm(`Re-offer ${shipment.parcel?.waybill_reference ?? 'this parcel'} to ${selectedCourier?.name ?? 'this Courier'}?`)) return
    setBusy(true)
    setError('')
    try {
      await csrf()
      await request(`/api/v1/logistics/deploy-rider/tasks/${task.task_id}/offers`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ courier_id: courierId, expected_task_revision: task.revision }),
      })
      setNotice('The rejected delivery was offered to the selected Courier. Prior offer history was preserved.')
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The delivery could not be re-offered.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-white/10">
      <div><div className="flex items-center gap-3"><FaTruckFast className="text-[#4C1268] dark:text-purple-300" aria-hidden="true" /><h2 className="text-xl font-semibold">Dispatch parcels</h2></div><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Create one delivery schedule for one approved Courier. Only sorted parcels appear here; each schedule is limited to 15.</p></div>
      <ActionButton busy={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton>
    </div>
    {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}

    <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <section className={`${panel} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10"><div><h3 className="font-semibold">Ready to dispatch</h3><p className="mt-1 text-xs text-zinc-500">{queue?.meta.total ?? 0} sorted parcel{queue?.meta.total === 1 ? '' : 's'} · {selected.length}/15 selected</p></div>{queue?.data.length ? <button className="text-sm font-medium text-[#4C1268] dark:text-purple-300" type="button" onClick={() => setSelected(queue.data.slice(0, 15).map((item) => item.shipment_id))}>Select first 15</button> : null}</div>
        {loading && !queue ? <p className="p-4 text-sm">Loading sorted parcels…</p> : queue?.data.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{queue.data.map((shipment) => { const checked = selected.includes(shipment.shipment_id); return <li key={shipment.shipment_id}><label className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/[0.04] ${checked ? 'bg-purple-50/70 dark:bg-purple-400/10' : ''}`}><input className="mt-1 size-4 accent-[#4C1268]" type="checkbox" checked={checked} disabled={!checked && selected.length >= 15} onChange={() => toggle(shipment.shipment_id)} /><span className="min-w-0"><span className="block font-medium">{shipment.parcel?.order_reference ?? shipment.parcel?.reference}</span><span className="mt-1 block truncate font-mono text-xs text-zinc-500">{shipment.parcel?.waybill_reference}</span><span className="mt-1 block text-xs text-zinc-500">{shipment.parcel?.item_count ?? 0} item{shipment.parcel?.item_count === 1 ? '' : 's'} · sorted and ready</span></span></label></li>})}</ul> : <p className="px-4 py-6 text-center text-sm text-zinc-500">No sorted parcels are ready to dispatch.</p>}
      </section>

      <aside className={`${panel} p-3 xl:sticky xl:top-20`}>
        <h3 className="font-semibold">Create delivery schedule</h3>
        <div className="mt-3">
          <CourierPicker couriers={pickerCouriers} courierError="" courierId={courierId} courierLoading={loading} endDateTime="" idPrefix="dispatch" modalDescription="Active, approved Couriers from this Logistics hub. The API rechecks eligibility when the dispatch is created." modalFootnote="The API rechecks Courier status and hub eligibility before assigning work." onRefreshCouriers={() => { void load() }} setCourierId={setCourierId} startDateTime="" uncheckedAvailabilityText="Dispatch availability is checked by the API when this schedule is created." />
        </div>
        <label className="mt-3 block text-sm font-medium" htmlFor="dispatch-schedule">Delivery schedule</label>
        <FlatpickrInput id="dispatch-schedule" className={`${field} mt-1`} value={scheduledFor} onChange={setScheduledFor} options={{ enableTime: true, time_24hr: true, dateFormat: 'Y-m-d H:i', minDate: 'today', minuteIncrement: 15 }} />
        <p className="mt-2 text-xs leading-5 text-zinc-500">Creating the schedule marks these parcels as delivery assigned. The Courier must still accept and collect them from the hub.</p>
        <PrimaryButton className="mt-3 w-full" busy={busy} disabled={!selected.length || !courierId || !scheduledFor} onClick={() => void createSchedule()}>Dispatch {selected.length || ''} parcel{selected.length === 1 ? '' : 's'}</PrimaryButton>
      </aside>
    </div>

    <section className={`${panel} mt-3 overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Recent dispatch schedules</h3></div>
      {schedules.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{schedules.map((schedule) => <li key={schedule.id} className="grid gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><p className="font-medium">{schedule.reference}</p><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{schedule.courier.name} · {schedule.courier.contact_number ?? schedule.courier.email}</p></div><div className="text-left text-xs text-zinc-500 sm:text-right"><p>{manilaDate(schedule.scheduled_for)}</p><p className="mt-1">{schedule.parcel_count} parcel{schedule.parcel_count === 1 ? '' : 's'}</p></div></li>)}</ul> : <p className="px-4 py-6 text-center text-sm text-zinc-500">No dispatch schedules have been created.</p>}
    </section>

    <section className={`${panel} mt-3 overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Rejected delivery offers</h3><p className="mt-1 text-xs text-zinc-500">Choose a Courier in the schedule panel, then re-offer the existing parcel task. Previous offers remain in history.</p></div>
      {rejected.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{rejected.map((shipment) => { const task = shipment.tasks.find((item) => item.leg === 'final_mile' && item.status === 'rejected'); return task ? <li key={shipment.shipment_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"><div><p className="font-medium">{shipment.parcel?.order_reference ?? shipment.parcel?.reference}</p><p className="mt-1 font-mono text-xs text-zinc-500">{shipment.parcel?.waybill_reference}</p><p className="mt-1 text-xs text-red-700 dark:text-red-300">{task.offer?.rejection_reason ?? 'Courier rejected the delivery offer.'}</p></div><ActionButton busy={busy} disabled={!courierId} onClick={() => void reoffer(shipment, task)}>Re-offer to selected Courier</ActionButton></li> : null })}</ul> : <p className="px-4 py-6 text-sm text-zinc-500">No rejected delivery offers need reassignment.</p>}
    </section>
  </div>
}
