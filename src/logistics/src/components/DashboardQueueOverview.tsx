import { DataChart } from '@aisley/ui/charts'
import { Link } from 'react-router-dom'
import type { FulfillmentQueueResponse } from '../types/fulfillment'

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export function DashboardQueueOverview({ queue, stale }: { queue: FulfillmentQueueResponse; stale: boolean }) {
  const metrics = [
    ['Active shipments', queue.summary.total, 'Across your operational hub'],
    ['Evidence pending', queue.summary.pending_evidence, 'Awaiting evidence review'],
    ['Completion intents', queue.summary.pending_completion, 'Pending completion processing'],
    ['Out for delivery', queue.summary.by_status.out_for_delivery ?? 0, 'Current shipment status'],
  ] as const
  return <div className="mt-6 space-y-6">
    <dl className="dashboard-metrics">
      {metrics.map(([label, value, detail]) => (
        <div className="dashboard-metric" key={label}>
          <dt>{label}</dt>
          <dd>{value.toLocaleString()}</dd>
          <p>{detail}</p>
        </div>
      ))}
    </dl>
    <div className="dashboard-columns">
      <DataChart title="Shipment pipeline" layout="vertical" description="Active shipments by current status. Completed history is excluded."
        labelWidth={145} height={Math.max(256, Object.keys(queue.summary.by_status).length * 36)}
        series={[{ key: 'count', label: 'Shipments' }]}
        data={Object.entries(queue.summary.by_status).map(([status, count]) => ({ label: statusLabel(status), count }))}
        emptyMessage="No active shipments for this hub." />
      <section className="portal-panel">
        <h3 className="font-semibold">Pending actions</h3>
        <DataChart className="mt-4" variant="plain" title="Review workload" height={160} layout="vertical" labelWidth={100}
          data={[{ label: 'Evidence', count: queue.summary.pending_evidence }, { label: 'Completion', count: queue.summary.pending_completion }]}
          series={[{ key: 'count', label: 'Pending records' }]} emptyMessage="No pending evidence or completion intents." />
        <p className="portal-secondary mt-3 text-xs">A shipment may have both pending evidence and a completion intent.</p>
        <div className="mt-4 divide-y divide-[var(--portal-border)] border-t border-[var(--portal-border)]">
          {[['Review parcel evidence', '/operations'], ['Receive parcels at hub', '/receive-at-hub'], ['Plan last-mile dispatch', '/dispatch']].map(([label, to]) => <Link className="portal-link flex min-h-11 items-center justify-between gap-3 py-3 text-sm" key={to} to={to}>{label}<span aria-hidden="true">→</span></Link>)}
        </div>
      </section>
    </div>
    <p className="portal-secondary text-xs">{stale ? 'Last successful update (stale)' : 'Last checked'} {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(queue.freshness.generated_at))}. Organization and hub scoped counts.</p>
  </div>
}
