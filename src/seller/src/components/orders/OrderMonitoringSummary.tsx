import { DashboardMetricCard } from '@aisley/ui/portal'
import { FaBoxOpen, FaCircleCheck, FaClock, FaTruckFast } from 'react-icons/fa6'
import { orderStatuses, type SellerOrderPage } from '../../types/orders'

const metrics = [
  { status: 'placed', label: 'Awaiting approval', detail: 'Orders waiting for your decision.', icon: <FaClock /> },
  { status: 'seller_processing', label: 'In preparation', detail: 'Approved orders being packed.', icon: <FaBoxOpen /> },
  { status: 'ready_for_pickup', label: 'Awaiting pickup', detail: 'Parcels ready for Logistics.', icon: <FaTruckFast /> },
  { status: 'delivered', label: 'Delivered', detail: 'Orders delivered to customers.', icon: <FaCircleCheck /> },
] as const

export function OrderMonitoringSummary({ counts }: { counts?: SellerOrderPage['status_counts'] }) {
  return (
    <section aria-label="Shop order summary">
      <div className="order-metrics">
        {metrics.map((metric) => (
          <DashboardMetricCard key={metric.status} label={metric.label}
            value={counts ? counts[metric.status] ?? 0 : '—'} icon={metric.icon} detail={metric.detail} />
        ))}
      </div>
      <details className="order-surface order-status-register">
        <summary>All order statuses · Shop totals</summary>
        <dl>
          {Object.entries(orderStatuses).map(([status, label]) => (
            <div key={status}>
              <dt>{label}</dt>
              <dd>{counts ? counts[status as keyof typeof orderStatuses] ?? 0 : '—'}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  )
}
