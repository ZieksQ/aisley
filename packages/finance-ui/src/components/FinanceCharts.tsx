import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FinanceWorkspaceData } from '../types'
import { amount, chartDate, compactAmount } from '../formatters'

export type RevenueTrendPoint = {
  date: string
  recordedRevenueCents: number | null
  projectionCents: number | null
  projectionRangeCents: [number, number] | null
}

const gridColor = '#a1a1aa'
const tick = { fill: '#71717a', fontSize: 11 }
const tooltipStyle = { backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#fafafa' }

export function RevenueTrendChart({ rows, forecast }: { rows: RevenueTrendPoint[]; forecast: FinanceWorkspaceData['forecast'] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="revenue-trend-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold" id="revenue-trend-heading">Revenue trend</h3>
          <p className="mt-1 text-xs text-zinc-500">Daily recognized revenue with a 30-day outlook based on eight complete weeks.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300" aria-hidden="true">
          <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-[#4C1268] dark:bg-[#c084fc]" />Recorded</span>
          <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-[#E6007A]" />30-day projection</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-5 bg-[#E6007A]/15" />Low–high range</span>
        </div>
      </div>

      <div className="mt-5 h-72" aria-hidden="true">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart data={rows} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid stroke={gridColor} strokeOpacity={0.18} vertical={false} />
            <XAxis dataKey="date" minTickGap={36} tick={tick} tickFormatter={chartDate} tickLine={false} />
            <YAxis axisLine={false} tick={tick} tickFormatter={compactAmount} tickLine={false} width={58} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTooltipValue(value)} labelFormatter={(label) => chartDate(String(label))} />
            <Area dataKey="projectionRangeCents" fill="#E6007A" fillOpacity={0.1} name="Low–high range" stroke="none" type="monotone" />
            <Line dataKey="recordedRevenueCents" dot={false} name="Recorded revenue" stroke="#4C1268" strokeWidth={2.25} type="monotone" />
            <Line dataKey="projectionCents" dot={false} name="30-day projection" stroke="#E6007A" strokeDasharray="5 4" strokeWidth={2.25} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {forecast.state === 'insufficient_history' ? (
        <p className="mt-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-white/5">
          The projection will appear after {forecast.requiredWeeks} complete weeks. {forecast.usableWeeks} usable {forecast.usableWeeks === 1 ? 'week is' : 'weeks are'} available.
        </p>
      ) : (
        <ProjectionSummary scenarios={forecast.scenarios} profitSuppressed={forecast.profitSuppressed} />
      )}

      <AccessibleTrendTable rows={rows} />
    </section>
  )
}

export function FinancialBridgeChart({ rows }: { rows: FinanceWorkspaceData['waterfall'] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#18181b]" aria-labelledby="financial-bridge-heading">
      <h3 className="font-semibold" id="financial-bridge-heading">Revenue and costs</h3>
      <p className="mt-1 text-xs text-zinc-500">How recorded costs affect operating profit.</p>
      <div className="mt-5 h-56" aria-hidden="true">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={rows} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid stroke={gridColor} strokeOpacity={0.18} vertical={false} />
            <XAxis dataKey="label" tick={tick} tickLine={false} />
            <YAxis axisLine={false} tick={tick} tickFormatter={compactAmount} tickLine={false} width={58} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => amount(Number(value))} />
            <Bar dataKey="amountCents" fill="#4C1268" name="Amount" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100 text-sm dark:divide-white/5 dark:border-white/5">
        {rows.map((row) => (
          <div className="flex justify-between gap-3 py-2" key={row.label}>
            <dt className="text-zinc-500">{row.label}</dt>
            <dd className="font-medium tabular-nums">{amount(row.amountCents)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ProjectionSummary({ scenarios, profitSuppressed }: { scenarios: FinanceWorkspaceData['forecast']['scenarios']; profitSuppressed: boolean }) {
  return (
    <div className="mt-2 grid border-t border-zinc-100 pt-3 text-sm dark:border-white/5 sm:grid-cols-3">
      {scenarios.map((scenario, index) => (
        <div className={index ? 'mt-3 border-t border-zinc-100 pt-3 dark:border-white/5 sm:mt-0 sm:border-l sm:border-t-0 sm:px-3 sm:pt-0' : 'sm:pr-3'} key={scenario.label}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium capitalize">{scenario.label} case</p>
            <p className="text-xs text-zinc-500">{scenario.activityPercent}% activity</p>
          </div>
          <p className="mt-1 font-semibold tabular-nums">{amount(scenario.revenueCents)}</p>
          <p className="text-xs text-zinc-500">30-day revenue</p>
        </div>
      ))}
      {profitSuppressed ? <p className="mt-3 text-xs text-zinc-500 sm:col-span-3">Profit projection is unavailable until cost coverage is complete.</p> : null}
    </div>
  )
}

function AccessibleTrendTable({ rows }: { rows: RevenueTrendPoint[] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-300">View chart data</summary>
      <div className="mt-2 max-h-48 overflow-auto border-t border-zinc-100 dark:border-white/5">
        <table className="w-full min-w-[560px]">
          <thead><tr><th className="py-2 text-left">Date</th><th className="text-right">Recorded revenue</th><th className="text-right">30-day projection</th><th className="text-right">Low–high range</th></tr></thead>
          <tbody>{rows.map((row) => <TrendRow key={row.date} row={row} />)}</tbody>
        </table>
      </div>
    </details>
  )
}

function TrendRow({ row }: { row: RevenueTrendPoint }) {
  return (
    <tr className="border-t border-zinc-100 dark:border-white/5">
      <td className="py-2">{row.date}</td>
      <td className="text-right">{row.recordedRevenueCents === null ? '—' : amount(row.recordedRevenueCents)}</td>
      <td className="text-right">{row.projectionCents === null ? '—' : amount(row.projectionCents)}</td>
      <td className="text-right">{row.projectionRangeCents === null ? '—' : `${amount(row.projectionRangeCents[0])}–${amount(row.projectionRangeCents[1])}`}</td>
    </tr>
  )
}

function formatTooltipValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => amount(Number(item))).join(' – ')
  return amount(Number(value))
}
