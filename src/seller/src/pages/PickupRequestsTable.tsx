import { PortalSkeleton, PortalTable } from '@aisley/ui/portal'
import { useEffect } from 'react'
import { FaArrowRight } from 'react-icons/fa6'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { OrderSortDialog, type OrderSortOption } from '../components/orders/OrderSortDialog'
import { OrderError } from '../components/orders/OrderUi'
import { OrderPagination } from '../components/orders/OrdersTable'
import { PickupStatus } from '../components/orders/pickup/PickupRequestStatus'
import { useSellerOrders } from '../lib/useSellerOrders'
import { orderDate } from '../types/orders'
import { pickupDate, type SellerPickupRequestPage } from '../types/pickupRequests'

const sortOptions: OrderSortOption[] = [
  { value: 'requested_desc', label: 'Newest request', description: 'Most recently submitted requests first.' },
  { value: 'requested_asc', label: 'Oldest request', description: 'Requests waiting the longest first.' },
  { value: 'orders_desc', label: 'Most parcels', description: 'Requests with the most orders first.' },
  { value: 'orders_asc', label: 'Fewest parcels', description: 'Requests with the fewest orders first.' },
  { value: 'status', label: 'Request status', description: 'Group requests by their Logistics schedule status.' },
]

export function PickupRequestsTable({ refreshRevision }: { refreshRevision: number }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const requestedSort = params.get('pickup_sort') ?? 'requested_desc'
  const sort = sortOptions.some((option) => option.value === requestedSort) ? requestedSort : 'requested_desc'
  const page = Math.max(1, Math.floor(Number(params.get('pickup_page'))) || 1)
  const { data, error, loading, refresh } = useSellerOrders<SellerPickupRequestPage>(
    `/api/v1/seller/pickup-requests?sort=${sort}&page=${page}&per_page=10`,
  )

  useEffect(() => { if (refreshRevision > 0) refresh() }, [refreshRevision, refresh])

  function update(key: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'pickup_page') next.delete('pickup_page')
      return next
    })
  }

  return (
    <section className="order-surface order-table-wrap mt-6 overflow-hidden" aria-labelledby="pickup-requests-title" aria-busy={loading}>
      <div className="order-section-heading">
        <div>
          <h2 id="pickup-requests-title">Pickup requests</h2>
          <p>{data ? `${data.meta.total} requests` : 'Request history and Logistics schedules'}</p>
        </div>
        <OrderSortDialog buttonLabel="Sort requests" options={sortOptions} value={sort}
          onChange={(value) => update('pickup_sort', value)} />
      </div>
      {error && <div className="px-4"><OrderError message={error} retry={refresh} /></div>}
      {!data && loading ? <PortalSkeleton label="Loading pickup requests" rows={4} /> : data?.data.length ? (
        <>
          <PortalTable density="compact" label="Shop pickup requests">
            <thead>
              <tr>
                <th scope="col">Pickup ID</th><th scope="col">Logistics provider</th>
                <th className="portal-number" scope="col">Parcels</th><th scope="col">Request status</th>
                <th scope="col">Submitted</th><th className="portal-row-action" scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((pickup) => (
                <tr key={pickup.id}>
                  <th scope="row">
                    <span className="font-mono text-xs font-semibold" title={pickup.id}>
                      {pickup.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="sr-only">Full pickup ID {pickup.id}</span>
                  </th>
                  <td className="min-w-40">{pickup.provider?.business_name ?? 'Provider unavailable'}</td>
                  <td className="portal-number font-semibold!">{pickup.order_count}</td>
                  <td>
                    <PickupStatus status={pickup.status} />
                    {pickup.status === 'scheduled' && (
                      <span className="portal-table-meta">{pickupDate(pickup.pickup_date)}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <time className="portal-secondary text-xs" dateTime={pickup.requested_at}>
                      {orderDate(pickup.requested_at)}
                    </time>
                  </td>
                  <td className="portal-row-action">
                    <Link className="portal-button portal-button-ghost order-row-action"
                      aria-label={`View parcels for pickup ${pickup.id}`}
                      state={{ backTo: `${location.pathname}${location.search}` }} to={`/orders/pickup/${pickup.id}`}>
                      View parcels<FaArrowRight aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </PortalTable>
          <OrderPagination currentPage={data.meta.current_page} lastPage={data.meta.last_page}
            total={data.meta.total} onPage={(value) => update('pickup_page', String(value))} disabled={loading} />
        </>
      ) : data ? (
        <p className="order-empty">No pickup requests yet. Submit prepared orders to create a request.</p>
      ) : null}
    </section>
  )
}
