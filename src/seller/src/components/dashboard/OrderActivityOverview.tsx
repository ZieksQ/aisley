import { DataChart, DistributionChart } from '@aisley/ui/charts'
import { DashboardMetricCard } from '@aisley/ui/portal'
import { LuClipboardCheck, LuPackageCheck, LuPackageOpen, LuTruck } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import type { OrderActivity, UnavailableSection } from '../../types/dashboard'

function describeOrderChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0
      ? { marker: '↗', text: 'New activity', tone: 'positive' as const }
      : { marker: '→', text: 'No change', tone: 'neutral' as const }
  }
  if (current === previous) return { marker: '→', text: 'No change', tone: 'neutral' as const }

  const percentage = Math.abs((current - previous) / previous * 100)
  const formatted = percentage < .1 ? '<0.1%' : `${percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
  const increase = current > previous
  return {
    marker: increase ? '↗' : '↘',
    text: `${increase ? '+' : '−'}${formatted}`,
    tone: increase ? 'positive' as const : 'negative' as const,
  }
}

function hasCompleteActivityWindow(activity: OrderActivity) {
  const days = activity.daily_placed
  if (activity.timezone !== 'UTC' || days.length !== 14 || activity.from !== days[0]?.date || activity.to !== days[13]?.date) return false

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
    { label: 'Awaiting approval', value: activity.metrics.awaiting_approval, detail: 'New orders to review', icon: LuClipboardCheck, color: 'var(--chart-violet)' },
    { label: 'In preparation', value: activity.metrics.processing, detail: 'Orders being prepared', icon: LuPackageOpen, color: 'var(--chart-blue)' },
    { label: 'Ready for pickup', value: activity.metrics.ready_for_pickup, detail: 'Waiting for collection', icon: LuTruck, color: 'var(--chart-amber)' },
    { label: 'Delivered', value: activity.metrics.delivered, detail: 'Completed · all time', icon: LuPackageCheck, color: 'var(--chart-teal)' },
  ]
  const work = metrics.slice(0, 3)

  return <div className="space-y-6">
    <div className="dashboard-metric-grid">
      {metrics.map((metric) => <DashboardMetricCard key={metric.label} label={metric.label} value={metric.value.toLocaleString()}
        icon={<metric.icon size={19} />} detail={metric.detail} />)}
    </div>
    <div className="dashboard-columns">
      <DataChart title="Order activity" description="Orders placed across the 14 complete UTC dates before today" height={280} animate
        summary={<><strong>{placed.toLocaleString()}</strong>orders placed{activityChange && <span className={`dashboard-chart-comparison dashboard-chart-comparison--${activityChange.tone}`}><span aria-hidden="true">{activityChange.marker}</span> {activityChange.text} vs prior 7 complete UTC days</span>}</>}
        data={activity.daily_placed.map((day) => ({ label: day.date.slice(5), count: day.count }))}
        series={[{ key: 'count', label: 'Orders placed', kind: 'area', color: 'var(--chart-blue)' }]}
        strokeWidth={2.5} fillOpacity={.1} curve="linear"
        caption={`${activity.from} – ${activity.to} · UTC. Excludes pending payment; includes subsequently cancelled or rejected orders.`}
        emptyMessage="No orders placed in the 14 complete UTC dates before today." />
      <DistributionChart title="Fulfillment workload" totalLabel="before handoff" animate
        rows={work.map((metric) => ({ label: metric.label, value: metric.value, color: metric.color }))}
        emptyMessage="No orders awaiting approval, preparation or pickup." />
    </div>
  </div>
}
