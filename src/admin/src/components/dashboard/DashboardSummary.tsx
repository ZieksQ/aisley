import type { CSSProperties } from 'react'
import { DataChart } from '@aisley/ui/charts'
import { Link } from 'react-router-dom'
import type { DashboardData } from '../../types/dashboard'

export function DashboardSummary({ data }: { data: DashboardData }) {
  const oldest = data.registrations?.action_items[0]?.submitted_at
  const age = oldest ? Math.max(0, Math.floor((Date.parse(data.generated_at) - Date.parse(oldest)) / 86400000)) : null
  const metrics = [
    ...(data.registrations ? [{ label: 'Pending registrations', value: data.registrations.pending.total, detail: 'Applications to review', to: '/registrations?status=pending' }] : []),
    ...(data.support_tickets ? [{ label: 'Open support tickets', value: data.support_tickets.count, detail: 'Open status only', to: '/support-tickets?status=open' }] : []),
    ...(data.seller_compliance ? [{ label: 'Open compliance cases', value: data.seller_compliance.count, detail: 'Open status only', to: '/seller-compliance?status=open' }] : []),
    ...(data.registrations ? [{ label: 'Oldest application', value: age, detail: oldest ? 'Days awaiting review' : 'No pending applications', to: '/registrations?status=pending' }] : []),
  ]
  const chartMetrics = metrics.filter((metric) => metric.label !== 'Oldest application' && metric.value !== null)
  return <>
    <dl className="dashboard-metrics" style={{ '--metric-mobile': Math.min(metrics.length, 2) || 1, '--metric-count': metrics.length || 1 } as CSSProperties}>
      {metrics.map((metric) => (
        <div className="dashboard-metric" key={metric.label}>
          <dt><Link className="portal-link inline-flex min-h-11 items-center" to={metric.to}>{metric.label}</Link></dt>
          <dd>{metric.value === null ? '—' : metric.value.toLocaleString()}</dd>
          <p>{metric.detail}</p>
        </div>
      ))}
    </dl>
    <DataChart title="Work awaiting review" description="Current counts across your authorized queues. Unavailable counts are excluded."
      layout="vertical" height={216} labelWidth={120} series={[{ key: 'count', label: 'Open records' }]}
      data={chartMetrics.map((metric) => ({ label: metric.label.replace('Pending ', '').replace('Open ', ''), count: metric.value }))}
      emptyMessage={chartMetrics.length ? 'No open records in the available queues.' : 'Queue counts are unavailable.'} />
  </>
}
