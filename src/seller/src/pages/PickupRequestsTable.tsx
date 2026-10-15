import { useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { OrderSortDialog, type OrderSortOption } from '../components/orders/OrderSortDialog'
import { OrderError, orderPanel } from '../components/orders/OrderUi'
import { OrderPagination } from '../components/orders/OrdersTable'
import { useSellerOrders } from '../lib/useSellerOrders'
import { orderDate } from '../types/orders'
import type { SellerPickupRequestPage } from '../types/pickupRequests'

const sortOptions: OrderSortOption[] = [
  {
    value: 'requested_desc',
    label: 'Newest request',
    description: 'Recently submitted pickup requests appear first.',
  },
  {
    value: 'requested_asc',
    label: 'Oldest request',
    description: 'Start with pickup requests that have waited the longest.',
  },
  {
    value: 'orders_desc',
    label: 'Most parcels',
    description: 'Requests with the most orders appear first.',
  },
  {
    value: 'orders_asc',
    label: 'Fewest parcels',
    description: 'Requests with the fewest orders appear first.',
  },
  {
    value: 'status',
    label: 'Request status',
    description: 'Group requests by their current Logistics schedule status.',
  },
]

export function PickupRequestsTable({ refreshRevision }: { refreshRevision: number }) {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const requestedSort = params.get('pickup_sort') ?? 'requested_desc'
  const sort = sortOptions.some((option) => option.value === requestedSort)
    ? requestedSort
    : 'requested_desc'
  const page = Math.max(1, Number(params.get('pickup_page')) || 1)
  const path = `/api/v1/seller/pickup-requests?sort=${sort}&page=${page}&per_page=10`
  const { data, error, loading, refresh } = useSellerOrders<SellerPickupRequestPage>(path)

  useEffect(() => {
    if (refreshRevision > 0) refresh()
  }, [refreshRevision, refresh])

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
    <section className={`${orderPanel} mt-8 overflow-hidden`} aria-labelledby="pickup-requests-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <div>
          <h2 className="text-lg font-semibold" id="pickup-requests-title">Pickup requests</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Open a request to print its waybills and review each parcel.
          </p>
        </div>
        <OrderSortDialog
          buttonLabel="Sort requests"
          onChange={(value) => update('pickup_sort', value)}
          options={sortOptions}
          value={sort}
        />
      </div>

      {error && <div className="px-5"><OrderError message={error} retry={refresh} /></div>}
      {!data && loading ? (
        <PickupRequestsLoading />
      ) : data && data.data.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <caption className="sr-only">Pickup request history for this Shop</caption>
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-white/[0.035] dark:text-zinc-400">
                <tr>
                  <th className="px-5 py-3" scope="col">Pickup ID</th>
                  <th className="px-5 py-3" scope="col">Logistics provider</th>
                  <th className="px-5 py-3 text-right" scope="col">Parcels</th>
                  <th className="px-5 py-3" scope="col">Request status</th>
                  <th className="px-5 py-3" scope="col">Pickup date</th>
                  <th className="px-5 py-3 text-right" scope="col">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                {data.data.map((pickup) => (
                  <tr
                    className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.025]"
                    key={pickup.id}
                  >
                    <th className="px-5 py-4 font-medium" scope="row">
                      <Link
                        className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#4C1268] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:text-purple-300"
                        state={{ backTo: `${location.pathname}${location.search}` }}
                        title={`Pickup request ${pickup.id}`}
                        to={`/orders/pickup/${pickup.id}`}
                      >
                        <span className="font-mono text-xs">{pickup.id.slice(0, 8).toUpperCase()}</span>
                        <span>Open parcels</span>
                      </Link>
                      <span className="sr-only">Pickup request ID {pickup.id}</span>
                    </th>
                    <td className="px-5 py-4">
                      {pickup.provider?.business_name ?? 'Provider unavailable'}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums">
                      {pickup.order_count}
                    </td>
                    <td className="px-5 py-4"><PickupStatus status={pickup.status} /></td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400">
                      {formatPickupDate(pickup.pickup_date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-zinc-600 dark:text-zinc-400">
                      <time dateTime={pickup.requested_at}>{orderDate(pickup.requested_at)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.meta.last_page > 1 && (
            <div className="px-5">
              <OrderPagination
                currentPage={data.meta.current_page}
                lastPage={data.meta.last_page}
                onPage={(value) => update('pickup_page', String(value))}
                total={data.meta.total}
              />
            </div>
          )}
        </>
      ) : data ? (
        <div className="px-5 py-10 text-center">
          <p className="font-medium">No pickup requests yet</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Requests appear after you mark prepared orders ready for pickup.
          </p>
        </div>
      ) : null}
    </section>
  )
}

export function PickupStatus({ status }: { status: string }) {
  const label = status === 'pending_logistics'
    ? 'Waiting for Logistics'
    : status === 'partially_scheduled'
      ? 'Partially scheduled'
      : status === 'scheduled'
        ? 'Scheduled'
        : status.replaceAll('_', ' ')
  const style = status === 'scheduled'
    ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-200'
    : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100'

  return (
    <span className={`inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}

function formatPickupDate(date: string | null) {
  return date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'Not scheduled'
}

function PickupRequestsLoading() {
  return (
    <div aria-label="Loading pickup requests" className="space-y-4 p-5" role="status">
      <span className="sr-only">Loading pickup requests…</span>
      {[0, 1, 2, 3].map((row) => (
        <div
          className="grid animate-pulse grid-cols-2 gap-4 border-b border-zinc-200 pb-4 last:border-0 dark:border-white/10 sm:grid-cols-5"
          key={row}
        >
          <span className="h-4 rounded bg-zinc-200 dark:bg-white/10" />
          <span className="h-4 rounded bg-zinc-200 dark:bg-white/10" />
          <span className="hidden h-4 rounded bg-zinc-200 dark:bg-white/10 sm:block" />
          <span className="h-4 rounded bg-zinc-200 dark:bg-white/10" />
          <span className="hidden h-4 rounded bg-zinc-200 dark:bg-white/10 sm:block" />
        </div>
      ))}
    </div>
  )
}
