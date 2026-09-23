import { useCallback, useEffect, useMemo, useState } from 'react'
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@aisley/ui'
import '@xyflow/react/dist/style.css'
import type { FinanceWorkspaceData, FinanceWorkspaceProps, LedgerPage } from './types'

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const amount = (cents: number) => peso.format(cents / 100)

export function FinanceWorkspace({ roleLabel, endpointPrefix, csvUrl, request }: FinanceWorkspaceProps) {
  const [workspace, setWorkspace] = useState<FinanceWorkspaceData | null>(null)
  const [ledger, setLedger] = useState<LedgerPage | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (query = '') => {
    setLoading(true); setError('')
    try {
      const [summary, entries] = await Promise.all([
        request<{ data: FinanceWorkspaceData }>(endpointPrefix + '/summary'),
        request<LedgerPage>(endpointPrefix + '/ledger?per_page=25&search=' + encodeURIComponent(query)),
      ])
      setWorkspace(summary.data); setLedger(entries)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Finance data is unavailable.')
    } finally { setLoading(false) }
  }, [endpointPrefix, request])

  useEffect(() => { void load() }, [load])

  if (loading && !workspace) return <main className="p-4 sm:p-6 lg:p-8"><p className="text-sm text-zinc-500" role="status">Loading finance workspace…</p></main>
  if (error && !workspace) return <main className="p-4 sm:p-6 lg:p-8"><div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}<Button className="ml-3 min-h-9 rounded-md px-3 shadow-none" onClick={() => void load()} variant="outline">Retry</Button></div></main>
  if (!workspace) return null

  const cards = [
    ['Revenue', workspace.summary.revenueCents], ['Costs', workspace.summary.costsCents],
    ['Operating profit', workspace.summary.profitCents], ['Available balance', workspace.summary.availableBalanceCents],
  ] as const
  const series = [
    ...workspace.series.map((point) => ({ ...point, forecastRevenueCents: null })),
    ...workspace.forecast.series.map((point) => ({ date: point.date, actualRevenueCents: null, actualProfitCents: null, forecastRevenueCents: point.forecastRevenueCents })),
  ]

  return <main className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">Finance</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{roleLabel} revenue, costs, settlement, and forecasting in PHP.</p></div><span className="text-xs text-zinc-500">Updated {new Date(workspace.generatedAt).toLocaleString('en-PH', { timeZone: workspace.timezone })}</span></div>
    {error ? <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100" role="alert">{error}</p> : null}

    <section aria-label="Finance summary" className="grid border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b] sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value], index) => <div className={`p-4 ${index ? 'border-t border-zinc-200 dark:border-white/10 sm:border-l sm:border-t-0' : ''}`} key={label}><p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{amount(value)}</p>{label === 'Operating profit' ? <p className="mt-1 text-xs text-zinc-500">{workspace.summary.profitState}</p> : null}</div>)}
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <ChartPanel title="Actual and forecast"><div className="h-64" aria-hidden="true"><ResponsiveContainer height="100%" width="100%"><LineChart data={series}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" minTickGap={32} tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₱${Math.round(value / 100)}`} /><Tooltip formatter={(value) => amount(Number(value))} /><Line dataKey="actualRevenueCents" dot={false} name="Actual revenue" stroke="#4C1268" strokeWidth={2} /><Line dataKey="forecastRevenueCents" dot={false} name="Base forecast" stroke="#E6007A" strokeDasharray="5 4" /></LineChart></ResponsiveContainer></div><AccessibleSeries rows={series} /></ChartPanel>
      <ChartPanel title="Revenue to operating profit"><div className="h-64" aria-hidden="true"><ResponsiveContainer height="100%" width="100%"><BarChart data={workspace.waterfall}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `₱${Math.round(value / 100)}`} /><Tooltip formatter={(value) => amount(Number(value))} /><Bar dataKey="amountCents" fill="#4C1268" name="Amount" /></BarChart></ResponsiveContainer></div><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">{workspace.waterfall.map((row) => <div className="flex justify-between gap-3" key={row.label}><dt className="text-zinc-500">{row.label}</dt><dd className="tabular-nums">{amount(row.amountCents)}</dd></div>)}</dl></ChartPanel>
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]"><h3 className="font-semibold">Forecast scenarios</h3>{workspace.forecast.state === 'insufficient_history' ? <p className="mt-3 text-sm text-zinc-500">Insufficient history: {workspace.forecast.usableWeeks} of {workspace.forecast.requiredWeeks} complete weeks are usable.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-zinc-200 text-zinc-500 dark:border-white/10"><tr><th className="py-2">Scenario</th><th>Activity</th><th>Revenue</th><th>Variable costs</th><th>Scheduled costs</th><th>Profit</th></tr></thead><tbody>{workspace.forecast.scenarios.map((row) => <tr className="border-b border-zinc-100 dark:border-white/5" key={row.label}><th className="py-2 font-medium capitalize">{row.label}</th><td>{row.activityPercent}%</td><td>{amount(row.revenueCents)}</td><td>{amount(row.variableCostsCents)}</td><td>{amount(row.scheduledRecurringCostsCents)}</td><td>{row.profitCents === null ? 'Suppressed: costs incomplete' : amount(row.profitCents)}</td></tr>)}</tbody></table></div>}</section>
      <section className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]"><h3 className="font-semibold">Revenue breakdown</h3><dl className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-white/5">{workspace.revenueBreakdown.length ? workspace.revenueBreakdown.map((row) => <div className="flex justify-between gap-4 py-2" key={row.label}><dt>{row.label}</dt><dd className="tabular-nums">{amount(row.amountCents)}</dd></div>) : <p className="py-3 text-zinc-500">No recognized revenue yet.</p>}</dl></section>
    </div>

    <div className="grid gap-5 xl:grid-cols-2"><SettlementPanel data={workspace} /><MoneyFlow data={workspace.moneyFlow} /></div>

    <section className="border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="ledger-heading"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 p-4 dark:border-white/10"><div><h3 className="font-semibold" id="ledger-heading">Transaction ledger</h3><p className="mt-1 text-xs text-zinc-500">Append-only journal entries in integer centavos.</p></div><div className="flex flex-wrap gap-2"><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void load(search) }}><label className="sr-only" htmlFor="finance-search">Search ledger</label><input className="h-9 w-48 rounded-md border border-zinc-300 bg-transparent px-3 text-sm dark:border-white/15" id="finance-search" onChange={(event) => setSearch(event.target.value)} placeholder="Order or event" value={search} /><button className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-white/15" type="submit">Search</button></form><a className="inline-flex h-9 items-center rounded-md border border-zinc-300 px-3 text-sm font-medium dark:border-white/15" href={csvUrl}>Export CSV</a></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-white/10"><tr><th className="px-4 py-2">Date</th><th>Event</th><th>Order</th><th>Account</th><th className="text-right">Debit</th><th className="pr-4 text-right">Credit</th></tr></thead><tbody>{ledger?.data.flatMap((journal) => journal.lines.map((line) => <tr className="border-b border-zinc-100 dark:border-white/5" key={line.id}><td className="px-4 py-2 whitespace-nowrap">{new Date(journal.effective_at).toLocaleDateString('en-PH')}</td><td>{journal.event_type.replaceAll('_', ' ')}</td><td>{journal.order?.reference ?? '—'}</td><td>{line.account_code.replaceAll('_', ' ')}</td><td className="text-right tabular-nums">{line.debit_cents ? amount(line.debit_cents) : '—'}</td><td className="pr-4 text-right tabular-nums">{line.credit_cents ? amount(line.credit_cents) : '—'}</td></tr>))}</tbody></table>{!ledger?.data.length ? <p className="p-6 text-center text-sm text-zinc-500">No ledger entries match this view.</p> : null}</div></section>
  </main>
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]"><h3 className="font-semibold">{title}</h3><div className="mt-4">{children}</div></section> }

function AccessibleSeries({ rows }: { rows: { date: string; actualRevenueCents: number | null; actualProfitCents: number | null; forecastRevenueCents: number | null }[] }) { return <details className="mt-2 text-sm"><summary className="cursor-pointer text-zinc-600 dark:text-zinc-300">Chart data</summary><div className="mt-2 max-h-40 overflow-auto"><table className="w-full"><thead><tr><th className="text-left">Date</th><th className="text-right">Actual revenue</th><th className="text-right">Actual profit</th><th className="text-right">Forecast revenue</th></tr></thead><tbody>{rows.map((row) => <tr key={row.date}><td>{row.date}</td><td className="text-right">{row.actualRevenueCents === null ? '—' : amount(row.actualRevenueCents)}</td><td className="text-right">{row.actualProfitCents === null ? '—' : amount(row.actualProfitCents)}</td><td className="text-right">{row.forecastRevenueCents === null ? '—' : amount(row.forecastRevenueCents)}</td></tr>)}</tbody></table></div></details> }

function SettlementPanel({ data }: { data: FinanceWorkspaceData }) { return <section className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]"><h3 className="font-semibold">Remittance and payout schedule</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Submitted COD</dt><dd className="mt-1 font-medium tabular-nums">{amount(data.remittanceAging.submittedCents)}</dd></div><div><dt className="text-zinc-500">Cleared COD</dt><dd className="mt-1 font-medium tabular-nums">{amount(data.remittanceAging.clearedCents)}</dd></div></dl><div className="mt-4 divide-y divide-zinc-100 text-sm dark:divide-white/5">{data.payoutSchedule.length ? data.payoutSchedule.slice(0, 6).map((payout) => <div className="flex items-center justify-between gap-3 py-2" key={payout.id}><span><span className="font-medium">{amount(payout.amountCents)}</span><span className="ml-2 text-zinc-500">{payout.status}</span></span><span className="text-xs text-zinc-500">{payout.isSandbox ? 'Sandbox' : ''}</span></div>) : <p className="py-3 text-zinc-500">No payouts scheduled.</p>}</div></section> }

function MoneyFlow({ data }: { data: FinanceWorkspaceData['moneyFlow'] }) {
  const positions: Record<string, { x: number; y: number }> = { customer: { x: 0, y: 80 }, platform: { x: 220, y: 80 }, seller: { x: 480, y: 0 }, logistics: { x: 480, y: 90 }, commission: { x: 480, y: 180 } }
  const nodes: Node[] = useMemo(() => data.nodes.map((node) => ({ id: node.id, position: positions[node.id] ?? { x: 0, y: 0 }, data: { label: node.label }, draggable: false, style: { borderRadius: 6, border: '1px solid #d4d4d8', padding: 10, fontSize: 12 } })), [data.nodes])
  const edges: Edge[] = useMemo(() => data.edges.map((edge) => ({ ...edge, label: edge.label, animated: false, style: { stroke: '#4C1268' } })), [data.edges])
  return <section className="border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]"><h3 className="font-semibold">Money flow</h3><p className="mt-1 text-xs text-zinc-500">Read-only {data.scope} view. Beneficiary details remain tenant-scoped.</p><div className="mt-3 h-64" aria-label="Customer COD flows to Aisley clearing, then to Seller, Logistics, and platform commission"><ReactFlow edges={edges} elementsSelectable={false} fitView nodes={nodes} nodesConnectable={false} nodesDraggable={false} panOnDrag={false} zoomOnScroll={false}><Background gap={20} size={1} /><Controls showInteractive={false} /></ReactFlow></div></section>
}
