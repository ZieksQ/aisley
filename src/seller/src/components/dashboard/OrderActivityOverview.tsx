import { DataChart, DistributionChart } from '@aisley/ui/charts'
import { DashboardMetricCard } from '@aisley/ui/portal'
import { LuArrowUpRight, LuClipboardCheck, LuPackageCheck, LuPackageOpen, LuTruck } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import type { OrderActivity, UnavailableSection } from '../../types/dashboard'

export function OrderActivityOverview({ activity }: { activity?: OrderActivity | UnavailableSection }) {
  if (!activity || activity.state === 'unavailable') {
    return <section className="portal-panel"><h3 className="font-semibold">Order activity</h3><p className="portal-secondary mt-2 text-sm">Order activity is unavailable.</p><Link className="portal-link inline-flex min-h-11 items-center text-sm" to="/orders/monitoring">Open order monitoring</Link></section>
  }
  const total = Object.values(activity.by_status).reduce((sum, count) => sum + count, 0)
  const placed = activity.daily_placed.reduce((sum, day) => sum + day.count, 0)
  const metrics = [
    { label: 'Awaiting approval', value: activity.metrics.awaiting_approval, to: '/orders/approval', detail: 'New orders to review', icon: LuClipboardCheck, color: 'var(--chart-violet)' },
    { label: 'In preparation', value: activity.metrics.processing, to: '/orders/pickup', detail: 'Orders being prepared', icon: LuPackageOpen, color: 'var(--chart-blue)' },
    { label: 'Ready for pickup', value: activity.metrics.ready_for_pickup, to: '/orders/pickup', detail: 'Waiting for collection', icon: LuTruck, color: 'var(--chart-amber)' },
    { label: 'Delivered', value: activity.metrics.delivered, to: '/orders/monitoring', detail: 'Completed · all time', icon: LuPackageCheck, color: 'var(--chart-teal)' },
  ]
  const work = metrics.slice(0, 3)
  return <div className="space-y-6">
    <div className="dashboard-metric-grid">
      {metrics.map((metric, index) => <DashboardMetricCard key={metric.label} label={metric.label} value={metric.value.toLocaleString()}
        icon={<metric.icon size={18} />} detail={metric.detail} emphasis={index === 0}
        action={<Link className="dashboard-card-action" to={metric.to} aria-label={`Open ${metric.label.toLowerCase()} orders`}><LuArrowUpRight size={17} aria-hidden="true" /></Link>}
        footer={<><p>{total ? `${Math.round(metric.value / total * 100)}% of all Shop orders` : 'No Shop orders yet'}</p><div className="dashboard-meter" aria-hidden="true"><span style={{ width: `${total ? metric.value / total * 100 : 0}%`, background: metric.color }} /></div></>}
      />)}
    </div>
    <div className="dashboard-columns">
      <DataChart title="Order activity" description="Orders placed over the last 14 days" height={280}
        summary={<><strong>{placed.toLocaleString()}</strong>orders placed</>}
        data={activity.daily_placed.map((day) => ({ label: day.date.slice(5), count: day.count }))}
        series={[{ key: 'count', label: 'Orders placed', kind: 'area', color: 'var(--chart-blue)' }]}
        strokeWidth={2.5} fillOpacity={.1} curve="linear"
        caption={`${activity.from} – ${activity.to} · UTC. Includes subsequently cancelled or rejected orders.`}
        emptyMessage="No orders placed in the last 14 days." />
      <DistributionChart title="Fulfillment workload" totalLabel="before handoff"
        rows={work.map((metric) => ({ label: metric.label, value: metric.value, color: metric.color }))}
        emptyMessage="No orders awaiting approval, preparation or pickup." />
    </div>
  </div>
}
