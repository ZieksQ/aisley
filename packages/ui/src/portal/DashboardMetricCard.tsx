import type { ReactNode } from 'react'

export type DashboardMetricCardProps = {
  label: string
  value: ReactNode
  icon: ReactNode
  detail: string
}

/** Presentation only: each role supplies permitted metrics and icons. */
export function DashboardMetricCard({ label, value, icon, detail }: DashboardMetricCardProps) {
  return <article className="dashboard-stat-card">
    <div className="dashboard-stat-header">
      <span className="dashboard-stat-icon" aria-hidden="true">{icon}</span>
      <h3 className="dashboard-stat-label">{label}</h3>
    </div>
    <p className="dashboard-stat-value">{value}</p>
    <p className="dashboard-stat-detail">{detail}</p>
  </article>
}
