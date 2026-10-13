import { DataChart } from '@aisley/ui/charts'
import { Link } from 'react-router-dom'
import type { OrderActivity, UnavailableSection } from '../../types/dashboard'

export function OrderActivityOverview({ activity }: { activity?: OrderActivity | UnavailableSection }) {
  if (!activity || activity.state === 'unavailable') {
    return <section className="portal-panel mt-6">
      <h3 className="font-semibold">Order activity</h3>
      <p className="portal-secondary mt-2 text-sm">Order activity is unavailable.</p>
      <Link className="portal-link inline-flex min-h-11 items-center text-sm" to="/orders/monitoring">Open order monitoring</Link>
    </section>
  }
  const metrics = [
    ['Awaiting approval', activity.metrics.awaiting_approval, '/orders/approval', 'Current orders'],
    ['In preparation', activity.metrics.processing, '/orders/pickup', 'Current orders'],
    ['Ready for pickup', activity.metrics.ready_for_pickup, '/orders/pickup', 'Current orders'],
    ['Delivered', activity.metrics.delivered, '/orders/monitoring', 'All-time orders'],
  ] as const
  return <div className="mt-6 space-y-6">
    <dl className="dashboard-metrics">
      {metrics.map(([label, value, to, detail]) => (
        <div className="dashboard-metric" key={label}>
          <dt><Link className="portal-link inline-flex min-h-11 items-center" to={to}>{label}</Link></dt>
          <dd>{value.toLocaleString()}</dd>
          <p>{detail}</p>
        </div>
      ))}
    </dl>
    <div className="dashboard-columns">
      <DataChart title="Orders placed" description={`${activity.from} – ${activity.to} · UTC · includes subsequently cancelled or rejected orders`}
        data={activity.daily_placed.map((day) => ({ label: day.date.slice(5), count: day.count }))}
        series={[{ key: 'count', label: 'Orders placed', kind: 'area' }]} height={240} emptyMessage="No orders placed in the last 14 days." />
      <DataChart title="Current order distribution" description="All orders grouped by their current status."
        layout="vertical" labelWidth={122} height={Math.max(240, Object.keys(activity.by_status).length * 32)}
        data={Object.entries(activity.by_status).map(([status, count]) => ({ label: status.replaceAll('_', ' '), count }))}
        series={[{ key: 'count', label: 'Orders' }]} emptyMessage="No orders recorded for this Shop." />
    </div>
  </div>
}
