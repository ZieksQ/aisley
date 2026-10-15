import type { ReactNode } from 'react'

export type DashboardMetricChart = {
  label: string
  unit?: string
  points: Array<{ label: string; value: number; color: string }>
  activeIndex?: number
}

export type DashboardMetricCardProps = {
  label: string
  value: ReactNode
  detail: string
  chart?: DashboardMetricChart
  action?: ReactNode
}

function MiniBarChart({ chart }: { chart?: DashboardMetricChart }) {
  if (!chart) return <div className="dashboard-mini-chart-empty" aria-hidden="true" />

  const max = Math.max(0, ...chart.points.map((point) => point.value))
  const description = chart.points.length
    ? `${chart.label}: ${chart.points.map((point) => `${point.label}, ${point.value.toLocaleString()}${chart.unit ? ` ${chart.unit}` : ''}`).join('; ')}`
    : `${chart.label}: no data available`

  return <div className="dashboard-mini-chart" role="img" aria-label={description}>
    {chart.points.map((point, index) => {
      const height = point.value <= 0 || max === 0 ? 0 : Math.max(8, point.value / max * 100)
      const isActive = chart.activeIndex === undefined || chart.activeIndex === index
      return <span
        className="dashboard-mini-chart-bar"
        key={`${point.label}-${index}`}
        style={{
          height: `${height}%`,
          backgroundColor: point.color,
          opacity: isActive ? 1 : .36,
          animationDelay: `${index * 35}ms`,
        }}
      />
    })}
  </div>
}

/** Presentation only: each role supplies permitted metrics and navigation. */
export function DashboardMetricCard({ label, value, detail, chart, action }: DashboardMetricCardProps) {
  return <article className="dashboard-stat-card">
    <div className="dashboard-stat-copy">
      <h3 className="dashboard-stat-label">{label}</h3>
      <p className="dashboard-stat-value">{value}</p>
      <p className="dashboard-stat-detail">{detail}</p>
      {action && <div className="dashboard-stat-action">{action}</div>}
    </div>
    <MiniBarChart chart={chart} key={chart?.points.map((point) => point.value).join(':') ?? 'empty'} />
  </article>
}
