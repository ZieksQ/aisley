import type { CSSProperties } from 'react'
import { DataChart, DistributionChart } from '@aisley/ui/charts'
import { DashboardMetricCard } from '@aisley/ui/portal'
import { LuClipboardList, LuClock3, LuMessagesSquare, LuStore } from 'react-icons/lu'
import type { DashboardData } from '../../types/dashboard'

export function DashboardSummary({ data }: { data: DashboardData }) {
  const oldest = data.registrations?.action_items[0]?.submitted_at
  const age = oldest ? Math.max(0, Math.floor((Date.parse(data.generated_at) - Date.parse(oldest)) / 86400000)) : null
  const queueMetrics = [
    ...(data.registrations ? [{ label: 'Pending registrations', value: data.registrations.pending.total, detail: 'Customer, Seller and Logistics applications awaiting approval', icon: LuClipboardList, color: 'var(--chart-violet)' }] : []),
    ...(data.support_tickets ? [{ label: 'Open support tickets', value: data.support_tickets.count, detail: data.support_tickets.state === 'ready' ? 'Waiting in the open queue' : 'Count unavailable', icon: LuMessagesSquare, color: 'var(--chart-blue)' }] : []),
    ...(data.seller_compliance ? [{ label: 'Compliance cases', value: data.seller_compliance.count, detail: data.seller_compliance.state === 'ready' ? 'Open Seller cases' : 'Count unavailable', icon: LuStore, color: 'var(--chart-amber)' }] : []),
  ]
  const chartMetrics = queueMetrics.filter((metric) => metric.value !== null)
  const total = chartMetrics.reduce((sum, metric) => sum + (metric.value ?? 0), 0)
  const metricCards = [
    ...queueMetrics,
    ...(data.registrations ? [{
      label: 'Oldest application',
      value: age,
      detail: oldest ? 'Days awaiting a review' : 'No applications waiting',
      icon: LuClock3,
      color: 'var(--chart-slate)',
    }] : []),
  ]

  return <>
    <div className="dashboard-metric-grid" style={{ '--metric-count': Math.max(1, metricCards.length) } as CSSProperties}>
      {metricCards.map((metric) => <DashboardMetricCard key={metric.label} label={metric.label}
        value={metric.value === null ? '—' : metric.value.toLocaleString()} detail={metric.detail}
        icon={<metric.icon size={19} />} />)}
    </div>
    <div className={data.registrations ? 'dashboard-columns' : 'grid'}>
      <DataChart title="Work awaiting review" description="Current workload by queue" layout="vertical" height={274} labelWidth={112} animate
        summary={<><strong>{total.toLocaleString()}</strong>available records</>}
        series={[{ key: 'count', label: 'Open records' }]}
        data={chartMetrics.map((metric) => ({ label: metric.label.replace('Pending ', '').replace('Open ', ''), count: metric.value, color: metric.color }))}
        caption="Only authorized, available counts are included. Open the owning queue to act."
        emptyMessage={chartMetrics.length ? 'No open records in the available queues.' : 'Queue counts are unavailable.'} />
      {data.registrations && <DistributionChart title="Application mix" totalLabel="applications" animate
        rows={[
          { label: 'Customers', value: data.registrations.pending.by_role.customer, color: 'var(--chart-blue)' },
          { label: 'Sellers', value: data.registrations.pending.by_role.seller, color: 'var(--chart-violet)' },
          { label: 'Logistics', value: data.registrations.pending.by_role.logistics, color: 'var(--chart-teal)' },
        ]} emptyMessage="No pending applications." />}
    </div>
  </>
}
