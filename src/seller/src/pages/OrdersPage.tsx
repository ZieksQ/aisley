import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OrderButton, OrderError, orderLink, orderPanel } from '../components/orders/OrderUi'
import { useSellerOrders } from '../lib/useSellerOrders'
import { orderDate, orderMoney, orderStatuses, orderStatusLabel, type SellerOrder, type SellerOrderPage } from '../types/orders'

const cards = Object.entries(orderStatuses) as Array<[SellerOrder['status'], string]>

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const sort = params.get('sort') ?? 'activity_desc'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = new URLSearchParams({ page: String(page), per_page: '20', sort, ...(status ? { status } : {}) })
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>(`/api/v1/seller/orders?${query}`)
  useEffect(() => { document.title = 'Order monitoring | Aisley Seller' }, [])
  function filter(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next) }
  const select = 'mt-2 block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/20 dark:bg-[#18181b]'

  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10"><div><h2 className="text-2xl font-semibold">Order monitoring</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Track order workload and recent activity across every status.</p></div><OrderButton isLoading={loading} loadingLabel="Refreshing" onClick={refresh}>Refresh</OrderButton></div>
    <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-4 lg:grid-cols-7">{cards.map(([cardStatus, label]) => <Link className="bg-white p-4 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] dark:bg-[#18181b] dark:hover:bg-white/[0.06]" key={cardStatus} to={`/orders/monitoring?status=${cardStatus}`}><span className="block text-2xl font-semibold tabular-nums">{data?.status_counts[cardStatus] ?? '—'}</span><span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">{label}</span></Link>)}</div>
    <div className="my-5 grid gap-4 sm:grid-cols-2 sm:max-w-xl"><label className="text-sm font-medium">Status<select className={select} value={status} onChange={(e) => filter('status', e.target.value)}><option value="">All statuses</option>{Object.entries(orderStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="text-sm font-medium">Sort by<select className={select} value={sort} onChange={(e) => filter('sort', e.target.value)}><option value="activity_desc">Recent activity</option><option value="oldest">Oldest first</option><option value="amount_high">Amount: high to low</option><option value="amount_low">Amount: low to high</option><option value="status">Status</option></select></label></div>
    {error && <OrderError message={error} retry={refresh} />}
    {!data && loading ? <p role="status">Loading orders…</p> : data && <><p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{data.meta.total} matching orders</p><OrderRows orders={data.data} empty="No orders match this monitoring view." />{data.meta.last_page > 1 && <nav aria-label="Order pages" className="mt-4 flex items-center justify-between text-sm"><OrderButton disabled={page <= 1} onClick={() => filter('page', String(page - 1))}>Previous</OrderButton><span>Page {data.meta.current_page} of {data.meta.last_page}</span><OrderButton disabled={page >= data.meta.last_page} onClick={() => filter('page', String(page + 1))}>Next</OrderButton></nav>}</>}
  </div>
}

export function OrderRows({ orders, empty, approval = false }: { orders: SellerOrder[]; empty: string; approval?: boolean }) {
  return <div className={orderPanel}>{orders.length === 0 ? <p className="p-6 text-sm text-zinc-600 dark:text-zinc-400">{empty}</p> : <ul className="divide-y divide-zinc-200 dark:divide-white/10">{orders.map((order) => <li className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5" key={order.id}><div><Link className={`${orderLink} break-all`} to={`/orders/${order.id}`} state={{ backTo: approval ? '/orders/approval' : '/orders/monitoring' }}>{order.reference}</Link><p className="mt-2 text-sm">{orderStatusLabel(order.status)}</p><p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">{order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')}</p><p className="mt-1 text-xs text-zinc-500">{orderDate(order.latest_activity_at)}</p></div><div className="text-sm sm:text-right"><p className="font-semibold">{orderMoney(order.totals.payable, order.totals.currency)}</p>{approval && <Link className={`${orderLink} mt-3 inline-block`} to={`/orders/${order.id}`} state={{ backTo: '/orders/approval' }}>Review approval</Link>}</div></li>)}</ul>}</div>
}
