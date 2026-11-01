import '../features/transport.css'
import { PortalButton as ActionButton, PortalSkeleton } from '@aisley/ui/portal'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaArrowsRotate } from 'react-icons/fa6'
import { FlatpickrInput } from '../components/FlatpickrInput'
import { LinehaulOptionPicker } from '../components/LinehaulOptionPicker'
import { ErrorNotice, field, panel } from '../components/PickupUi'
import { ApiError, csrf, request, requestWithTimeout } from '../lib/api'
import type { FulfillmentQueueResponse, FulfillmentShipment, FulfillmentTask } from '../types/fulfillment'
import type { SortingOverview } from '../types/sorting'
import { ParcelLaneMove } from '../components/ParcelLaneMove'

import type { DispatchCourier, DispatchSchedule } from '../features/lastMileDispatch/types'
import { DispatchScheduleTable } from '../features/lastMileDispatch/DispatchScheduleTable'

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
  const [sorting, setSorting] = useState<SortingOverview | null>(null)
  const [laneId, setLaneId] = useState('')
  const [combineLanes, setCombineLanes] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const pendingSchedule = useRef<{ body: string; key: string } | null>(null)
  const loadSequence = useRef(0)

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setLoading(true)
    setError('')
    try {
      const filters = new URLSearchParams({ status: 'sorted_at_hub', per_page: '25', page: String(page) })
      if (!combineLanes && laneId) filters.set('lane_id', laneId)
      if (search.trim()) filters.set('search', search.trim())
      const [ready, rejectedResponse, courierResponse, scheduleResponse, sortingResponse] = await Promise.all([
        requestWithTimeout<FulfillmentQueueResponse>(`/api/v1/logistics/dashboard/queue?${filters}`),
        requestWithTimeout<FulfillmentQueueResponse>('/api/v1/logistics/dashboard/queue?status=delivery_assigned&per_page=25'),
        requestWithTimeout<{ data: DispatchCourier[] }>('/api/v1/logistics/dispatch/couriers'),
        requestWithTimeout<{ data: DispatchSchedule[] }>('/api/v1/logistics/dispatch/schedules'),
        requestWithTimeout<{ data: SortingOverview }>('/api/v1/logistics/sorting'),
      ])
      if (sequence !== loadSequence.current) return
      setSorting(sortingResponse.data)
      setQueue(ready)
      setRejected(rejectedResponse.data.filter((shipment) => shipment.tasks.some((task) => task.leg === 'final_mile' && task.status === 'rejected')))
      setCouriers(courierResponse.data)
      setSchedules(scheduleResponse.data)
      setSelected((current) => current.filter((id) => ready.data.some((item) => item.shipment_id === id)))
    } catch (caught) {
      if (sequence === loadSequence.current) setError(caught instanceof ApiError ? caught.message : 'Dispatch data could not be loaded.')
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [combineLanes, laneId, page, search])

  useEffect(() => { document.title = 'Last-mile dispatch | Aisley Logistics'; void load() }, [load])

  const selectedCourier = useMemo(() => couriers.find((courier) => courier.courier_id === courierId), [courierId, couriers])

  const visible = queue?.data.filter((shipment) => combineLanes || !laneId || (shipment.sorting_lane?.id ?? 'unassigned') === laneId) ?? []
  const selectedSource = queue?.data.find((shipment) => selected.includes(shipment.shipment_id))
  const sourceKey = (shipment: FulfillmentShipment) => shipment.sorting_lane?.id ?? 'unassigned'

  function toggle(id: string) {
    const shipment = queue?.data.find((item) => item.shipment_id === id)
    if (!combineLanes && shipment && selectedSource && sourceKey(shipment) !== sourceKey(selectedSource)) return
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
      const body = JSON.stringify({ shipment_ids: selected, courier_id: courierId, scheduled_for: new Date(scheduledFor.replace(' ', 'T')).toISOString(), combine_lanes: combineLanes, assignments: selected.map((id) => { const shipment = queue!.data.find((item) => item.shipment_id === id)!; return { shipment_id: id, expected_revision: shipment.revision, lane_id: shipment.sorting_lane?.id ?? null, lane_revision: shipment.sorting_lane?.revision ?? null } }) })
      if (pendingSchedule.current?.body !== body) pendingSchedule.current = { body, key: crypto.randomUUID() }
      const response = await request<{ data: DispatchSchedule }>('/api/v1/logistics/dispatch/schedules', {
        method: 'POST',
        headers: { 'Idempotency-Key': pendingSchedule.current.key },
        body,
      })
      pendingSchedule.current = null
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
    if (!window.confirm(`Re-offer ${shipment.parcel?.tracking_id ?? shipment.parcel?.waybill_reference ?? 'this parcel'} to ${selectedCourier?.name ?? 'this Courier'}?`)) return
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

  return <div className="transport-workspace">
    <div className="transport-heading">
      <div><h1>Last-mile dispatch</h1><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Create one delivery schedule for one approved Courier. Only destination-hub parcels appear here; each schedule is limited to 15.</p></div>
      <ActionButton isLoading={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton>
    </div>
    {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}

    <div className="mt-2 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section className={`${panel} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 p-3 dark:border-white/10"><div><h3 className="font-semibold">Ready to dispatch</h3><p className="text-xs text-zinc-500">{queue?.meta.total ?? 0} parcels · {selected.length}/15 selected · oldest receipt first</p></div><ActionButton disabled={loading || busy || !visible.length} onClick={() => { const first = visible[0]; setSelected(visible.filter((item) => combineLanes || sourceKey(item) === sourceKey(first)).slice(0, 15).map((item) => item.shipment_id)) }}>Select up to 15</ActionButton></div>
        <div className="grid gap-3 border-b border-zinc-200 p-3 dark:border-white/10 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-medium">Source lane<select className={`${field} mt-1`} disabled={busy || combineLanes} value={laneId} onChange={(event) => { setLaneId(event.target.value); setPage(1); setSelected([]) }}><option value="">All lanes · one lane per batch</option>{queue?.summary.by_lane?.map((lane) => <option key={lane.id ?? 'unassigned'} value={lane.id ?? 'unassigned'}>{lane.code ?? 'Unassigned (legacy)'} · {lane.count} parcels</option>)}</select></label>
          <label className="min-w-0 text-sm font-medium">Find parcel<input className={`${field} mt-1`} maxLength={100} value={search} disabled={busy} onChange={(event) => { setSearch(event.target.value); setPage(1); setSelected([]) }} placeholder="Tracking ID or Order reference" /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input className="size-4 accent-[#2563EB]" type="checkbox" checked={combineLanes} disabled={busy} onChange={(event) => { setCombineLanes(event.target.checked); setPage(1); setSelected([]) }} />Combine standard lanes from this hub in one schedule</label>
        </div>
        {loading ? <PortalSkeleton label="Loading sorted parcels" /> : visible.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{visible.map((shipment) => {
          const checked = selected.includes(shipment.shipment_id)
          const otherLane = !combineLanes && selectedSource && sourceKey(shipment) !== sourceKey(selectedSource)
          return <li key={shipment.shipment_id} className={`flex min-w-0 flex-wrap items-center gap-2 px-3 py-2.5 ${checked ? 'bg-blue-50/70 dark:bg-blue-400/10' : ''}`}>
            <label className="flex min-w-0 flex-1 basis-48 cursor-pointer items-start gap-3"><input className="mt-1 size-4 shrink-0 accent-[#2563EB]" type="checkbox" checked={checked} disabled={busy || (shipment.sorting_lane && shipment.sorting_lane.operational_state !== 'open') || (!checked && (selected.length >= 15 || !!otherLane))} onChange={() => toggle(shipment.shipment_id)} /><span className="min-w-0"><span className="block break-all font-medium">{shipment.parcel?.order_reference ?? shipment.parcel?.reference}</span><span className="mt-1 block break-all font-mono text-xs text-zinc-500">{shipment.parcel?.tracking_id ?? shipment.parcel?.waybill_reference}</span><span className="mt-1 block text-xs text-zinc-500">{shipment.sorting_lane ? `${shipment.sorting_lane.code} · ${shipment.sorting_lane.name}` : 'Unassigned lane (legacy)'}</span></span></label>
            {(shipment.sorting_lane && shipment.sorting_lane.operational_state !== 'open') ? <p role="status" className="order-last w-full text-sm sm:order-none sm:w-auto">{shipment.sorting_lane?.operational_state}: {shipment.sorting_lane?.blocking_reason}</p> : null}
            <ParcelLaneMove shipmentId={shipment.shipment_id} revision={shipment.revision} laneId={shipment.sorting_lane?.id ?? null} lanes={sorting?.lanes ?? []} disabled={busy} onMoved={async () => { setSelected([]); await load() }} />
          </li>
        })}</ul> : <p className="p-4 text-sm text-zinc-500">No sorted parcels match this lane or search.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 p-3 text-sm dark:border-white/10"><span>Page {queue?.meta.current_page ?? page} of {queue?.meta.last_page ?? 1}</span><div className="flex gap-2"><ActionButton disabled={loading || busy || page <= 1} onClick={() => { setPage((value) => value - 1); setSelected([]) }}>Previous</ActionButton><ActionButton disabled={loading || busy || page >= (queue?.meta.last_page ?? 1)} onClick={() => { setPage((value) => value + 1); setSelected([]) }}>Next</ActionButton></div></div>
      </section>

      <aside className={`${panel} p-3 lg:sticky lg:top-20`}>
        <h3 className="font-semibold">Create delivery schedule</h3>
        <div className="mt-3">
          <LinehaulOptionPicker id="dispatch-courier" label="Courier" emptyLabel="Choose a Courier" modalTitle="Choose a Courier" modalDescription="Active, approved Couriers from this Logistics hub. Eligibility is rechecked when the dispatch is created." options={couriers.map((courier) => ({ id: courier.courier_id, title: courier.name, description: courier.email, detail: courier.contact_number ?? undefined }))} value={courierId} onChange={setCourierId} disabled={busy || loading} />
        </div>
        <label className="mt-3 block text-sm font-medium" htmlFor="dispatch-schedule">Delivery schedule</label>
        <FlatpickrInput id="dispatch-schedule" className={`${field} mt-1`} value={scheduledFor} onChange={setScheduledFor} options={{ enableTime: true, time_24hr: true, dateFormat: 'Y-m-d H:i', minDate: 'today', minuteIncrement: 15 }} />
        <p className="mt-2 text-xs leading-5 text-zinc-500">Creating the schedule marks these parcels as delivery assigned. The Courier must still accept and collect them from the hub.</p>
        <ActionButton variant="primary" className="mt-3 w-full" isLoading={busy} disabled={loading || !selected.length || !courierId || !scheduledFor} onClick={() => void createSchedule()}>Dispatch {selected.length || ''} parcel{selected.length === 1 ? '' : 's'}</ActionButton>
      </aside>
    </div>

    <DispatchScheduleTable schedules={schedules} />

    <section className={`${panel} mt-3 overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Rejected delivery offers</h3><p className="mt-1 text-xs text-zinc-500">Choose a Courier in the schedule panel, then re-offer the existing parcel task. Previous offers remain in history.</p></div>
      {rejected.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{rejected.map((shipment) => { const task = shipment.tasks.find((item) => item.leg === 'final_mile' && item.status === 'rejected'); return task ? <li key={shipment.shipment_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"><div><p className="font-medium">{shipment.parcel?.order_reference ?? shipment.parcel?.reference}</p><p className="mt-1 font-mono text-xs text-zinc-500">{shipment.parcel?.tracking_id ?? shipment.parcel?.waybill_reference}</p><p className="mt-1 text-xs text-red-700 dark:text-red-300">{task.offer?.rejection_reason ?? 'Courier rejected the delivery offer.'}</p></div><ActionButton isLoading={busy} disabled={!courierId} onClick={() => void reoffer(shipment, task)}>Re-offer to selected Courier</ActionButton></li> : null })}</ul> : <p className="px-4 py-6 text-sm text-zinc-500">No rejected delivery offers need reassignment.</p>}
    </section>
  </div>
}
