import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowRight, FaArrowsRotate, FaMagnifyingGlass } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { ActionButton, ErrorNotice, StatusLabel, field, manilaDate, panel } from '../components/PickupUi'
import { ApiError, request } from '../lib/api'
import type { PickupPage } from '../types/pickups'

export function PickupsPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('search') ?? '')
  const [dateFrom, setDateFrom] = useState(params.get('date_from') ?? '')
  const [dateTo, setDateTo] = useState(params.get('date_to') ?? '')
  const [result, setResult] = useState<PickupPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const page = Number(params.get('page') ?? '1')
  const status = params.get('status') ?? ''

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const search = new URLSearchParams({ per_page: '25', page: String(page) })
    if (status) search.set('status', status)
    if (params.get('search')) search.set('search', params.get('search')!)
    if (params.get('date_from')) search.set('date_from', params.get('date_from')!)
    if (params.get('date_to')) search.set('date_to', params.get('date_to')!)
    try { setResult(await request<PickupPage>(`/api/v1/logistics/pickups?${search}`)) }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'Pickup requests could not be loaded.') }
    finally { setLoading(false) }
  }, [page, params, status])

  useEffect(() => { document.title = 'Pickups | Aisley Logistics'; void load() }, [load])
  function submit(event: FormEvent) { event.preventDefault(); const next = new URLSearchParams(params); next.delete('page'); if (query.trim()) next.set('search', query.trim()); else next.delete('search'); if (dateFrom) next.set('date_from', dateFrom); else next.delete('date_from'); if (dateTo) next.set('date_to', dateTo); else next.delete('date_to'); setParams(next) }
  function filter(nextStatus: string) { const next = new URLSearchParams(params); next.delete('page'); if (nextStatus) next.set('status', nextStatus); else next.delete('status'); setParams(next) }

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
      <div><h2 className="text-xl font-semibold">Pickups</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Review Seller handoffs, assign Couriers, and manage pickup windows.</p></div>
      <ActionButton busy={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton>
    </div>
    <form className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1fr)_12rem_10rem_10rem_auto]" onSubmit={submit}>
      <label className="relative"><span className="sr-only">Search pickups</span><FaMagnifyingGlass className="pointer-events-none absolute left-3 top-3 text-zinc-400" aria-hidden="true" /><input className={`${field} pl-9`} onChange={(event) => setQuery(event.target.value)} placeholder="Order or waybill reference" value={query} /></label>
      <label><span className="sr-only">Filter by schedule status</span><select className={field} onChange={(event) => filter(event.target.value)} value={status}><option value="">All schedule states</option><option value="pending_logistics">Unscheduled</option><option value="partially_scheduled">Partially scheduled</option><option value="scheduled">Scheduled</option></select></label>
      <label><span className="sr-only">Ready from date</span><input aria-label="Ready from date" className={field} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
      <label><span className="sr-only">Ready to date</span><input aria-label="Ready to date" className={field} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
      <ActionButton type="submit">Search</ActionButton>
    </form>
    {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    <section className={`${panel} mt-4 overflow-hidden`} aria-busy={loading}>
      <div className="hidden grid-cols-[minmax(12rem,1.5fr)_minmax(10rem,1fr)_7rem_10rem_2rem] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400 md:grid"><span>Seller / pickup area</span><span>Ready</span><span>Orders</span><span>Schedule</span><span /></div>
      {loading && !result ? <div className="p-5 text-sm" role="status">Loading pickup requests…</div> : result?.data.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{result.data.map((pickup) => <li key={pickup.id}><Link className="grid gap-3 px-4 py-4 hover:bg-zinc-50 dark:hover:bg-white/[0.03] md:grid-cols-[minmax(12rem,1.5fr)_minmax(10rem,1fr)_7rem_10rem_2rem] md:items-center md:gap-4" to={`/pickups/${pickup.id}`}>
        <div className="min-w-0"><p className="truncate font-medium">{pickup.shop.name}</p><p className="mt-1 truncate text-sm text-zinc-500">{pickup.shop.pickup_area ? [pickup.shop.pickup_area.city_municipality, pickup.shop.pickup_area.province].join(', ') : 'Pickup area unavailable'}</p></div>
        <div className="text-sm"><span className="mr-2 text-xs font-medium text-zinc-500 md:hidden">Ready</span>{manilaDate(pickup.ready_at)} <span className="text-xs text-zinc-500">PHT</span></div>
        <div className="text-sm tabular-nums"><span className="mr-2 text-xs font-medium text-zinc-500 md:hidden">Orders</span>{pickup.order_count}</div>
        <div><StatusLabel status={pickup.status} />{pickup.unscheduled_count > 0 ? <p className="mt-1 text-xs text-zinc-500">{pickup.unscheduled_count} left</p> : null}</div>
        <FaArrowRight className="hidden text-zinc-400 md:block" aria-hidden="true" />
      </Link></li>)}</ul> : <div className="p-7 text-center"><h3 className="font-medium">No pickup requests found</h3><p className="mt-1 text-sm text-zinc-500">New requests from Sellers assigned to your organization will appear here.</p></div>}
    </section>
    {result && result.meta.last_page > 1 ? <nav aria-label="Pickup pagination" className="mt-4 flex items-center justify-between text-sm"><ActionButton disabled={page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next) }}>Previous</ActionButton><span>Page {result.meta.current_page} of {result.meta.last_page}</span><ActionButton disabled={page >= result.meta.last_page} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next) }}>Next</ActionButton></nav> : null}
    <p className="mt-3 text-xs text-zinc-500">Pickup times are shown in Philippine Time (Asia/Manila).</p>
  </div>
}
