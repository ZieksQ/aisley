import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, apiRequest } from '../lib/api'
import type { LowStockAlert } from '../types/operations'

export function LowStockAlertDetailPage() {
  const { alertId } = useParams()
  const [alert, setAlert] = useState<LowStockAlert | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!alertId) return
    document.title = 'Low-stock alert | Aisley Seller'
    setError('')
    apiRequest<{ data: LowStockAlert }>(`/api/v1/seller/low-stock-alerts/${alertId}`)
      .then((response) => setAlert(response.data))
      .catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : 'Unable to load this alert.'))
  }, [alertId, reload])

  if (error) return <div className="p-8"><p className="text-sm text-red-700 dark:text-red-400">{error}</p><div className="mt-3 flex gap-4"><button className="text-sm font-medium text-[#4C1268] dark:text-purple-300" onClick={() => setReload((value) => value + 1)}>Try again</button><Link className="text-sm text-zinc-500" to="/low-stock-alerts">Back to alerts</Link></div></div>
  if (!alert) return <p className="p-8 text-sm text-zinc-500">Loading alert…</p>

  return <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-8">
    <Link className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white" to="/low-stock-alerts">← Low-stock alerts</Link>
    <div className="mt-3 border-b border-zinc-200 pb-5 dark:border-white/10"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold">{alert.product.name}</h2><p className="mt-1 font-mono text-sm text-zinc-500">{alert.sku.code}</p></div><span className={`text-sm font-medium ${alert.state === 'active' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{alert.state === 'active' ? 'Active alert' : 'Resolved'}</span></div></div>
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]"><div className="grid grid-cols-2 border-b border-zinc-200 dark:border-white/10 sm:grid-cols-4">{[['Available now', alert.current_available], ['Current threshold', alert.current_threshold], ['At trigger', alert.trigger_available], ['Trigger threshold', alert.trigger_threshold]].map(([label, value]) => <div className="p-4" key={label}><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}</div><dl className="grid gap-5 p-5 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Triggered</dt><dd className="mt-1">{new Date(alert.triggered_at).toLocaleString()}</dd></div><div><dt className="text-zinc-500">Resolved</dt><dd className="mt-1">{alert.resolved_at ? `${new Date(alert.resolved_at).toLocaleString()} · ${alert.resolution_reason?.replace('_', ' ')}` : 'Not resolved'}</dd></div><div><dt className="text-zinc-500">Source movement</dt><dd className="mt-1 capitalize">{alert.trigger_movement?.type.replace('_', ' ') ?? 'Threshold evaluation'}</dd></div><div><dt className="text-zinc-500">Inventory</dt><dd className="mt-1"><Link className="font-medium text-[#4C1268] dark:text-purple-300" to={alert.inventory_destination}>Open SKU inventory</Link></dd></div></dl></section>
  </div>
}
