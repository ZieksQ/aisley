import { useMemo } from 'react'
import { PortalButton as Button } from '@aisley/ui/portal'
import { DateRangePicker, manilaToday, useReportPeriod } from '@aisley/ui/date-range'
import { FinanceSummaryCards } from './components/FinanceSummaryCards'
import { FinancialBridgeChart, RevenueTrendChart, type RevenueTrendPoint } from './components/FinanceCharts'
import { LedgerPanel, MoneyFlowPanel, RevenueBreakdownPanel, SettlementPanel } from './components/FinancePanels'
import { useFinanceWorkspace } from './useFinanceWorkspace'
import type { FinanceWorkspaceProps } from './types'
import './theme.css'

export function FinanceWorkspace(props: FinanceWorkspaceProps) {
  const { roleLabel, csvUrl, filters } = props
  const { period, query, apply } = useReportPeriod(filters)
  const search = filters.params.get('search') ?? ''
  const page = Math.max(1, Number(filters.params.get('page')) || 1)
  const state = useFinanceWorkspace(props, query, search, page)
  const { workspace, ledger, loading, error } = state
  const showProjection = period.allTime || period.to === manilaToday()
  const trend = useMemo<RevenueTrendPoint[]>(() => {
    if (!workspace) return []
    const recorded: RevenueTrendPoint[] = workspace.series.map((point) => ({
      date: point.date, recordedRevenueCents: point.actualRevenueCents, projectionCents: null, projectionRangeCents: null,
    }))
    if (!showProjection) return recorded
    const projection: RevenueTrendPoint[] = workspace.forecast.series.map((point) => ({
      date: point.date, recordedRevenueCents: null, projectionCents: point.forecastRevenueCents,
      projectionRangeCents: [point.forecastLowRevenueCents, point.forecastHighRevenueCents],
    }))
    const last = recorded.at(-1)
    if (last && projection.length && last.recordedRevenueCents !== null) {
      last.projectionCents = last.recordedRevenueCents
      last.projectionRangeCents = [last.recordedRevenueCents, last.recordedRevenueCents]
    }
    return [...recorded, ...projection]
  }, [workspace, showProjection])

  function updateLedger(next: { search?: string; page?: number }) {
    const updated = new URLSearchParams(filters.params)
    updated.set('search', next.search ?? search)
    updated.set('page', String(next.page ?? 1))
    filters.setParams(updated)
  }
  const csvParams = new URLSearchParams(query)
  csvParams.set('search', search)

  return <main className="finance-workspace finance-overview">
    <header className="finance-page-header">
      <div><h2>Finance</h2><p>{roleLabel} revenue, recorded costs, and settlements in PHP.</p></div>
      <Button onClick={state.reload} disabled={loading}>Refresh</Button>
    </header>
    <DateRangePicker value={period} onApply={apply} />
    {error && <div className="finance-feedback" role="alert"><p>{error}</p><Button onClick={state.reload}>Retry</Button></div>}
    {loading && !workspace && <div className="finance-skeleton" role="status"><span>Loading Finance for this period…</span><div /><div /><div /><div /></div>}
    {workspace && <>
      <div className="finance-report-context"><span>{period.allTime ? 'All-time report' : `${period.from} — ${period.to}`} · Asia/Manila</span><span>Updated {new Date(workspace.generatedAt).toLocaleString('en-PH', { timeZone: workspace.timezone })}{loading ? ' · Refreshing…' : ''}</span></div>
      <FinanceSummaryCards roleLabel={roleLabel} summary={workspace.summary} />
      <section className="finance-chart-grid" aria-label="Period financial charts">
        <RevenueTrendChart forecast={workspace.forecast} rows={trend} showProjection={showProjection} />
        <FinancialBridgeChart rows={workspace.waterfall} />
      </section>
      <section className="finance-operations-grid"><SettlementPanel data={workspace} /><RevenueBreakdownPanel rows={workspace.revenueBreakdown} /></section>
      <LedgerPanel csvUrl={`${csvUrl}?${csvParams}`} ledger={ledger} onSearch={(value) => updateLedger({ search: value })} search={search} page={page} onPage={(value) => updateLedger({ page: value })} />
      <MoneyFlowPanel data={workspace.moneyFlow} />
    </>}
  </main>
}
