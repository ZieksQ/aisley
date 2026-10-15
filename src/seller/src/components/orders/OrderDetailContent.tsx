import { Link } from 'react-router-dom'
import { OrderStatus } from './OrdersTable'
import { orderLink, orderPanel } from './OrderUi'
import { OrderDetailSidebar } from './OrderDetailSidebar'
import { orderDate, orderMoney, orderStatusLabel, type SellerOrder } from '../../types/orders'

export function OrderDetailContent({ order, preparation }: {
  order: SellerOrder
  preparation: boolean
}) {
  return (
    <>
      <OrderStateSummary order={order} preparation={preparation} />
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-5">
          <PurchasedItems items={order.items} />
          <OrderHistory events={order.status_history} />
        </div>
        <OrderDetailSidebar order={order} />
      </div>
    </>
  )
}

function OrderStateSummary({ order, preparation }: {
  order: SellerOrder
  preparation: boolean
}) {
  const itemQuantity = order.items.reduce((total, item) => total + item.quantity, 0)
  const itemLineCount = order.items.length

  return (
    <section className={`${orderPanel} mt-5 overflow-hidden`} aria-labelledby="order-state">
      <h2 className="sr-only" id="order-state">Current order status and payment</h2>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatus status={order.status} />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {order.payment.method === 'cod' ? 'Cash on delivery' : order.payment.method}
            {' · '}Payment {order.payment.status}
          </span>
        </div>
        {order.capabilities.can_approve && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            COD payment remains pending until delivery.
          </p>
        )}
      </div>

      <dl className="grid divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-white/10">
        <OrderFact label="Placed" value={orderDate(order.placed_at)} />
        <OrderFact
          label="Items"
          value={`${itemQuantity} across ${itemLineCount} ${itemLineCount === 1 ? 'line' : 'lines'}`}
        />
        <OrderFact label="Order total" value={orderMoney(order.totals.payable, order.totals.currency)} />
      </dl>

      {order.capabilities.can_approve && (
        <p className="border-t border-zinc-200 bg-[#F7F1FA] px-5 py-3 text-sm text-[#3D0E54] dark:border-white/10 dark:bg-purple-300/5 dark:text-purple-100">
          Approval starts fulfillment and ends the customer’s normal cancellation window. Rejection releases this order’s reserved inventory.
        </p>
      )}
      {!order.capabilities.can_approve && !order.capabilities.can_prepare && (
        <p className="border-t border-zinc-200 px-5 py-3 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
          No approval or preparation action is available in this state.
        </p>
      )}
      {preparation && <PreparationNote order={order} />}
    </section>
  )
}

function PreparationNote({ order }: { order: SellerOrder }) {
  return (
    <div className="border-t border-zinc-200 px-5 py-4 dark:border-white/10">
      <h2 className="font-medium">
        {order.capabilities.can_prepare ? 'Ready to pack' : 'Preparation unavailable'}
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {order.capabilities.can_prepare
          ? `Review and seal the items below. The pickup provider is locked to ${order.shipping_provider?.business_name ?? 'the Customer checkout selection'}.`
          : 'Return to the order to review its current status and available actions.'}
      </p>
      <Link className={`${orderLink} mt-2 inline-flex min-h-11 items-center text-sm`} to="/inventory">
        Review inventory
      </Link>
    </div>
  )
}

function PurchasedItems({ items }: { items: SellerOrder['items'] }) {
  return (
    <section className={`${orderPanel} overflow-hidden`} aria-labelledby="purchased-items">
      <div className="border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <h2 className="font-semibold" id="purchased-items">Purchased items</h2>
        <p className="mt-1 text-xs text-zinc-500">Frozen at checkout for packing and order history.</p>
      </div>
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[660px] text-left text-sm">
            <caption className="sr-only">Purchased order items</caption>
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 dark:bg-white/[0.035] dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3" scope="col">Item</th>
                <th className="px-5 py-3 text-right" scope="col">Qty</th>
                <th className="px-5 py-3 text-right" scope="col">Unit price</th>
                <th className="px-5 py-3 text-right" scope="col">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {item.selected_options.length
                        ? item.selected_options.map((option) => `${option.group}: ${option.value}`).join(' · ')
                        : item.variant_name ?? 'Standard item'}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-zinc-500">
                      SKU: {item.sku ?? 'Not recorded'}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">{item.quantity}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums">
                    {orderMoney(item.unit_price, item.currency)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums">
                    {orderMoney(item.line_subtotal, item.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-5 text-sm text-zinc-600 dark:text-zinc-400">
          Purchased item details are unavailable.
        </p>
      )}
    </section>
  )
}

function OrderHistory({ events }: { events: SellerOrder['status_history'] }) {
  return (
    <section className={`${orderPanel} p-5`} aria-labelledby="order-history">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-semibold" id="order-history">Order history</h2>
          <p className="mt-1 text-xs text-zinc-500">Recorded status changes</p>
        </div>
        <span className="text-xs text-zinc-500">
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      {events.length ? (
        <ol className="mt-5 space-y-0">
          {events.map((event, index) => (
            <li className="relative flex gap-3 pb-5 last:pb-0" key={event.id}>
              <span
                aria-hidden="true"
                className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border text-[9px] ${index === events.length - 1
                  ? 'border-[#4C1268] bg-[#F1EAF4] text-[#4C1268] dark:border-purple-300 dark:bg-purple-300/10 dark:text-purple-200'
                  : 'border-zinc-300 bg-white text-zinc-500 dark:border-white/20 dark:bg-[#18181b]'}`}
              >
                •
              </span>
              {index < events.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-[9px] top-6 border-l border-zinc-200 dark:border-white/10"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-wrap justify-between gap-2">
                <span className="text-sm font-medium">{orderStatusLabel(event.to_status)}</span>
                <time
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                  dateTime={event.occurred_at}
                >
                  {orderDate(event.occurred_at)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No status changes are recorded.
        </p>
      )}
    </section>
  )
}

export function OrderDetailLoading() {
  return (
    <div aria-label="Loading order details" className="mt-5 animate-pulse space-y-4" role="status">
      <div className="h-32 rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
        <div className="h-80 rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" />
        <div className="h-80 rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" />
      </div>
      <span className="sr-only">Loading order details…</span>
    </div>
  )
}

function OrderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
