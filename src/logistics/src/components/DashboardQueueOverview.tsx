import { DataChart } from '@aisley/ui/charts'
import type { FulfillmentQueueResponse } from '../types/fulfillment'

function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export function DashboardQueueOverview({ queue, stale }: { queue: FulfillmentQueueResponse; stale: boolean }) {
  const metrics = [
    ['Active shipments', queue.summary.total],
    ['Evidence pending', queue.summary.pending_evidence],
    ['Completion intents', queue.summary.pending_completion],
    ['Out for delivery', queue.summary.by_status.out_for_delivery ?? 0],
  ] as const
  return <>
    <dl className="mt-5 grid grid-cols-2 gap-5 border-y border-[var(--portal-border)] py-5 text-sm lg:grid-cols-4">
      {metrics.map(([label, value]) => <div key={label}>
        <dt className="portal-secondary">{label}</dt>
        <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      </div>)}
    </dl>
    <DataChart className="mt-6" variant="plain" title="Shipments by status" layout="vertical"
      labelWidth={145} height={Math.max(200, Object.keys(queue.summary.by_status).length * 40)}
      series={[{ key: 'count', label: 'Shipments' }]}
      data={Object.entries(queue.summary.by_status).map(([status, count]) => ({ label: statusLabel(status), count }))}
      emptyMessage="No active shipments for this hub." />
    {queue.data.length ? <p className="portal-secondary mt-4 text-sm">{queue.data.length} record{queue.data.length === 1 ? '' : 's'} on the first page. Search parcels to review custody, evidence, and final-mile details.</p>
      : <p className="portal-secondary mt-4 text-sm">No authoritative fulfillment records are currently available for this hub.</p>}
    <p className="portal-secondary mt-3 text-xs">{stale ? 'Last successful update (stale)' : 'Last checked'} {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(queue.freshness.generated_at))}. Counts are scoped to this organization and hub.</p>
  </>
}
