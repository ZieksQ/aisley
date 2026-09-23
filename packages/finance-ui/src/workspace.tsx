import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@aisley/ui'
import { FinanceSummaryCards } from './components/FinanceSummaryCards'
import { FinancialBridgeChart, RevenueTrendChart, type RevenueTrendPoint } from './components/FinanceCharts'
import { LedgerPanel, MoneyFlowPanel, RevenueBreakdownPanel, SettlementPanel } from './components/FinancePanels'
import type { FinanceWorkspaceData, FinanceWorkspaceProps, LedgerPage } from './types'

export function FinanceWorkspace({ roleLabel, endpointPrefix, csvUrl, request }: FinanceWorkspaceProps) {
  const [workspace, setWorkspace] = useState<FinanceWorkspaceData | null>(null)
  const [ledger, setLedger] = useState<LedgerPage | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (query = '') => {
    setLoading(true)
    setError('')

    try {
      const [summary, entries] = await Promise.all([
        request<{ data: FinanceWorkspaceData }>(`${endpointPrefix}/summary`),
        request<LedgerPage>(`${endpointPrefix}/ledger?per_page=25&search=${encodeURIComponent(query)}`),
      ])
      setWorkspace(summary.data)
      setLedger(entries)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Finance data is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [endpointPrefix, request])

  useEffect(() => {
    void load()
  }, [load])

  const trend = useMemo<RevenueTrendPoint[]>(() => {
    if (!workspace) return []

    const recorded: RevenueTrendPoint[] = workspace.series.map((point) => ({
      date: point.date,
      recordedRevenueCents: point.actualRevenueCents,
      projectionCents: null,
      projectionRangeCents: null,
    }))
    const lastRecorded = recorded.at(-1)
    const projection = workspace.forecast.series.map((point) => ({
      date: point.date,
      recordedRevenueCents: null,
      projectionCents: point.forecastRevenueCents,
      projectionRangeCents: [
        point.forecastLowRevenueCents,
        point.forecastHighRevenueCents,
      ] as [number, number],
    }))

    if (lastRecorded && lastRecorded.recordedRevenueCents !== null && projection.length) {
      const latestRevenue = lastRecorded.recordedRevenueCents
      lastRecorded.projectionCents = latestRevenue
      lastRecorded.projectionRangeCents = [latestRevenue, latestRevenue]
    }

    return [...recorded, ...projection]
  }, [workspace])

  if (loading && !workspace) {
    return <main className="p-4 sm:p-6 lg:p-8"><p className="text-sm text-zinc-500" role="status">Loading finance workspace…</p></main>
  }

  if (error && !workspace) {
    return (
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200" role="alert">
          {error}
          <Button className="ml-3 min-h-9 rounded-md px-3 shadow-none" onClick={() => void load()} variant="outline">Retry</Button>
        </div>
      </main>
    )
  }

  if (!workspace) return null

  return (
    <main className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
        <div>
          <h2 className="text-xl font-semibold">Finance</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{roleLabel} revenue, costs, settlements, and 30-day outlook in PHP.</p>
        </div>
        <p className="text-xs text-zinc-500">Updated {new Date(workspace.generatedAt).toLocaleString('en-PH', { timeZone: workspace.timezone })}</p>
      </header>

      {error ? <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100" role="alert">{error}</p> : null}

      <FinanceSummaryCards roleLabel={roleLabel} summary={workspace.summary} />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]" aria-label="Finance charts">
        <RevenueTrendChart forecast={workspace.forecast} rows={trend} />
        <FinancialBridgeChart rows={workspace.waterfall} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <SettlementPanel data={workspace} />
        <RevenueBreakdownPanel rows={workspace.revenueBreakdown} />
      </section>

      <MoneyFlowPanel data={workspace.moneyFlow} />
      <LedgerPanel csvUrl={csvUrl} ledger={ledger} onSearch={load} search={search} setSearch={setSearch} />
    </main>
  )
}
