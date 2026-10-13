'use client'

import { useId, type CSSProperties } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type ChartDatum = { label: string; [key: string]: string | number | null }
export type ChartSeries = {
  key: string
  label: string
  color?: string
  kind?: 'bar' | 'line' | 'area'
  dash?: string
}
export type DataChartProps = {
  title: string
  description?: string
  data: ChartDatum[] | null
  series: ChartSeries[]
  layout?: 'horizontal' | 'vertical'
  height?: number
  labelWidth?: number
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  className?: string
  style?: CSSProperties
  variant?: 'panel' | 'plain'
  showGrid?: boolean
  showLegend?: boolean
  curve?: 'linear' | 'monotone'
  barRadius?: number
  strokeWidth?: number
  fillOpacity?: number
  formatValue?: (value: number) => string
}

const defaultFormatter = (value: number) => new Intl.NumberFormat().format(value)
const tick = { fill: 'var(--portal-muted, #4b5563)', fontSize: 11 }
const tooltipStyle = {
  background: 'var(--portal-surface, #fff)',
  color: 'var(--portal-text, #231429)',
  border: '1px solid var(--portal-border, #e5e7eb)',
  borderRadius: 8,
}

/** Shared chart presentation. Consumers own queries, permissions, and aggregation. */
export function DataChart({
  title,
  description,
  data,
  series,
  layout = 'horizontal',
  height = 240,
  labelWidth = 110,
  loading = false,
  error,
  emptyMessage = 'No recorded data for this view.',
  className = '',
  style,
  variant = 'panel',
  showGrid = true,
  showLegend = false,
  curve = 'monotone',
  barRadius = 4,
  strokeWidth = 2,
  fillOpacity = .12,
  formatValue = defaultFormatter,
}: DataChartProps) {
  const id = useId()
  const hasValues = data?.some((row) => series.some((item) => typeof row[item.key] === 'number'))
  const nonZero = data?.some((row) => series.some((item) => typeof row[item.key] === 'number' && row[item.key] !== 0))
  const vertical = layout === 'vertical'
  return (
    <section aria-labelledby={id} aria-busy={loading} className={`portal-chart ${variant === 'panel' ? 'portal-panel' : ''} ${className}`} style={style}>
      <h3 className="font-semibold" id={id}>{title}</h3>
      {description && <p className="portal-secondary mt-1 text-sm leading-6">{description}</p>}
      {loading && <p className="portal-secondary mt-3 text-sm" role="status">Refreshing chart…</p>}
      {error && <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
      {!hasValues ? <p className="portal-secondary mt-6 text-sm" role="status">{loading ? 'Loading chart data…' : emptyMessage}</p> : <>
        {!nonZero && <p className="portal-secondary mt-3 text-sm">{emptyMessage}</p>}
        {nonZero && <div className="mt-4 min-w-0" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart accessibilityLayer data={data ?? []} layout={layout} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              {showGrid && <CartesianGrid stroke="var(--portal-border, #e5e7eb)" horizontal={!vertical} vertical={vertical} strokeDasharray="3 5" />}
              <XAxis
                type={vertical ? 'number' : 'category'}
                dataKey={vertical ? undefined : 'label'}
                axisLine={false}
                tickLine={false}
                tick={tick}
                tickFormatter={vertical ? formatValue : undefined}
                allowDecimals={false}
                minTickGap={20}
              />
              <YAxis
                type={vertical ? 'category' : 'number'}
                dataKey={vertical ? 'label' : undefined}
                axisLine={false}
                tickLine={false}
                tick={tick}
                tickFormatter={vertical ? undefined : formatValue}
                width={vertical ? labelWidth : 52}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--portal-text, #231429)' }} cursor={{ fill: 'var(--portal-subtle, #f3f4f6)', fillOpacity: .5 }} formatter={(value) => typeof value === 'number' ? formatValue(value) : 'Unavailable'} />
              {showLegend && <Legend />}
              {series.map((item) => {
                const color = item.color ?? 'var(--portal-accent, #4c1268)'
                const common = { dataKey: item.key, name: item.label, isAnimationActive: false }
                if (item.kind === 'line') return <Line {...common} key={item.key} stroke={color} strokeWidth={strokeWidth} strokeDasharray={item.dash} type={curve} dot={false} connectNulls={false} />
                if (item.kind === 'area') return <Area {...common} key={item.key} stroke={color} fill={color} fillOpacity={fillOpacity} strokeWidth={strokeWidth} type={curve} connectNulls={false} />
                return <Bar {...common} key={item.key} fill={color} maxBarSize={28} radius={vertical ? [0, barRadius, barRadius, 0] : [barRadius, barRadius, 0, 0]} />
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>}
        <details className="mt-4 text-sm">
          <summary className="portal-secondary flex min-h-11 cursor-pointer items-center">View chart data<span className="sr-only"> for {title}</span></summary>
          <div className="mt-2 overflow-x-auto" role="region" aria-label={`${title} data`} tabIndex={0}>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <th className="py-2 font-medium" scope="col">Category</th>
                  {series.map((item) => (
                    <th className="px-3 py-2 text-right font-medium" scope="col" key={item.key}>{item.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.map((row, index) => (
                  <tr className="border-t border-[var(--portal-border,#e5e7eb)]" key={`${row.label}:${index}`}>
                    <th className="py-2 font-normal" scope="row">{row.label}</th>
                    {series.map((item) => (
                      <td className="px-3 py-2 text-right tabular-nums" key={item.key}>
                        {typeof row[item.key] === 'number' ? formatValue(row[item.key] as number) : 'Unavailable'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </>}
    </section>
  )
}
