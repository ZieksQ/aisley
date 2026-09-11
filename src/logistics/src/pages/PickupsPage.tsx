import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowRight, FaArrowsRotate, FaMagnifyingGlass } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { ScheduleDialog, toUtc } from '../components/PickupScheduleDialog'
import { ActionButton, ErrorNotice, PrimaryButton, StatusLabel, field, manilaDate, panel } from '../components/PickupUi'
import { ApiError, csrf, request } from '../lib/api'
import type { CourierOption, Pickup, PickupOrder, PickupPage } from '../types/pickups'

type SelectedOrder = Pick<PickupOrder, 'id' | 'reference'> & { pickupId: string; shopId: string }

function PickupSelection({ label, availableCount, selectedCount, disabled, toggle }: { label: string; availableCount: number; selectedCount: number; disabled: boolean; toggle: () => void }) {
  const checkbox = useRef<HTMLInputElement>(null)
  useEffect(() => { if (checkbox.current) checkbox.current.indeterminate = selectedCount > 0 && selectedCount < availableCount }, [availableCount, selectedCount])

  return <input ref={checkbox} aria-label={label} checked={availableCount > 0 && selectedCount === availableCount} className="size-4 accent-[#4C1268]" disabled={disabled} onChange={toggle} type="checkbox" />
}

export function PickupsPage() {
  const [params, setParams] = useSearchParams()
  const dialog = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState(params.get('search') ?? '')
  const [dateFrom, setDateFrom] = useState(params.get('date_from') ?? '')
  const [dateTo, setDateTo] = useState(params.get('date_to') ?? '')
  const [result, setResult] = useState<PickupPage | null>(null)
  const [couriers, setCouriers] = useState<CourierOption[]>([])
  const [selected, setSelected] = useState<SelectedOrder[]>([])
  const [courierId, setCourierId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [notice, setNotice] = useState('')
  const page = Number(params.get('page') ?? '1')
  const status = params.get('status') ?? ''

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const search = new URLSearchParams({ per_page: '25', page: String(page), include_orders: '1' })
    if (status) search.set('status', status)
    if (params.get('search')) search.set('search', params.get('search')!)
    if (params.get('date_from')) search.set('date_from', params.get('date_from')!)
    if (params.get('date_to')) search.set('date_to', params.get('date_to')!)
    try {
      const [pickupResult, courierResult] = await Promise.all([request<PickupPage>(`/api/v1/logistics/pickups?${search}`), request<{ data: CourierOption[] }>('/api/v1/logistics/pickup-couriers')])
      setResult(pickupResult); setCouriers(courierResult.data)
      setCourierId((current) => current || (courierResult.data.length === 1 ? courierResult.data[0].id : ''))
      const available = new Set(pickupResult.data.flatMap((pickup) => (pickup.orders ?? []).filter((order) => !order.scheduled).map((order) => order.id)))
      setSelected((current) => current.filter((order) => !pickupResult.data.some((pickup) => pickup.id === order.pickupId) || available.has(order.id)))
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Pickup requests could not be loaded.') }
    finally { setLoading(false) }
  }, [page, params, status])

  useEffect(() => { document.title = 'Pickups | Aisley Logistics'; void load() }, [load])
  const selectedIds = useMemo(() => new Set(selected.map((order) => order.id)), [selected])
  const sellerCount = useMemo(() => new Set(selected.map((order) => order.shopId)).size, [selected])
  const requestCount = useMemo(() => new Set(selected.map((order) => order.pickupId)).size, [selected])

  function submit(event: FormEvent) { event.preventDefault(); const next = new URLSearchParams(params); next.delete('page'); if (query.trim()) next.set('search', query.trim()); else next.delete('search'); if (dateFrom) next.set('date_from', dateFrom); else next.delete('date_from'); if (dateTo) next.set('date_to', dateTo); else next.delete('date_to'); setParams(next) }
  function filter(nextStatus: string) { const next = new URLSearchParams(params); next.delete('page'); if (nextStatus) next.set('status', nextStatus); else next.delete('status'); setParams(next) }
  function selectPickup(pickup: Pickup) {
    const available = (pickup.orders ?? []).filter((order) => !order.scheduled)
    const selectedFromPickup = available.filter((order) => selectedIds.has(order.id))
    if (selectedFromPickup.length > 0) { setSelected((current) => current.filter((order) => order.pickupId !== pickup.id)); return }
    const remaining = 30 - selected.length
    if (remaining <= 0) return
    setSelected((current) => [...current, ...available.slice(0, remaining).map((order) => ({ id: order.id, reference: order.reference, pickupId: pickup.id, shopId: pickup.shop.id }))])
  }
  function openCreate() { setScheduleError(''); dialog.current?.showModal() }
  async function createSchedule() {
    if (!selected.length || !courierId || !startsAt || !endsAt) return
    setBusy(true); setScheduleError('')
    const orderIds = selected.map((order) => order.id).sort()
    const storageKey = `logistics-multi-pickup-schedule:${orderIds.join(':')}:${courierId}:${startsAt}:${endsAt}`
    let idempotencyKey = sessionStorage.getItem(storageKey)
    if (!idempotencyKey) { idempotencyKey = crypto.randomUUID(); sessionStorage.setItem(storageKey, idempotencyKey) }
    try {
      await csrf(); await request('/api/v1/logistics/pickup-schedules', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ order_ids: orderIds, courier_id: courierId, starts_at: toUtc(startsAt), ends_at: toUtc(endsAt) }) })
      sessionStorage.removeItem(storageKey); dialog.current?.close(); setSelected([]); setNotice(`Pickup schedule created for ${orderIds.length} parcels. The Sellers and Courier will be notified.`); await load()
    } catch (reason) {
      const message = reason instanceof ApiError ? reason.message : 'The schedule could not be created.'
      if (reason instanceof ApiError && reason.status === 409) await load()
      setScheduleError(message)
    } finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
      <div><h2 className="text-xl font-semibold">Pickups</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Combine Seller handoffs into one Courier run, with up to 30 parcels per schedule.</p></div>
      <div className="flex flex-wrap gap-2"><PrimaryButton disabled={!selected.length || couriers.length === 0} onClick={openCreate}>Schedule selected ({selected.length}/30)</PrimaryButton><ActionButton busy={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton></div>
    </div>
    <form className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_12rem_10rem_10rem_auto]" onSubmit={submit}>
      <label className="relative"><span className="sr-only">Search pickups</span><FaMagnifyingGlass className="pointer-events-none absolute left-3 top-3 text-zinc-400" aria-hidden="true" /><input className={`${field} pl-9`} onChange={(event) => setQuery(event.target.value)} placeholder="Order or waybill reference" value={query} /></label>
      <label><span className="sr-only">Filter by schedule status</span><select className={field} onChange={(event) => filter(event.target.value)} value={status}><option value="">All schedule states</option><option value="pending_logistics">Unscheduled</option><option value="partially_scheduled">Partially scheduled</option><option value="scheduled">Scheduled</option></select></label>
      <label><span className="sr-only">Ready from date</span><input aria-label="Ready from date" className={field} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
      <label><span className="sr-only">Ready to date</span><input aria-label="Ready to date" className={field} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
      <ActionButton type="submit">Search</ActionButton>
    </form>
    {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}
    {selected.length ? <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-purple-200 bg-purple-50 px-4 py-3 text-sm dark:border-purple-400/20 dark:bg-purple-400/10"><p aria-live="polite"><strong>{selected.length} parcels</strong> from {sellerCount} {sellerCount === 1 ? 'Seller' : 'Sellers'} across {requestCount} pickup {requestCount === 1 ? 'request' : 'requests'}.</p><button className="font-medium text-[#4C1268] hover:underline dark:text-purple-300" onClick={() => setSelected([])} type="button">Clear selection</button></div> : null}
    <section className={`${panel} mt-4 overflow-hidden`} aria-busy={loading}>
      <div className="hidden grid-cols-[2rem_minmax(12rem,1.5fr)_minmax(10rem,1fr)_7rem_10rem_2rem] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 md:grid"><span className="sr-only">Select</span><span>Seller / pickup area</span><span>Ready</span><span>Orders</span><span>Schedule</span><span /></div>
      {loading && !result ? <div className="p-5 text-sm" role="status">Loading pickup requests…</div> : result?.data.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{result.data.map((pickup) => {
        const available = (pickup.orders ?? []).filter((order) => !order.scheduled)
        const selectedCount = available.filter((order) => selectedIds.has(order.id)).length
        return <li className="grid gap-3 px-4 py-4 md:grid-cols-[2rem_minmax(12rem,1.5fr)_minmax(10rem,1fr)_7rem_10rem_2rem] md:items-center md:gap-4" key={pickup.id}>
          <PickupSelection label={`Select unscheduled parcels from ${pickup.shop.name}`} availableCount={available.length} selectedCount={selectedCount} disabled={available.length === 0 || (selected.length >= 30 && selectedCount === 0)} toggle={() => selectPickup(pickup)} />
          <Link className="min-w-0 hover:underline" to={`/pickups/${pickup.id}`}><p className="truncate font-medium">{pickup.shop.name}</p><p className="mt-1 truncate text-sm text-zinc-500">{pickup.shop.pickup_area ? [pickup.shop.pickup_area.city_municipality, pickup.shop.pickup_area.province].join(', ') : 'Pickup area unavailable'}</p></Link>
          <div className="text-sm"><span className="mr-2 text-xs font-medium text-zinc-500 md:hidden">Ready</span>{manilaDate(pickup.ready_at)} <span className="text-xs text-zinc-500">PHT</span></div>
          <div className="text-sm tabular-nums"><span className="mr-2 text-xs font-medium text-zinc-500 md:hidden">Orders</span>{pickup.order_count}{selectedCount > 0 ? <p className="text-xs text-[#4C1268] dark:text-purple-300">{selectedCount} selected</p> : null}</div>
          <div><StatusLabel status={pickup.status} />{pickup.unscheduled_count > 0 ? <p className="mt-1 text-xs text-zinc-500">{pickup.unscheduled_count} left</p> : null}</div>
          <Link aria-label={`Open ${pickup.shop.name} pickup request`} className="hidden text-zinc-400 md:block" to={`/pickups/${pickup.id}`}><FaArrowRight aria-hidden="true" /></Link>
        </li>
      })}</ul> : <div className="p-7 text-center"><h3 className="font-medium">No pickup requests found</h3><p className="mt-1 text-sm text-zinc-500">New requests from Sellers assigned to your organization will appear here.</p></div>}
    </section>
    {result && result.meta.last_page > 1 ? <nav aria-label="Pickup pagination" className="mt-4 flex items-center justify-between text-sm"><ActionButton disabled={page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next) }}>Previous</ActionButton><span>Page {result.meta.current_page} of {result.meta.last_page}</span><ActionButton disabled={page >= result.meta.last_page} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next) }}>Next</ActionButton></nav> : null}
    <p className="mt-3 text-xs text-zinc-500">Select one or more Seller pickup requests. If a request would exceed the 30-parcel limit, only the remaining capacity is selected. Times are shown in Philippine Time (Asia/Manila).</p>
    <ScheduleDialog dialog={dialog} busy={busy} error={scheduleError} couriers={couriers} courierId={courierId} setCourierId={setCourierId} startsAt={startsAt} setStartsAt={setStartsAt} endsAt={endsAt} setEndsAt={setEndsAt} title="Confirm Courier pickup run" description={`${selected.length} parcels from ${sellerCount} ${sellerCount === 1 ? 'Seller' : 'Sellers'} across ${requestCount} pickup ${requestCount === 1 ? 'request' : 'requests'} will share this schedule.`} submitLabel="Create schedule" submit={() => void createSchedule()} />
  </div>
}
