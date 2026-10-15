import { Link } from 'react-router-dom'
import { orderDate, orderMoney, orderStatusLabel, type SellerOrder } from '../../types/orders'
import { OrderButton, orderLink } from './OrderUi'

export function OrdersTable({ orders, empty, approval = false }: {
  orders: SellerOrder[]
  empty: string
  approval?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">
      {orders.length === 0 ? (
        <p className="p-8 text-center text-sm text-zinc-600 dark:text-zinc-400">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <caption className="sr-only">
              {approval ? 'Orders awaiting approval' : 'Orders in the selected monitoring view'}
            </caption>
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-white/[0.035] dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3" scope="col">Order</th>
                <th className="px-5 py-3" scope="col">Items</th>
                <th className="px-5 py-3" scope="col">Status</th>
                <th className="px-5 py-3" scope="col">Last activity</th>
                <th className="px-5 py-3 text-right" scope="col">Total</th>
                <th className="px-5 py-3 text-right" scope="col">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
              {orders.map((order) => {
                const itemSummary = order.items
                  .map((item) => `${item.quantity} × ${item.product_name}`)
                  .join(', ')
                const itemQuantity = order.items.reduce((total, item) => total + item.quantity, 0)

                return (
                  <tr
                    className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.025]"
                    key={order.id}
                  >
                    <td className="max-w-56 px-5 py-4">
                      <Link
                        className={`${orderLink} break-all font-semibold`}
                        state={{ backTo: approval ? '/orders/approval' : '/orders/monitoring' }}
                        to={`/orders/${order.id}`}
                      >
                        {order.reference}
                      </Link>
                      <time
                        className="mt-1 block text-xs text-zinc-500"
                        dateTime={order.placed_at}
                      >
                        Placed {orderDate(order.placed_at)}
                      </time>
                    </td>
                    <td className="max-w-64 px-5 py-4">
                      <span className="block font-medium">
                        {itemQuantity} {itemQuantity === 1 ? 'item' : 'items'}
                      </span>
                      <span
                        className="mt-1 block truncate text-xs text-zinc-600 dark:text-zinc-400"
                        title={itemSummary || 'Item snapshot unavailable'}
                      >
                        {itemSummary || 'Item snapshot unavailable'}
                      </span>
                    </td>
                    <td className="px-5 py-4"><OrderStatus status={order.status} /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-zinc-600 dark:text-zinc-400">
                      <time dateTime={order.latest_activity_at}>
                        {orderDate(order.latest_activity_at)}
                      </time>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums">
                      {orderMoney(order.totals.payable, order.totals.currency)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <Link
                        aria-label={`${approval ? 'Review' : 'View'} order ${order.reference}`}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-[#4C1268] underline-offset-4 hover:bg-[#F1EAF4] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:text-purple-300 dark:hover:bg-purple-300/10"
                        state={{ backTo: approval ? '/orders/approval' : '/orders/monitoring' }}
                        to={`/orders/${order.id}`}
                      >
                        {approval ? 'Review' : 'View order'}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function OrderStatus({ status }: { status: string }) {
  const outcome = ['delivered', 'picked_up', 'returned'].includes(status)
    ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-200'
    : ['rejected', 'cancelled', 'delivery_failed'].includes(status)
      ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200'
      : ['placed', 'seller_processing', 'ready_for_pickup'].includes(status)
        ? 'border-[#D9C6E2] bg-[#F7F1FA] text-[#4C1268] dark:border-purple-300/20 dark:bg-purple-300/10 dark:text-purple-200'
        : 'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300'

  return (
    <span className={`inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-medium ${outcome}`}>
      {orderStatusLabel(status)}
    </span>
  )
}

export function OrderPagination({ currentPage, lastPage, total, onPage }: {
  currentPage: number
  lastPage: number
  total: number
  onPage: (page: number) => void
}) {
  return (
    <nav
      aria-label="Result pages"
      className="flex flex-wrap items-center justify-between gap-3 px-1 py-4 text-sm"
    >
      <p className="text-zinc-600 dark:text-zinc-400">
        Page <span className="font-semibold text-zinc-900 dark:text-zinc-100">{currentPage}</span>
        {' '}of {lastPage} <span className="mx-1">·</span> {total} results
      </p>
      <div className="flex gap-2">
        <OrderButton disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>
          Previous
        </OrderButton>
        <OrderButton disabled={currentPage >= lastPage} onClick={() => onPage(currentPage + 1)}>
          Next
        </OrderButton>
      </div>
    </nav>
  )
}
