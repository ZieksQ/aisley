import type { CSSProperties } from 'react'
import { DataChart, DistributionChart } from '@aisley/ui/charts'
import { DashboardMetricCard } from '@aisley/ui/portal'
import { LuArrowUpRight, LuClipboardList, LuMessagesSquare, LuStore, LuClock3 } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import type { DashboardData } from '../../types/dashboard'

export function DashboardSummary({ data }: { data: DashboardData }) {
  const oldest = data.registrations?.action_items[0]?.submitted_at
  const age = oldest ? Math.max(0, Math.floor((Date.parse(data.generated_at) - Date.parse(oldest)) / 86400000)) : null
  const metrics = [
    ...(data.registrations ? [{ label: 'Pending registrations', value: data.registrations.pending.total, detail: 'Customer, Seller and Logistics', to: '/registrations?status=pending', icon: LuClipboardList, color: 'var(--chart-violet)' }] : []),
    ...(data.support_tickets ? [{ label: 'Open support tickets', value: data.support_tickets.count, detail: 'Waiting in the open queue', to: '/support-tickets?status=open', icon: LuMessagesSquare, color: 'var(--chart-blue)' }] : []),
    ...(data.seller_compliance ? [{ label: 'Compliance cases', value: data.seller_compliance.count, detail: 'Open Seller cases', to: '/seller-compliance?status=open', icon: LuStore, color: 'var(--chart-amber)' }] : []),
    ...(data.registrations ? [{ label: 'Oldest application', value: age, detail: oldest ? 'Days awaiting a review' : 'No applications waiting', to: '/registrations?status=pending', icon: LuClock3, color: 'var(--chart-slate)' }] : []),
  ]
  const chartMetrics = metrics.filter((metric) => metric.label !== 'Oldest application' && metric.value !== null)
  const total = chartMetrics.reduce((sum, metric) => sum + (metric.value ?? 0), 0)
  return <>
    <div className="dashboard-metric-grid" style={{ '--metric-mobile': Math.min(metrics.length, 2) || 1, '--metric-count': metrics.length || 1 } as CSSProperties}>
      {metrics.map((metric, index) => <DashboardMetricCard key={metric.label} label={metric.label}
        value={metric.value === null ? '—' : metric.value.toLocaleString()} detail={metric.detail}
        icon={<metric.icon size={18} />} emphasis={index === 0}
        action={<Link className="dashboard-card-action" to={metric.to} aria-label={`Open ${metric.label.toLowerCase()}`}><LuArrowUpRight size={17} aria-hidden="true" /></Link>}
        footer={metric.label === 'Oldest application'
          ? <p>{oldest ? `Submitted ${new Date(oldest).toLocaleDateString()}` : 'The registration queue is clear'}</p>
          : metric.value === null ? <p>Count unavailable</p> : <>
            <p>{total ? `${Math.round(metric.value / total * 100)}% of available queue work` : 'No records awaiting review'}</p>
            <div className="dashboard-meter" aria-hidden="true"><span style={{ width: `${total ? metric.value / total * 100 : 0}%`, background: metric.color }} /></div>
          </>}
      />)}
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
