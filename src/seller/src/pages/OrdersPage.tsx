import { useEffect, type ReactNode } from 'react'
import {
  FaBoxOpen,
  FaCircleCheck,
  FaCircleXmark,
  FaClock,
  FaMoneyBillWave,
  FaRotateLeft,
  FaRoute,
  FaTruckFast,
} from 'react-icons/fa6'
import { useSearchParams } from 'react-router-dom'
import { OrderSortDialog, type OrderSortOption } from '../components/orders/OrderSortDialog'
import { OrderButton, OrderError, orderPanel } from '../components/orders/OrderUi'
import { OrderPagination, OrdersTable } from '../components/orders/OrdersTable'
import { useSellerOrders } from '../lib/useSellerOrders'
import { orderStatuses, type SellerOrder, type SellerOrderPage } from '../types/orders'

const statusCards = Object.entries(orderStatuses) as Array<[SellerOrder['status'], string]>

const sortOptions: OrderSortOption[] = [
  {
    value: 'activity_desc',
    label: 'Recent activity',
    description: 'Orders updated most recently appear first.',
  },
  {
    value: 'oldest',
    label: 'Oldest placed',
    description: 'Start with the orders waiting the longest.',
  },
  {
    value: 'amount_high',
    label: 'Highest total',
    description: 'Show the largest order totals first.',
  },
  {
    value: 'amount_low',
    label: 'Lowest total',
    description: 'Show the smallest order totals first.',
  },
  {
    value: 'status',
    label: 'Status',
    description: 'Group orders by their current lifecycle status.',
  },
]

const statusIcons: Record<string, ReactNode> = {
  placed: <FaClock aria-hidden="true" />,
  seller_processing: <FaBoxOpen aria-hidden="true" />,
  ready_for_pickup: <FaTruckFast aria-hidden="true" />,
  pending_payment: <FaMoneyBillWave aria-hidden="true" />,
  assigned: <FaTruckFast aria-hidden="true" />,
  picked_up: <FaBoxOpen aria-hidden="true" />,
  in_transit: <FaRoute aria-hidden="true" />,
  out_for_delivery: <FaTruckFast aria-hidden="true" />,
  delivered: <FaCircleCheck aria-hidden="true" />,
  cancelled: <FaCircleXmark aria-hidden="true" />,
  rejected: <FaCircleXmark aria-hidden="true" />,
  delivery_failed: <FaCircleXmark aria-hidden="true" />,
  return_requested: <FaRotateLeft aria-hidden="true" />,
  returned: <FaRotateLeft aria-hidden="true" />,
}

export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const requestedSort = params.get('sort') ?? 'activity_desc'
  const sort = sortOptions.some((option) => option.value === requestedSort)
    ? requestedSort
    : 'activity_desc'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = new URLSearchParams({
    page: String(page),
    per_page: '20',
    sort,
    ...(status ? { status } : {}),
  })
  const { data, error, loading, refresh } = useSellerOrders<SellerOrderPage>(
    `/api/v1/seller/orders?${query}`,
  )

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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4C1268] dark:text-purple-300">
            Orders
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Order monitoring
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Follow the Shop order queue from approval through delivery.
          </p>
        </div>
        <OrderButton isLoading={loading} loadingLabel="Refreshing" onClick={refresh}>
          Refresh
        </OrderButton>
      </header>

      <section className="mt-6" aria-labelledby="status-counts-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold" id="status-counts-title">Orders by status</h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Counts include every order in this Shop.
            </p>
          </div>
          {data && (
            <span className="text-xs tabular-nums text-zinc-500">
              {data.meta.total} matching orders
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {statusCards.map(([cardStatus, label]) => (
            <article className={`${orderPanel} min-h-28 p-4`} key={cardStatus}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-5 text-zinc-700 dark:text-zinc-300">
                  {label}
                </h3>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#F1EAF4] text-[#4C1268] dark:bg-purple-300/10 dark:text-purple-200">
                  {statusIcons[cardStatus] ?? <FaBoxOpen aria-hidden="true" />}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">
                {data ? data.status_counts[cardStatus] ?? 0 : '—'}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">Shop orders</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="monitoring-results-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold" id="monitoring-results-title">Order queue</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Filter by status and choose the order you want to review.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Status
              <select
                className="mt-1 block min-h-11 min-w-48 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus-visible:border-[#4C1268] focus-visible:ring-2 focus-visible:ring-[#4C1268]/25 dark:border-white/20 dark:bg-[#18181b] dark:text-zinc-100"
                value={status}
                onChange={(event) => updateFilter('status', event.target.value)}
              >
                <option value="">All statuses</option>
                {Object.entries(orderStatuses).map(([value, label]) => (
                  <option value={value} key={value}>{label}</option>
                ))}
              </select>
            </label>
            <OrderSortDialog
              onChange={(value) => updateFilter('sort', value)}
              options={sortOptions}
              value={sort}
            />
          </div>
        </div>

        {error && <OrderError message={error} retry={refresh} />}
        {!data && loading ? (
          <OrdersLoading />
        ) : data ? (
          <>
            <OrdersTable orders={data.data} empty="No orders match the selected status." />
            {data.meta.last_page > 1 && (
              <OrderPagination
                currentPage={data.meta.current_page}
                lastPage={data.meta.last_page}
                onPage={(value) => updateFilter('page', String(value))}
                total={data.meta.total}
              />
            )}
          </>
        ) : null}
      </section>
    </main>
  )
}

function OrdersLoading() {
  return (
    <div
      aria-label="Loading orders"
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b]"
      role="status"
    >
      <div className="space-y-4">
        {[0, 1, 2, 3].map((row) => (
          <div
            className="grid animate-pulse grid-cols-2 gap-4 border-b border-zinc-200 pb-4 last:border-0 dark:border-white/10 sm:grid-cols-5"
            key={row}
          >
            <span className="h-4 rounded bg-zinc-200 dark:bg-white/10" />
            <span className="h-4 rounded bg-zinc-200 dark:bg-white/10" />
            <span className="hidden h-4 rounded bg-zinc-200 dark:bg-white/10 sm:block" />
            <span className="hidden h-4 rounded bg-zinc-200 dark:bg-white/10 sm:block" />
            <span className="h-4 rounded bg-zinc-200 dark:bg-white/10" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading orders…</span>
    </div>
  )
}
