import type { ReactNode } from 'react'

export type DashboardMetricChart = {
  label: string
  unit?: string
  kind?: 'bar' | 'line' | 'area'
  placement?: 'side' | 'underlay'
  points: Array<{ label: string; value: number; color: string }>
  activeIndex?: number
}

export type DashboardMetricChange = {
  text: string
  tone: 'positive' | 'negative' | 'neutral'
}

export type DashboardMetricCardProps = {
  label: string
  value: ReactNode
  detail: string
  chart?: DashboardMetricChart
  change?: DashboardMetricChange
  action?: ReactNode
}

function describeChart(chart: DashboardMetricChart) {
  return chart.points.length
    ? `${chart.label}: ${chart.points.map((point) => `${point.label}, ${point.value.toLocaleString()}${chart.unit ? ` ${chart.unit}` : ''}`).join('; ')}`
    : `${chart.label}: no data available`
}

function MiniBarChart({ chart }: { chart: DashboardMetricChart }) {
  const max = Math.max(0, ...chart.points.map((point) => point.value))

  return <div className="dashboard-mini-chart dashboard-mini-chart--side" role="img" aria-label={describeChart(chart)}>
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

function MiniPathChart({ chart, decorative = false }: { chart: DashboardMetricChart; decorative?: boolean }) {
  const max = Math.max(0, ...chart.points.map((point) => point.value))
  const coordinates = chart.points.map((point, index) => ({
    x: chart.points.length < 2 ? 60 : 4 + index / (chart.points.length - 1) * 112,
    y: max === 0 ? 44 : 44 - Math.max(0, point.value) / max * 36,
  }))
  const linePath = coordinates.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const areaPath = coordinates.length
    ? `${linePath} L${coordinates[coordinates.length - 1].x},44 L${coordinates[0].x},44 Z`
    : ''
  const color = chart.points[0]?.color ?? 'currentColor'

  return <svg
    className={`dashboard-mini-chart-svg dashboard-mini-chart-svg--${chart.placement ?? 'side'}`}
    viewBox="0 0 120 48"
    preserveAspectRatio="none"
    role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : describeChart(chart)}
    aria-hidden={decorative || undefined}
    focusable="false"
  >
    {chart.kind === 'area' && areaPath && <path className="dashboard-mini-chart-area" d={areaPath} pathLength="1" fill={color} />}
    {linePath && <path className="dashboard-mini-chart-line" d={linePath} pathLength="1" fill="none" stroke={color} strokeWidth="2.2" />}
    {coordinates.map(({ x, y }, index) => <circle
      key={`${chart.points[index].label}-${index}`}
      cx={x}
      cy={y}
      r="1.5"
      fill={chart.points[index].color}
    />)}
  </svg>
}

/** Presentation only: each role supplies permitted metrics and navigation. */
export function DashboardMetricCard({ label, value, detail, chart, change, action }: DashboardMetricCardProps) {
  const kind = chart?.kind ?? 'bar'
  const placement = chart?.placement ?? 'side'
  const chartMax = Math.max(0, ...(chart?.points.map((point) => point.value) ?? []))
  const cardClassName = [
    'dashboard-stat-card',
    `dashboard-stat-card--${placement}`,
    change && 'dashboard-stat-card--with-change',
  ].filter(Boolean).join(' ')

  return <article className={cardClassName}>
    {chart && placement === 'underlay' && <div className="dashboard-mini-chart-underlay" role="img" aria-label={describeChart(chart)}>
      {kind === 'bar'
        ? <div className="dashboard-mini-chart dashboard-mini-chart--underlay" aria-hidden="true">
          {chart.points.map((point, index) => {
            const height = point.value <= 0 || chartMax === 0 ? 0 : Math.max(8, point.value / chartMax * 100)
            return <span
              className="dashboard-mini-chart-bar"
              key={`${point.label}-${index}`}
              style={{ height: `${height}%`, backgroundColor: point.color, animationDelay: `${index * 35}ms` }}
            />
          })}
        </div>
        : <MiniPathChart chart={chart} decorative />}
    </div>}
    {change && <p className={`dashboard-stat-change dashboard-stat-change--${change.tone}`}>{change.text}</p>}
    <div className={`dashboard-stat-copy${change ? ' dashboard-stat-copy--with-change' : ''}`}>
      <h3 className="dashboard-stat-label">{label}</h3>
      <p className="dashboard-stat-value">{value}</p>
      <p className="dashboard-stat-detail">{detail}</p>
      {action && <div className="dashboard-stat-action">{action}</div>}
    </div>
    {chart && placement === 'side' && (kind === 'bar'
      ? <MiniBarChart chart={chart} key={chart.points.map((point) => point.value).join(':')} />
      : <MiniPathChart chart={chart} key={chart.points.map((point) => point.value).join(':')} />)}
    {!chart && <div className="dashboard-mini-chart-empty" aria-hidden="true" />}
  </article>
}
