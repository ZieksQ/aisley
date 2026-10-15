import { DataChart, DistributionChart } from '@aisley/ui/charts'
import { DashboardMetricCard } from '@aisley/ui/portal'
import { LuArrowUpRight, LuBoxes, LuClipboardCheck, LuFileCheck2, LuTruck } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import type { FulfillmentQueueResponse } from '../types/fulfillment'

const stageOrder = ['awaiting_seller_pickup', 'ready_for_pickup', 'seller_pickup_assigned', 'seller_pickup_accepted', 'picked_up_from_seller', 'received_at_hub', 'sorted_at_hub', 'dispatched_from_hub', 'delivery_assigned', 'delivery_accepted', 'picked_up_from_hub', 'in_transfer', 'in_transit', 'out_for_delivery']
const stageColors: Record<string, string> = {
  awaiting_seller_pickup: 'var(--chart-violet)', ready_for_pickup: 'var(--chart-violet)',
  seller_pickup_assigned: 'var(--chart-amber)', seller_pickup_accepted: 'var(--chart-amber)',
  picked_up_from_seller: 'var(--chart-blue)', received_at_hub: 'var(--chart-teal)',
  sorted_at_hub: 'var(--chart-violet)', dispatched_from_hub: 'var(--chart-rose)',
  delivery_assigned: 'var(--chart-amber)', delivery_accepted: 'var(--chart-amber)',
  picked_up_from_hub: 'var(--chart-rose)', in_transfer: 'var(--chart-slate)',
  in_transit: 'var(--chart-blue)', out_for_delivery: 'var(--chart-teal)',
}
function stageColor(status: string) {
  return stageColors[status] ?? 'var(--chart-slate)'
}
function statusLabel(status: string) {
  return status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export function DashboardQueueOverview({ queue, stale }: { queue: FulfillmentQueueResponse; stale: boolean }) {
  const metrics = [
    { label: 'Active shipments', value: queue.summary.total, detail: 'In the active hub queue', icon: LuBoxes },
    { label: 'Evidence pending', value: queue.summary.pending_evidence, detail: 'Evidence awaiting validation; may overlap completion intents', icon: LuFileCheck2 },
    { label: 'Completion intents', value: queue.summary.pending_completion, detail: 'Awaiting completion processing; may overlap evidence', icon: LuClipboardCheck },
    { label: 'Out for delivery', value: queue.summary.by_status.out_for_delivery ?? 0, detail: 'Shipments in this current status', icon: LuTruck },
  ]
  const stages = Object.entries(queue.summary.by_status).sort(([a], [b]) => stageOrder.indexOf(a) - stageOrder.indexOf(b)).map(([status, count]) => ({ label: statusLabel(status), count, color: stageColor(status) }))
  const generated = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(queue.freshness.generated_at))

  return <div className="space-y-6">
    <div className="dashboard-metric-grid">
      {metrics.map((metric) => <DashboardMetricCard key={metric.label} label={metric.label} value={metric.value.toLocaleString()}
        detail={metric.detail} icon={<metric.icon size={19} />} />)}
    </div>
    <div className="dashboard-columns">
      <DataChart title="Shipment stages" description="Current work across your hub" layout="vertical" animate
        summary={<><strong>{queue.summary.total.toLocaleString()}</strong>active shipments</>}
        labelWidth={142} height={Math.max(276, stages.length * 36)} data={stages}
        series={[{ key: 'count', label: 'Shipments' }]} caption="Completed delivery history is excluded from this active queue."
        emptyMessage="No active shipments for this hub." />
      <DistributionChart title="Shipment mix" totalLabel="shipments" animate
        rows={stages.map((stage) => ({ label: stage.label, value: stage.count, color: stage.color }))}
        emptyMessage="No active shipments for this hub." />
    </div>
    <div className="dashboard-columns">
      <section className="portal-panel">
        <div className="dashboard-panel-header"><div><h3>Hub workspaces</h3><p>Open a workspace to review and process parcels.</p></div></div>
        <ul className="dashboard-work-list">
          {[
            { label: 'Parcel evidence', detail: 'Review custody, evidence and completion records', to: '/operations', icon: LuFileCheck2 },
            { label: 'Receive at hub', detail: 'Record physical receipt at your hub', to: '/receive-at-hub', icon: LuBoxes },
            { label: 'Last-mile dispatch', detail: 'Plan scheduled Courier assignments', to: '/dispatch', icon: LuTruck },
          ].map((item) => <li key={item.to}><Link to={item.to}><span className="dashboard-work-icon" aria-hidden="true"><item.icon size={19} /></span><div><strong className="font-medium">{item.label}</strong><p>{item.detail}</p></div><LuArrowUpRight className="ml-auto" aria-hidden="true" /></Link></li>)}
        </ul>
      </section>
      <DataChart title="Pending reviews" description="Evidence and completion processing" layout="vertical" height={180} labelWidth={94} animate
        data={[{ label: 'Evidence', count: queue.summary.pending_evidence, color: 'var(--chart-amber)' }, { label: 'Completion', count: queue.summary.pending_completion, color: 'var(--chart-violet)' }]}
        series={[{ key: 'count', label: 'Pending records' }]} caption="A shipment can have both pending evidence and a completion intent."
        emptyMessage="No pending evidence or completion intents." />
    </div>
    <p className="portal-secondary text-xs">{stale ? 'Last successful update (stale)' : 'Last checked'} {generated} · Organization and hub scoped counts.</p>
  </div>
}
