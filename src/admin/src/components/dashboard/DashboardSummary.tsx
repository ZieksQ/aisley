import type { CSSProperties } from 'react'
import { DataChart, DistributionChart } from '@aisley/ui/charts'
import { DashboardMetricCard } from '@aisley/ui/portal'
import { Link } from 'react-router-dom'
import type { DashboardData } from '../../types/dashboard'

export function DashboardSummary({ data }: { data: DashboardData }) {
  const oldest = data.registrations?.action_items[0]?.submitted_at
  const age = oldest ? Math.max(0, Math.floor((Date.parse(data.generated_at) - Date.parse(oldest)) / 86400000)) : null
  const queueMetrics = [
    ...(data.registrations ? [{ label: 'Pending registrations', value: data.registrations.pending.total, detail: 'Customer, Seller and Logistics applications awaiting approval', to: '/registrations?status=pending', link: 'Review applications', color: 'var(--chart-violet)' }] : []),
    ...(data.support_tickets ? [{ label: 'Open support tickets', value: data.support_tickets.count, detail: data.support_tickets.state === 'ready' ? 'Waiting in the open queue' : 'Count unavailable', to: '/support-tickets?status=open', link: 'Open support queue', color: 'var(--chart-blue)' }] : []),
    ...(data.seller_compliance ? [{ label: 'Compliance cases', value: data.seller_compliance.count, detail: data.seller_compliance.state === 'ready' ? 'Open Seller cases' : 'Count unavailable', to: '/seller-compliance?status=open', link: 'Open compliance queue', color: 'var(--chart-amber)' }] : []),
  ]
  const chartMetrics = queueMetrics.filter((metric) => metric.value !== null)
  const queuePoints = chartMetrics.map((metric) => ({ label: metric.label, value: metric.value as number, color: metric.color }))
  const total = chartMetrics.reduce((sum, metric) => sum + (metric.value ?? 0), 0)
  const agePoints = data.registrations?.action_items.map((application, index) => ({
    label: `Application ${index + 1}`,
    value: Math.max(0, Math.floor((Date.parse(data.generated_at) - Date.parse(application.submitted_at)) / 86400000)),
    color: 'var(--chart-slate)',
  })) ?? []
  const metricCards = [
    ...queueMetrics.map((metric) => ({
      ...metric,
      chart: metric.value === null ? undefined : {
        label: 'Current authorized queue counts',
        points: queuePoints,
        activeIndex: chartMetrics.findIndex((item) => item.label === metric.label),
      },
    })),
    ...(data.registrations ? [{
      label: 'Oldest application',
      value: age,
      detail: oldest ? 'Days awaiting a review' : 'No applications waiting',
      to: '/registrations?status=pending',
      link: 'Review pending applications',
      color: 'var(--chart-slate)',
      chart: { label: 'Current ages in the oldest-first application queue', unit: 'days', kind: 'line' as const, placement: 'underlay' as const, points: agePoints, activeIndex: 0 },
    }] : []),
  ]

  return <>
    <div className="dashboard-metric-grid" style={{ '--metric-count': Math.max(1, metricCards.length) } as CSSProperties}>
      {metricCards.map((metric) => <DashboardMetricCard key={metric.label} label={metric.label}
        value={metric.value === null ? '—' : metric.value.toLocaleString()} detail={metric.detail}
        chart={metric.chart}
        action={<Link className="dashboard-card-link" to={metric.to}>{metric.link}</Link>} />)}
    </div>
    <div className={data.registrations ? 'dashboard-columns' : 'grid'}>
      <DataChart title="Work awaiting review" description="Current workload by queue" layout="vertical" height={274} labelWidth={112}
        summary={<><strong>{total.toLocaleString()}</strong>available records</>}
        series={[{ key: 'count', label: 'Open records' }]}
        data={chartMetrics.map((metric) => ({ label: metric.label.replace('Pending ', '').replace('Open ', ''), count: metric.value, color: metric.color }))}
        caption="Only authorized, available counts are included. Open the owning queue to act."
        emptyMessage={chartMetrics.length ? 'No open records in the available queues.' : 'Queue counts are unavailable.'} />
      {data.registrations && <DistributionChart title="Application mix" totalLabel="applications"
        rows={[
          { label: 'Customers', value: data.registrations.pending.by_role.customer, color: 'var(--chart-blue)' },
          { label: 'Sellers', value: data.registrations.pending.by_role.seller, color: 'var(--chart-violet)' },
          { label: 'Logistics', value: data.registrations.pending.by_role.logistics, color: 'var(--chart-teal)' },
        ]} emptyMessage="No pending applications." />}
    </div>
  </>
}
