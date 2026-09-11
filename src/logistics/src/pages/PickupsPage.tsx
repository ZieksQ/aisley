import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowsRotate, FaMagnifyingGlass, FaPlus } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { ScheduleFields, toUtc } from '../components/PickupScheduleDialog'
import { ActionButton, ErrorNotice, PrimaryButton, StatusLabel, field, link, manilaDate, panel } from '../components/PickupUi'
import { ApiError, csrf, request } from '../lib/api'
import type { CourierOption, Pickup, PickupOrder, PickupPage, PickupSchedulePage } from '../types/pickups'

type SelectedParcel = Pick<PickupOrder, 'id' | 'reference'> & { pickupId: string; shopId: string }

function BatchCheckbox({ label, total, selected, disabled, toggle }: { label: string; total: number; selected: number; disabled: boolean; toggle: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (input.current) input.current.indeterminate = selected > 0 && selected < total }, [selected, total])

  return <input ref={input} aria-label={label} checked={total > 0 && selected === total} className="size-4 accent-[#4C1268]" disabled={disabled} onChange={toggle} type="checkbox" />
}

export function PickupsPage() {
  const [params, setParams] = useSearchParams()
  const createDialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState(params.get('search') ?? '')
  const [dateFrom, setDateFrom] = useState(params.get('date_from') ?? '')
  const [dateTo, setDateTo] = useState(params.get('date_to') ?? '')
  const [schedules, setSchedules] = useState<PickupSchedulePage | null>(null)
  const [pending, setPending] = useState<PickupPage | null>(null)
  const [couriers, setCouriers] = useState<CourierOption[]>([])
  const [selected, setSelected] = useState<SelectedParcel[]>([])
  const [courierId, setCourierId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingLoading, setPendingLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingError, setPendingError] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [notice, setNotice] = useState('')
  const page = Number(params.get('page') ?? '1')
  const status = params.get('status') ?? ''

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const search = new URLSearchParams({ per_page: '25', page: String(page) })
    if (status) search.set('status', status)
    if (params.get('search')) search.set('search', params.get('search')!)
    if (params.get('date_from')) search.set('date_from', params.get('date_from')!)
    if (params.get('date_to')) search.set('date_to', params.get('date_to')!)
    try {
      const [scheduleResult, courierResult] = await Promise.all([request<PickupSchedulePage>(`/api/v1/logistics/pickup-schedules?${search}`), request<{ data: CourierOption[] }>('/api/v1/logistics/pickup-couriers')])
      setSchedules(scheduleResult); setCouriers(courierResult.data)
      setCourierId((current) => current || (courierResult.data.length === 1 ? courierResult.data[0].id : ''))
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Pickup schedules could not be loaded.') }
    finally { setLoading(false) }
  }, [page, params, status])

  const loadPending = useCallback(async () => {
    setPendingLoading(true); setPendingError('')
    const search = new URLSearchParams({ include_orders: '1', has_unscheduled: '1', sort: 'shop_created', per_page: '50' })
    try {
      const result = await request<PickupPage>(`/api/v1/logistics/pickups?${search}`)
      setPending(result)
      const available = new Set(result.data.flatMap((pickup) => (pickup.orders ?? []).filter((order) => !order.scheduled).map((order) => order.id)))
      setSelected((current) => current.filter((parcel) => available.has(parcel.id)))
    } catch (reason) { setPendingError(reason instanceof ApiError ? reason.message : 'Pending parcels could not be loaded.') }
    finally { setPendingLoading(false) }
  }, [])

  useEffect(() => { document.title = 'Pickup schedules | Aisley Logistics'; void load() }, [load])
  const selectedIds = useMemo(() => new Set(selected.map((parcel) => parcel.id)), [selected])

  function submitFilters(event: FormEvent) { event.preventDefault(); const next = new URLSearchParams(params); next.delete('page'); if (query.trim()) next.set('search', query.trim()); else next.delete('search'); if (dateFrom) next.set('date_from', dateFrom); else next.delete('date_from'); if (dateTo) next.set('date_to', dateTo); else next.delete('date_to'); setParams(next) }
  function filter(nextStatus: string) { const next = new URLSearchParams(params); next.delete('page'); if (nextStatus) next.set('status', nextStatus); else next.delete('status'); setParams(next) }
  function openCreate() { setSelected([]); setScheduleError(''); setPending(null); createDialog.current?.showModal(); void loadPending() }
  function toggleParcel(pickup: Pickup, order: PickupOrder) {
    setSelected((current) => current.some((parcel) => parcel.id === order.id)
      ? current.filter((parcel) => parcel.id !== order.id)
      : current.length < 30 ? [...current, { id: order.id, reference: order.reference, pickupId: pickup.id, shopId: pickup.shop.id }] : current)
  }
  function togglePickup(pickup: Pickup) {
    const available = (pickup.orders ?? []).filter((order) => !order.scheduled)
    const selectedCount = available.filter((order) => selectedIds.has(order.id)).length
    if (selectedCount > 0) { setSelected((current) => current.filter((parcel) => parcel.pickupId !== pickup.id)); return }
    const remaining = 30 - selected.length
    setSelected((current) => [...current, ...available.slice(0, remaining).map((order) => ({ id: order.id, reference: order.reference, pickupId: pickup.id, shopId: pickup.shop.id }))])
  }
  async function createSchedule() {
    if (!selected.length || !courierId || !startsAt || !endsAt) return
    setBusy(true); setScheduleError('')
    const orderIds = selected.map((parcel) => parcel.id).sort()
    const storageKey = `logistics-pickup-schedule:${orderIds.join(':')}:${courierId}:${startsAt}:${endsAt}`
    let idempotencyKey = sessionStorage.getItem(storageKey)
    if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); sessionStorage.setItem(storageKey, idempotencyKey) }
    try {
      await csrf(); await request('/api/v1/logistics/pickup-schedules', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ order_ids: orderIds, courier_id: courierId, starts_at: toUtc(startsAt), ends_at: toUtc(endsAt) }) })
      sessionStorage.removeItem(storageKey); createDialog.current?.close(); setSelected([]); setNotice(`Schedule created with ${orderIds.length} parcels.`); await load()
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) await loadPending()
      setScheduleError(reason instanceof ApiError ? reason.message : 'The schedule could not be created.')
    } finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
      <div><h2 className="text-xl font-semibold">Pickup schedules</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Courier runs and their remaining first-mile parcels.</p></div>
      <div className="flex flex-wrap gap-2"><ActionButton busy={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton><PrimaryButton disabled={couriers.length === 0} onClick={openCreate}><FaPlus aria-hidden="true" />Create new schedule</PrimaryButton></div>
    </div>
    <form className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_12rem_10rem_10rem_auto]" onSubmit={submitFilters}>
      <label className="relative"><span className="sr-only">Search schedules</span><FaMagnifyingGlass className="pointer-events-none absolute left-3 top-3 text-zinc-400" aria-hidden="true" /><input className={`${field} pl-9`} onChange={(event) => setQuery(event.target.value)} placeholder="Schedule, Courier email, or Pickup ID" value={query} /></label>
      <label><span className="sr-only">Filter by status</span><select className={field} onChange={(event) => filter(event.target.value)} value={status}><option value="">All statuses</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      <label><span className="sr-only">Pickup date from</span><input aria-label="Pickup date from" className={field} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
      <label><span className="sr-only">Pickup date to</span><input aria-label="Pickup date to" className={field} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
      <ActionButton type="submit">Apply</ActionButton>
    </form>
    {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}
    <section className={`${panel} mt-4 overflow-hidden`} aria-busy={loading}>
      <div className="hidden grid-cols-[minmax(10rem,1.1fr)_minmax(10rem,1fr)_minmax(11rem,1.2fr)_8rem_minmax(11rem,1fr)_8rem] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 lg:grid"><span>Schedule</span><span>Courier</span><span>Pickup ID</span><span>Status</span><span>Pickup window</span><span>Parcels left</span></div>
      {loading && !schedules ? <div className="p-5 text-sm" role="status">Loading pickup schedules…</div> : schedules?.data.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{schedules.data.map((schedule) => <li className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 py-4 lg:grid-cols-[minmax(10rem,1.1fr)_minmax(10rem,1fr)_minmax(11rem,1.2fr)_8rem_minmax(11rem,1fr)_8rem] lg:items-center lg:gap-4" key={schedule.id}>
        <div><span className="mb-1 block text-xs font-medium text-zinc-500 lg:hidden">Schedule</span><p className="font-medium">{schedule.reference}</p><p className="mt-1 font-mono text-xs text-zinc-500" title={schedule.id}>{schedule.id.slice(0, 8)}</p></div>
        <div className="min-w-0"><span className="mb-1 block text-xs font-medium text-zinc-500 lg:hidden">Courier</span><p className="truncate text-sm font-medium">{schedule.courier.name || 'Courier'}</p><p className="truncate text-xs text-zinc-500">{schedule.courier.email}</p></div>
        <div><span className="mb-1 block text-xs font-medium text-zinc-500 lg:hidden">Pickup ID</span><div className="flex flex-wrap gap-x-3 gap-y-1">{schedule.pickup_requests.map((pickup) => <Link className={`${link} font-mono text-xs`} key={pickup.id} title={`${pickup.shop.name} · ${pickup.id}`} to={`/pickups/${pickup.id}`}>{pickup.id.slice(0, 8)}</Link>)}</div></div>
        <div><span className="mb-1 block text-xs font-medium text-zinc-500 lg:hidden">Status</span><StatusLabel status={schedule.status} /></div>
        <p className="text-sm leading-5"><span className="mb-1 block text-xs font-medium text-zinc-500 lg:hidden">Pickup window</span>{manilaDate(schedule.starts_at)}<br /><span className="text-xs text-zinc-500">to {new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(schedule.ends_at))} PHT</span></p>
        <p className="text-sm tabular-nums"><span className="mb-1 block text-xs font-medium text-zinc-500 lg:hidden">Parcels left</span><strong className="text-base">{schedule.remaining_parcel_count}</strong> of {schedule.parcel_count}</p>
      </li>)}</ul> : <div className="p-8 text-center"><h3 className="font-medium">No pickup schedules found</h3><p className="mt-1 text-sm text-zinc-500">Create a schedule when Seller parcels are ready for pickup.</p></div>}
    </section>
    {schedules && schedules.meta.last_page > 1 ? <nav aria-label="Schedule pagination" className="mt-4 flex items-center justify-between text-sm"><ActionButton disabled={page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next) }}>Previous</ActionButton><span>Page {schedules.meta.current_page} of {schedules.meta.last_page}</span><ActionButton disabled={page >= schedules.meta.last_page} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next) }}>Next</ActionButton></nav> : null}

    <dialog ref={createDialog} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-lg border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-white/10"><h3 className="text-lg font-semibold">Create pickup schedule</h3><p className="mt-1 text-sm text-zinc-500">Choose up to 30 pending parcels, then assign one Courier and pickup window.</p></div>
      <div className="grid max-h-[calc(90vh-5rem)] overflow-y-auto lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,.75fr)]">
        <section className="border-b border-zinc-200 lg:border-b-0 lg:border-r dark:border-white/10">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 dark:border-white/10 dark:bg-[#18181b]"><div><h4 className="font-semibold">Pending parcels</h4><p aria-live="polite" className="text-xs text-zinc-500">Sorted by Shop, then oldest request · {selected.length}/30 selected</p></div><ActionButton busy={pendingLoading} onClick={() => void loadPending()}><FaArrowsRotate aria-hidden="true" />Reload</ActionButton></div>
          {pendingError ? <div className="m-4"><ErrorNotice message={pendingError} retry={() => void loadPending()} /></div> : null}
          {pendingLoading && !pending ? <p className="p-5 text-sm" role="status">Loading pending parcels…</p> : pending?.data.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{pending.data.map((pickup) => {
            const available = (pickup.orders ?? []).filter((order) => !order.scheduled)
            const selectedCount = available.filter((order) => selectedIds.has(order.id)).length
            return <li key={pickup.id}>
              <div className="flex items-start gap-3 bg-zinc-50 px-5 py-3 dark:bg-white/[0.03]"><BatchCheckbox label={`Select parcels from ${pickup.shop.name}`} total={available.length} selected={selectedCount} disabled={!available.length || (selected.length >= 30 && selectedCount === 0)} toggle={() => togglePickup(pickup)} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{pickup.shop.name}</p><time className="text-xs text-zinc-500">{manilaDate(pickup.created_at)}</time></div><p className="mt-1 font-mono text-xs text-zinc-500">Pickup {pickup.id}</p></div></div>
              <ul className="divide-y divide-zinc-100 dark:divide-white/5">{available.map((order) => <li className="flex items-center gap-3 px-5 py-2.5 pl-12" key={order.id}><input aria-label={`Select parcel ${order.reference}`} checked={selectedIds.has(order.id)} className="size-4 accent-[#4C1268]" disabled={!selectedIds.has(order.id) && selected.length >= 30} onChange={() => toggleParcel(pickup, order)} type="checkbox" /><div className="min-w-0"><p className="text-sm font-medium">{order.reference}</p><p className="text-xs text-zinc-500">{order.waybill?.reference ?? 'Waybill unavailable'}</p></div></li>)}</ul>
            </li>
          })}</ul> : !pendingLoading ? <div className="p-8 text-center"><h4 className="font-medium">No pending parcels</h4><p className="mt-1 text-sm text-zinc-500">All available Seller parcels are already scheduled.</p></div> : null}
          {pending && pending.meta.last_page > 1 ? <p className="border-t border-zinc-200 px-5 py-3 text-xs text-amber-700 dark:border-white/10 dark:text-amber-300">Showing the first 50 Shop pickup requests, ordered oldest first within each Shop.</p> : null}
        </section>
        <aside className="p-5"><h4 className="font-semibold">Assignment</h4><ScheduleFields couriers={couriers} courierId={courierId} setCourierId={setCourierId} startsAt={startsAt} setStartsAt={setStartsAt} endsAt={endsAt} setEndsAt={setEndsAt} />
          <div className="mt-4 border-y border-zinc-200 py-3 text-sm dark:border-white/10"><div className="flex justify-between"><span>Selected parcels</span><strong>{selected.length} / 30</strong></div><div className="mt-2 flex justify-between"><span>Shops</span><strong>{new Set(selected.map((parcel) => parcel.shopId)).size}</strong></div></div>
          {scheduleError ? <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">{scheduleError}</p> : null}
          <p className="mt-4 text-xs leading-5 text-zinc-500">Pickup times use Philippine Time (Asia/Manila). The API rechecks parcel availability, Courier eligibility, schedule overlap, and the 30-parcel capacity before saving.</p>
          <div className="mt-5 flex justify-end gap-2"><ActionButton onClick={() => createDialog.current?.close()}>Cancel</ActionButton><PrimaryButton busy={busy} disabled={!selected.length || !courierId || !startsAt || !endsAt} onClick={() => void createSchedule()}>Create schedule</PrimaryButton></div>
        </aside>
      </div>
    </dialog>
  </div>
}
