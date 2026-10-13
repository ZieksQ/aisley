import { Link } from 'react-router-dom'
import { LuArrowUpRight, LuShoppingBag } from 'react-icons/lu'
import { useSellerOrders } from '../../lib/useSellerOrders'
import { orderMoney, type SellerOrderPage } from '../../types/orders'
import { OrderError } from './OrderUi'

export function DashboardOrders() {
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>('/api/v1/seller/orders?status=placed&per_page=5')
  return <section className="portal-panel" aria-labelledby="dashboard-orders">
    <div className="dashboard-panel-header">
      <div><h3 id="dashboard-orders">Orders awaiting approval</h3><p>{data ? `${data.meta.total} orders in the approval queue` : 'Recent orders to review'}</p></div>
      <Link className="portal-link inline-flex min-h-11 items-center gap-2 text-sm" to="/orders/approval">Review orders <LuArrowUpRight aria-hidden="true" /></Link>
    </div>
    {error ? <OrderError message={error} retry={refresh} />
      : !data && loading ? <div className="space-y-4 py-5" role="status" aria-label="Loading orders">{[0, 1, 2].map((row) => <div className="skeleton-block h-8 w-full" key={row} />)}</div>
        : data?.data.length === 0 ? <p className="portal-secondary py-8 text-sm">No orders are awaiting approval.</p>
          : <ul className="dashboard-work-list">{data?.data.map((order) => <li key={order.id}>
            <Link to={`/orders/${order.id}`} state={{ backTo: '/orders/approval' }}>
              <span className="dashboard-work-icon" aria-hidden="true"><LuShoppingBag size={19} /></span>
              <strong className="min-w-0 break-all font-medium">{order.reference}</strong>
              <span className="dashboard-work-count">{orderMoney(order.totals.payable, order.totals.currency)}</span>
              <LuArrowUpRight aria-hidden="true" />
            </Link>
          </li>)}</ul>}
    <div className="dashboard-chart-caption flex flex-wrap gap-x-5 gap-y-2">
      <Link className="portal-link inline-flex min-h-11 items-center gap-1 text-sm" to="/orders/monitoring">Order monitoring <LuArrowUpRight aria-hidden="true" /></Link>
      <Link className="portal-link inline-flex min-h-11 items-center gap-1 text-sm" to="/orders/pickup">Pickup orders <LuArrowUpRight aria-hidden="true" /></Link>
    </div>
  </section>
}
