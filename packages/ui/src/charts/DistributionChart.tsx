'use client'

import { ChartTooltip } from './ChartTooltip'
import { useId } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export type DistributionDatum = { label: string; value: number; color: string }

export function DistributionChart({ title, rows, totalLabel, emptyMessage = 'No records for this view.', variant = 'panel' }: {
  title: string
  rows: DistributionDatum[]
  totalLabel: string
  emptyMessage?: string
  variant?: 'panel' | 'plain'
}) {
  const id = useId()
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return (
    <section className={`portal-chart dashboard-distribution ${variant === 'panel' ? 'portal-panel' : ''}`} aria-labelledby={id}>
      <h3 id={id} className="font-semibold">{title}</h3>
      {total > 0 ? <div className="dashboard-donut">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer>
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius={70} outerRadius={92} paddingAngle={3} stroke="none" isAnimationActive={false}>
              {rows.map((row) => <Cell key={row.label} fill={row.color} />)}
            </Pie>
            <Tooltip position={{ x: 8, y: 8 }} content={(props) => <ChartTooltip {...props} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="dashboard-donut-total" aria-hidden="true"><strong>{total.toLocaleString()}</strong><span>{totalLabel}</span></div>
      </div> : <p className="dashboard-empty-chart portal-secondary">{emptyMessage}</p>}
      <ul className="dashboard-chart-legend">
        {rows.map((row) => <li key={row.label}>
          <span className="dashboard-legend-swatch" style={{ backgroundColor: row.color }} aria-hidden="true" />
          <span>{row.label}</span>
          <strong>{row.value.toLocaleString()}</strong>
          <span className="portal-secondary">{total ? Math.round(row.value / total * 100) : 0}%</span>
        </li>)}
      </ul>
    </section>
  )
}
