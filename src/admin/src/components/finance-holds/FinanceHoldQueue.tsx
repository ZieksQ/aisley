import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowRight, FaMagnifyingGlass, FaRotate } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchFinanceHolds } from '../../lib/financeHolds'
import type { FinanceHold } from '../../types/financeHolds'
import { formatDate, formatMoney, inputClass, panelClass, secondaryButtonClass } from '../pricing-settings/ui'

export function FinanceHoldQueue() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') === 'resolved' ? 'resolved' : 'open'
  const search = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [searchInput, setSearchInput] = useState(search)
  const [holds, setHolds] = useState<FinanceHold[]>([])
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchFinanceHolds(status, search, page, controller.signal)
      .then((response) => { setHolds(response.data); setMeta(response.meta) })
      .catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load Finance holds.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, reloadKey, search, status])

  function update(next: { status?: 'open' | 'resolved'; search?: string; page?: number }) {
    const nextStatus = next.status ?? status
    const nextSearch = next.search ?? search
    const nextPage = next.page ?? 1
    const value: Record<string, string> = { status: nextStatus }
    if (nextSearch) value.search = nextSearch
    if (nextPage > 1) value.page = String(nextPage)
    setParams(value)
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    update({ search: searchInput.trim(), page: 1 })
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-5" role="tablist" aria-label="Finance hold status">
          <button aria-selected={status === 'open'} className={tabClass(status === 'open')} onClick={() => update({ status: 'open' })} role="tab" type="button">Open</button>
          <button aria-selected={status === 'resolved'} className={tabClass(status === 'resolved')} onClick={() => update({ status: 'resolved' })} role="tab" type="button">Resolved</button>
        </div>
        <form className="flex w-full gap-2 sm:max-w-sm" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="finance-hold-search">Search Order reference</label>
          <div className="relative min-w-0 flex-1"><FaMagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClass} pl-9`} id="finance-hold-search" onChange={(event) => setSearchInput(event.target.value)} placeholder="Search Order reference" value={searchInput} /></div>
          <button className={secondaryButtonClass} type="submit">Search</button>
        </form>
      </div>

      {error ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert"><span>{error}</span><button className="inline-flex items-center gap-2 font-semibold underline underline-offset-2" onClick={() => setReloadKey((value) => value + 1)} type="button"><FaRotate aria-hidden="true" />Retry</button></div> : null}

      {loading ? <div aria-label="Loading Finance holds" className={`${panelClass} mt-5 h-64 animate-pulse`} /> : holds.length === 0 ? (
        <div className={`${panelClass} mt-5 p-8 text-center`}><h3 className="font-semibold">No {status} route reconciliation holds</h3><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">{search ? 'No hold matches this Order reference.' : status === 'open' ? 'Unplanned routes and incomplete carrier allocations will appear here when they require Admin review.' : 'Resolved route allocations will appear here for review.'}</p></div>
      ) : (
        <div className={`${panelClass} mt-5 overflow-hidden`}>
          <div className="divide-y divide-slate-200 dark:divide-white/10 md:hidden">{holds.map((hold) => <HoldCard hold={hold} key={hold.id} />)}</div>
          <div className="hidden overflow-x-auto md:block" role="region" aria-label={`${status} Finance holds`} tabIndex={0}>
            <table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.025] dark:text-slate-400"><tr><th className="px-4 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">Reason</th><th className="px-4 py-3 font-semibold">Destination</th><th className="px-4 py-3 font-semibold">Logistics pool</th><th className="px-4 py-3 font-semibold">Placed</th><th className="px-4 py-3"><span className="sr-only">Review</span></th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-white/10">{holds.map((hold) => <tr key={hold.id}><td className="px-4 py-3"><p className="font-semibold">{hold.order?.reference ?? 'Unknown Order'}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hold.order?.shop_name ?? 'Shop unavailable'}</p></td><td className="px-4 py-3"><span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">{hold.reason_label}</span></td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{destinationLabel(hold)}</td><td className="px-4 py-3 font-semibold tabular-nums">{formatMoney(hold.pricing?.logistics_pool_cents ?? 0, hold.order?.currency)}</td><td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(hold.placed_at)}</td><td className="px-4 py-3 text-right"><Link aria-label={`Review hold for Order ${hold.order?.reference}`} className="inline-flex items-center gap-2 font-semibold text-[#4C1268] hover:underline dark:text-pink-300" to={`/finance-holds/${hold.id}`} state={{ from: `?${params.toString()}` }}>Review<FaArrowRight aria-hidden="true" /></Link></td></tr>)}</tbody></table>
          </div>
        </div>
      )}

      {!loading && meta.last_page > 1 ? <nav aria-label="Finance hold pages" className="mt-5 flex items-center justify-between gap-4"><button className={secondaryButtonClass} disabled={meta.current_page <= 1} onClick={() => update({ page: meta.current_page - 1 })} type="button">Previous</button><p className="text-sm text-slate-500 dark:text-slate-400">Page {meta.current_page} of {meta.last_page} · {meta.total} holds</p><button className={secondaryButtonClass} disabled={meta.current_page >= meta.last_page} onClick={() => update({ page: meta.current_page + 1 })} type="button">Next</button></nav> : null}
    </>
  )
}

function HoldCard({ hold }: { hold: FinanceHold }) {
  return <article className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{hold.order?.reference ?? 'Unknown Order'}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hold.reason_label}</p></div><p className="font-semibold tabular-nums">{formatMoney(hold.pricing?.logistics_pool_cents ?? 0, hold.order?.currency)}</p></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-400">Destination</dt><dd className="mt-1">{destinationLabel(hold)}</dd></div><div><dt className="text-xs text-slate-400">Placed</dt><dd className="mt-1">{formatDate(hold.placed_at)}</dd></div></dl><Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#4C1268] dark:text-pink-300" to={`/finance-holds/${hold.id}`}>Review hold<FaArrowRight aria-hidden="true" /></Link></article>
}

function destinationLabel(hold: FinanceHold) {
  const destination = hold.pricing?.destination
  return destination?.city_municipality || destination?.province || destination?.region || 'Unavailable'
}

function tabClass(active: boolean) {
  return `border-b-2 px-1 pb-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6007A] ${active ? 'border-[#E6007A] text-[#4C1268] dark:text-pink-300' : 'border-transparent text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`
}
