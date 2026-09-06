import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OrderButton, OrderError, orderLink, orderPanel } from '../components/orders/OrderUi'
import { useSellerOrders } from '../lib/useSellerOrders'
import { orderDate, orderMoney, orderStatuses, orderStatusLabel, type SellerOrderPage } from '../types/orders'

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const notification = params.get('notification') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = new URLSearchParams({ page: String(page), per_page: '20', ...(status ? { status } : {}), ...(notification ? { notification } : {}) })
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>(`/api/v1/seller/orders?${query}`)
  useEffect(() => { document.title = 'Orders | Aisley Seller' }, [])

  function filter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next)
  }

  const selectClass = 'mt-2 block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/20 dark:bg-[#18181b]'
  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
      <div><h2 className="text-2xl font-semibold">Orders</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Review purchases and accept orders for processing.</p></div>
      <OrderButton isLoading={loading} loadingLabel="Refreshing" onClick={refresh}>Refresh</OrderButton>
    </div>
    <div className="my-5 grid gap-4 sm:grid-cols-2 sm:max-w-xl">
      <label className="text-sm font-medium">Order status<select className={selectClass} value={status} onChange={(event) => filter('status', event.target.value)}><option value="">All orders</option>{Object.entries(orderStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Notification<select className={selectClass} value={notification} onChange={(event) => filter('notification', event.target.value)}><option value="">All notifications</option><option value="unread">Unread</option><option value="read">Read</option></select></label>
    </div>
    {error && <OrderError message={error} retry={refresh} />}
    {loading && !data ? <p role="status">Loading orders…</p> : data ? <>
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">{data.meta.total} matching orders{error ? ' · Refresh failed; showing previous results' : ''}</p>
      <div className={orderPanel}>
        {data.data.length === 0 ? <div className="p-6"><h3 className="font-medium">No orders in this view</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">New purchases will appear here after checkout. Try another filter or refresh.</p></div> : <ul className="divide-y divide-zinc-200 dark:divide-white/10">
          {data.data.map((order) => <li className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5" key={order.id}>
            <div className="min-w-0"><Link className={`${orderLink} break-words`} to={`/orders/${order.id}`} state={{ backTo: `/orders?${query}` }}>{order.reference}</Link>
              <p className="mt-2 text-sm">{orderStatusLabel(order.status)}{order.notification && !order.notification.read_at ? <span className="ml-3 font-semibold text-[#4C1268] dark:text-purple-300">Unread notification</span> : null}</p>
              <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">{order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Placed {orderDate(order.placed_at)}</p>
            </div>
            <div className="text-sm sm:text-right"><p className="font-semibold tabular-nums">{orderMoney(order.totals.payable, order.totals.currency)}</p><p className="mt-1 text-zinc-600 dark:text-zinc-400">{order.payment.method === 'cod' ? 'Cash on delivery' : order.payment.method} · {order.payment.status}</p>{order.capabilities.can_prepare && <Link className={`${orderLink} mt-2 inline-block`} to={`/orders/${order.id}/prepare`}>Review preparation</Link>}</div>
          </li>)}
        </ul>}
      </div>
      {data.meta.last_page > 1 && <nav aria-label="Order pages" className="mt-4 flex items-center justify-between gap-3 text-sm">
        <OrderButton disabled={loading || data.meta.current_page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(data.meta.current_page - 1)); setParams(next) }}>Previous</OrderButton>
        <span>Page {data.meta.current_page} of {data.meta.last_page}</span>
        <OrderButton disabled={loading || data.meta.current_page >= data.meta.last_page} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(data.meta.current_page + 1)); setParams(next) }}>Next</OrderButton>
      </nav>}
    </> : null}
  </div>
}
