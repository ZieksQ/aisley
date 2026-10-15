/** Mirrors the metric cards and chart/work queue layout without replacing navigation. */
export function DashboardSkeleton({ className = '', metricCount = 4 }: { className?: string; metricCount?: number }) {
  return <div className={`dashboard-skeleton ${className}`} role="status" aria-label="Loading dashboard">
    <span className="sr-only">Loading dashboard</span>
    <div className="dashboard-metric-grid" aria-hidden="true">
      {Array.from({ length: metricCount }, (_, index) => (
        <div className="dashboard-stat-card" key={index}>
          <div className="dashboard-stat-header">
            <span className="dashboard-skeleton-icon skeleton-block" />
            <div className="dashboard-stat-label dashboard-skeleton-stat-label skeleton-block" />
          </div>
          <div className="skeleton-block skeleton-value" />
          <div className="skeleton-block skeleton-detail" />
        </div>
      ))}
    </div>
    <div className="dashboard-columns" aria-hidden="true">
      {[0, 1].map((index) => (
        <div className="portal-panel" key={index}>
          <div className="skeleton-block skeleton-label" />
          <div className="skeleton-block skeleton-chart" />
          <div className="skeleton-block skeleton-label" />
        </div>
      ))}
    </div>
  </div>
}
