import { PortalSkeleton } from '@aisley/ui/portal'
import { useEffect } from 'react'
import { FaRotateRight } from 'react-icons/fa6'
import { useSearchParams } from 'react-router-dom'
import { OrderMonitoringSummary } from '../components/orders/OrderMonitoringSummary'
import { OrderMonitoringToolbar } from '../components/orders/OrderMonitoringToolbar'
import { OrderButton, OrderError } from '../components/orders/OrderUi'
import { OrderPagination, OrdersTable } from '../components/orders/OrdersTable'
import { useSellerOrders } from '../lib/useSellerOrders'
import { orderStatuses, type SellerOrderPage } from '../types/orders'

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const requestedStatus = params.get('status') ?? ''
  const status = Object.hasOwn(orderStatuses, requestedStatus) ? requestedStatus : ''
  const requestedSort = params.get('sort') ?? 'activity_desc'
  const sort = ['activity_desc', 'oldest', 'amount_high', 'amount_low', 'status'].includes(requestedSort)
    ? requestedSort : 'activity_desc'
  const search = (params.get('search') ?? '').trim().slice(0, 120)
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)
  const query = new URLSearchParams({
    page: String(page), per_page: '20', sort,
    ...(status ? { status } : {}), ...(search ? { search } : {}),
  })
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>(`/api/v1/seller/orders?${query}`)
  useEffect(() => { document.title = 'Order monitoring | Aisley Seller' }, [])

  function updateFilter(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  return (
    <main className="portal-page seller-order-workspace">
      <header className="portal-page-header">
        <div>
          <h1 className="portal-page-heading">Order monitoring</h1>
          <p className="portal-page-description">Track your Shop orders from approval to delivery.</p>
        </div>
        <OrderButton isLoading={loading} loadingLabel="Refreshing…" onClick={refresh}>
          <FaRotateRight aria-hidden="true" />Refresh
        </OrderButton>
      </header>
      <OrderMonitoringSummary counts={data?.status_counts} />
      <section className="order-surface order-table-wrap overflow-hidden" aria-labelledby="monitoring-results-title" aria-busy={loading}>
        <OrderMonitoringToolbar search={search} status={status} sort={sort} onChange={updateFilter} />
        <div className="order-results-heading">
          <h2 id="monitoring-results-title">Orders</h2>
          <p role="status">
            {data ? `${data.meta.total} ${data.meta.total === 1 ? 'order' : 'orders'}` : loading ? 'Loading orders…' : 'Results unavailable'}
            {search ? ` matching “${search}”` : ''}
          </p>
        </div>
        {error && <div className="px-4"><OrderError message={error} retry={refresh} /></div>}
        {!data && loading ? <PortalSkeleton label="Loading orders" rows={5} /> : data ? (
          <>
            <OrdersTable orders={data.data} empty={search ? `No orders match “${search}”. Try another reference, product or SKU.` : 'No orders match this status.'} />
            <OrderPagination currentPage={data.meta.current_page} lastPage={data.meta.last_page}
              total={data.meta.total} onPage={(value) => updateFilter('page', String(value))} disabled={loading} />
          </>
        ) : null}
      </section>
    </main>
  )
}
