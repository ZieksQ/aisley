import type { CSSProperties } from 'react'
import { DataChart, DistributionChart } from '@aisley/ui/charts'
import { DashboardMetricCard } from '@aisley/ui/portal'
import { Link } from 'react-router-dom'
import type { OrderActivity, UnavailableSection } from '../../types/dashboard'

function describeOrderChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0
      ? { text: 'New activity', tone: 'positive' as const }
      : { text: 'No change', tone: 'neutral' as const }
  }
  if (current === previous) return { text: 'No change', tone: 'neutral' as const }

  const percentage = Math.abs((current - previous) / previous * 100)
  const formatted = percentage < .1 ? '<0.1%' : `${percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
  const direction = current > previous ? '+' : '−'
  return {
    text: `${direction}${formatted} vs prior 7 days`,
    tone: current > previous ? 'positive' as const : 'negative' as const,
  }
}

function hasCompleteActivityWindow(activity: OrderActivity) {
  const days = activity.daily_placed
  if (days.length !== 14) return false

  return days.every((day, index) => {
    const current = new Date(`${day.date}T00:00:00.000Z`)
    if (Number.isNaN(current.getTime()) || current.toISOString().slice(0, 10) !== day.date) return false
    if (index === 0) return true

    const previous = new Date(`${days[index - 1].date}T00:00:00.000Z`)
    return current.getTime() - previous.getTime() === 24 * 60 * 60 * 1000
  })
}

export function OrderActivityOverview({ activity }: { activity?: OrderActivity | UnavailableSection }) {
  if (!activity || activity.state === 'unavailable') {
    return <section className="portal-panel"><h3 className="font-semibold">Order activity</h3><p className="portal-secondary mt-2 text-sm">Order activity is unavailable.</p><Link className="portal-link inline-flex min-h-11 items-center text-sm" to="/orders/monitoring">Open order monitoring</Link></section>
  }
  const placed = activity.daily_placed.reduce((sum, day) => sum + day.count, 0)
  const hasCompleteWindow = hasCompleteActivityWindow(activity)
  const previousSeven = hasCompleteWindow ? activity.daily_placed.slice(0, 7).reduce((sum, day) => sum + day.count, 0) : 0
  const latestSeven = hasCompleteWindow ? activity.daily_placed.slice(7, 14).reduce((sum, day) => sum + day.count, 0) : 0
  const activityChange = hasCompleteWindow ? describeOrderChange(latestSeven, previousSeven) : undefined
  const metrics = [
    { label: 'Awaiting approval', value: activity.metrics.awaiting_approval, to: '/orders/approval', detail: 'New orders to review', link: 'Review orders', color: 'var(--chart-violet)' },
    { label: 'In preparation', value: activity.metrics.processing, to: '/orders/pickup', detail: 'Orders being prepared', link: 'Open pickup orders', color: 'var(--chart-blue)' },
    { label: 'Ready for pickup', value: activity.metrics.ready_for_pickup, to: '/orders/pickup', detail: 'Waiting for collection', link: 'Open pickup orders', color: 'var(--chart-amber)' },
    { label: 'Delivered', value: activity.metrics.delivered, to: '/orders/monitoring', detail: 'Orders in delivered status', link: 'View order monitoring', color: 'var(--chart-teal)' },
  ]
  const work = metrics.slice(0, 3)
  const statusPoints = metrics.map((metric) => ({ label: metric.label, value: metric.value, color: metric.color }))
  const orderTrendPoints = activity.daily_placed.map((day) => ({ label: day.date, value: day.count, color: 'var(--chart-blue)' }))

  return <div className="space-y-6">
    <div className="dashboard-metric-grid" style={{ '--metric-count': 5 } as CSSProperties}>
      {metrics.map((metric, index) => <DashboardMetricCard key={metric.label} label={metric.label} value={metric.value.toLocaleString()}
        detail={metric.detail}
        chart={{ label: 'Current Shop order status counts', points: statusPoints, activeIndex: index }}
        action={<Link className="dashboard-card-link" to={metric.to}>{metric.link}</Link>} />)}
      <DashboardMetricCard label="Orders placed · last 7 complete UTC days" value={hasCompleteWindow ? latestSeven.toLocaleString() : '—'}
        detail={hasCompleteWindow ? 'Placed orders, excluding pending payment; compared with the prior 7 complete days' : 'A complete 14-day UTC comparison period is unavailable'}
        chart={hasCompleteWindow ? { label: 'Orders placed by UTC date across 14 complete dates', kind: 'area', placement: 'underlay', points: orderTrendPoints } : undefined}
        change={activityChange}
        action={<Link className="dashboard-card-link" to="/orders/monitoring">View order monitoring</Link>} />
    </div>
    <div className="dashboard-columns">
      <DataChart title="Order activity" description="Orders placed across the 14 complete UTC dates before today" height={280}
        summary={<><strong>{placed.toLocaleString()}</strong>orders placed</>}
        data={activity.daily_placed.map((day) => ({ label: day.date.slice(5), count: day.count }))}
        series={[{ key: 'count', label: 'Orders placed', kind: 'area', color: 'var(--chart-blue)' }]}
        strokeWidth={2.5} fillOpacity={.1} curve="linear"
        caption={`${activity.from} – ${activity.to} · UTC. Excludes pending payment; includes subsequently cancelled or rejected orders.`}
        emptyMessage="No orders placed in the 14 complete UTC dates before today." />
      <DistributionChart title="Fulfillment workload" totalLabel="before handoff"
        rows={work.map((metric) => ({ label: metric.label, value: metric.value, color: metric.color }))}
        emptyMessage="No orders awaiting approval, preparation or pickup." />
    </div>
  </div>
}
