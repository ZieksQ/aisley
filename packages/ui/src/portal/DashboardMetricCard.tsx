import type { ReactNode } from 'react'

export type DashboardMetricCardProps = {
  label: string
  value: ReactNode
  icon: ReactNode
  detail: string
  footer?: ReactNode
  action?: ReactNode
  emphasis?: boolean
}

/** Presentation only: each role supplies permitted metrics and navigation. */
export function DashboardMetricCard({ label, value, icon, detail, footer, action, emphasis = false }: DashboardMetricCardProps) {
  return (
    <article className={`dashboard-stat-card ${emphasis ? 'is-emphasized' : ''}`}>
      <div className="dashboard-stat-header">
        <span className="dashboard-stat-icon" aria-hidden="true">{icon}</span>
        <h3>{label}</h3>
        {action}
      </div>
      <p className="dashboard-stat-value">{value}</p>
      <p className="dashboard-stat-detail">{detail}</p>
      {footer && <div className="dashboard-stat-footer">{footer}</div>}
    </article>
  )
}
