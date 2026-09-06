import { Link } from 'react-router-dom'
import { useSellerOrders } from '../../lib/useSellerOrders'
import { orderMoney, type SellerOrderPage } from '../../types/orders'
import { OrderError, orderLink, orderPanel } from './OrderUi'

export function DashboardOrders() {
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>('/api/v1/seller/orders?status=placed&per_page=5')
  return <section className={`${orderPanel} mt-6`} aria-labelledby="dashboard-orders">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-5 dark:border-white/10">
      <h3 className="font-semibold" id="dashboard-orders">Awaiting approval{data ? ` (${data.meta.total})` : ''}</h3>
      <Link className={`${orderLink} text-sm`} to="/orders/approval">Review orders</Link>
    </div>
    {error ? <div className="px-5"><OrderError message={error} retry={refresh} /></div> : !data && loading ? <p className="p-5 text-sm" role="status">Loading orders…</p> : data?.data.length === 0 ? <p className="p-5 text-sm text-zinc-600 dark:text-zinc-400">No orders are awaiting approval.</p> : <ul className="divide-y divide-zinc-200 dark:divide-white/10">{data?.data.map((order) => <li className="flex flex-wrap justify-between gap-3 px-5 py-4 text-sm" key={order.id}><Link className={`${orderLink} break-all`} to={`/orders/${order.id}`} state={{ backTo: '/orders/approval' }}>{order.reference}</Link><span>{orderMoney(order.totals.payable, order.totals.currency)}</span></li>)}</ul>}
    <div className="border-t border-zinc-200 px-5 py-4 text-sm dark:border-white/10"><Link className={orderLink} to="/orders/monitoring">Order monitoring</Link><span className="mx-3 text-zinc-400" aria-hidden="true">·</span><Link className={orderLink} to="/orders/pickup">Pickup orders</Link></div>
  </section>
}
