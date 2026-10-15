'use client'

import { ChartTooltip } from './ChartTooltip'
import { useReducedMotion } from './useReducedMotion'
import { useId } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  useActiveTooltipCoordinate,
  usePlotArea,
} from 'recharts'

export type DistributionDatum = { label: string; value: number; color: string }

function DistributionTooltip() {
  const coordinate = useActiveTooltipCoordinate()
  const plotArea = usePlotArea()
  const centerX = plotArea ? plotArea.x + plotArea.width / 2 : 0
  const centerY = plotArea ? plotArea.y + plotArea.height / 2 : 0
  const horizontalPlacement = coordinate && plotArea && coordinate.x < centerX ? 'left' : 'right'
  const verticalPlacement = coordinate && plotArea && coordinate.y < centerY ? 'top' : 'bottom'
  const placement = `${verticalPlacement}-${horizontalPlacement}`

  return <Tooltip
    position={coordinate}
    wrapperStyle={{ pointerEvents: 'none' }}
    content={(props) => <div className={`dashboard-donut-tooltip dashboard-donut-tooltip--${placement}`}>
      <ChartTooltip {...props} />
    </div>}
  />
}

export function DistributionChart({ title, rows, totalLabel, emptyMessage = 'No records for this view.', variant = 'panel', animate = false }: {
  title: string
  rows: DistributionDatum[]
  totalLabel: string
  emptyMessage?: string
  variant?: 'panel' | 'plain'
  animate?: boolean
}) {
  const id = useId()
  const reducedMotion = useReducedMotion()
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return (
    <section className={`portal-chart dashboard-distribution ${variant === 'panel' ? 'portal-panel' : ''}`} aria-labelledby={id}>
      <h3 id={id} className="font-semibold">{title}</h3>
      {total > 0 ? <div className="dashboard-donut">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart accessibilityLayer>
            <Pie data={rows} dataKey="value" nameKey="label" innerRadius={70} outerRadius={92} paddingAngle={3} stroke="none" isAnimationActive={animate && !reducedMotion} animationDuration={700}>
              {rows.map((row) => <Cell key={row.label} fill={row.color} />)}
            </Pie>
            <DistributionTooltip />
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
