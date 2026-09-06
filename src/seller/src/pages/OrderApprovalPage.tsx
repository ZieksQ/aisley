import { useEffect } from 'react'
import { OrderButton, OrderError } from '../components/orders/OrderUi'
import { useSellerOrders } from '../lib/useSellerOrders'
import { OrderRows } from './OrdersPage'
import type { SellerOrderPage } from '../types/orders'

export function OrderApprovalPage() {
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>('/api/v1/seller/orders?status=placed&sort=oldest&per_page=50')
  useEffect(() => { document.title = 'Order approval | Aisley Seller' }, [])
  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10"><div><h2 className="text-2xl font-semibold">Order approval</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Review new orders in oldest-first order, then approve or reject each one.</p></div><OrderButton isLoading={loading} loadingLabel="Refreshing" onClick={refresh}>Refresh</OrderButton></div>
    {error && <OrderError message={error} retry={refresh} />}
    {!data && loading ? <p className="mt-5" role="status">Loading orders for approval…</p> : data && <div className="mt-5"><p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{data.meta.total} orders awaiting approval</p><OrderRows approval orders={data.data} empty="No orders are waiting for approval." /></div>}
  </div>
}
