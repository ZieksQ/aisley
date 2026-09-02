import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import type { LowStockAlertPage } from '../types/operations'

export function LowStockAlertsPage() {
  const [page, setPage] = useState<LowStockAlertPage | null>(null)
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    document.title = 'Low-stock alerts | Aisley Seller'
    const query = new URLSearchParams({ page: String(pageNumber), ...(search ? { search } : {}), ...(state ? { state } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) })
    setError('')
    apiRequest<LowStockAlertPage>(`/api/v1/seller/low-stock-alerts?${query}`)
      .then(setPage)
      .catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : 'Unable to load low-stock alerts.'))
  }, [from, pageNumber, reload, search, state, to])

  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="border-b border-zinc-200 pb-5 dark:border-white/10">
      <h2 className="text-2xl font-semibold">Low-stock alerts</h2>
      <p className="mt-1 text-sm text-zinc-500">Review each threshold crossing and see when stock recovered.</p>
    </div>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <input className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(event) => { setSearch(event.target.value); setPageNumber(1) }} placeholder="Search product or SKU" value={search} />
      <select className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]" onChange={(event) => { setState(event.target.value); setPageNumber(1) }} value={state}>
        <option value="">All alerts</option><option value="active">Active</option><option value="resolved">Resolved</option>
      </select>
      <label className="text-xs text-zinc-500">From<input aria-label="Alerts from date" className="mt-1 block h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-white/15 dark:bg-[#18181b] dark:text-white" onChange={(event) => { setFrom(event.target.value); setPageNumber(1) }} type="date" value={from} /></label>
      <label className="text-xs text-zinc-500">To<input aria-label="Alerts to date" className="mt-1 block h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-white/15 dark:bg-[#18181b] dark:text-white" min={from} onChange={(event) => { setTo(event.target.value); setPageNumber(1) }} type="date" value={to} /></label>
    </div>
    <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">
      {error ? <div className="p-5"><p className="text-sm text-red-700 dark:text-red-400">{error}</p><button className="mt-3 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-white/15" onClick={() => setReload((value) => value + 1)}>Try again</button></div> : !page ? <p className="p-5 text-sm text-zinc-500">Loading alerts…</p> : page.data.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-medium">{page.configured_threshold_count === 0 ? 'No alert thresholds configured' : 'No alerts match this view'}</p><p className="mt-1 text-sm text-zinc-500">{page.configured_threshold_count === 0 ? 'Set a threshold on an inventory SKU to start monitoring it.' : 'Thresholds are configured, but no matching threshold crossing has been recorded.'}</p>{page.configured_threshold_count === 0 ? <Link className="mt-4 inline-block text-sm font-medium text-[#4C1268] dark:text-purple-300" to="/inventory">Open inventory</Link> : null}</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]"><tr><th className="px-4 py-3">Product / SKU</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Threshold</th><th className="px-4 py-3">Triggered</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-white/10">{page.data.map((alert) => <tr key={alert.id}><td className="px-4 py-4"><Link className="font-medium text-[#4C1268] dark:text-purple-300" to={`/low-stock-alerts/${alert.id}`}>{alert.product.name}</Link><p className="mt-1 font-mono text-xs text-zinc-500">{alert.sku.code}</p></td><td className="px-4 py-4 capitalize">{alert.state}</td><td className={`px-4 py-4 font-medium tabular-nums ${alert.current_available === 0 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>{alert.current_available}</td><td className="px-4 py-4 tabular-nums">{alert.current_threshold}</td><td className="px-4 py-4 text-zinc-500">{new Date(alert.triggered_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
    </div>
    {page && page.last_page > 1 ? <div className="mt-4 flex items-center justify-between text-sm"><button className="rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-40 dark:border-white/15" disabled={page.current_page === 1} onClick={() => setPageNumber((value) => value - 1)}>Previous</button><span className="text-zinc-500">Page {page.current_page} of {page.last_page}</span><button className="rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-40 dark:border-white/15" disabled={page.current_page === page.last_page} onClick={() => setPageNumber((value) => value + 1)}>Next</button></div> : null}
  </div>
}
