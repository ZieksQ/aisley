import { Link } from 'react-router-dom'
import { OrderStatus } from '../OrdersTable'
import { OrderButton, orderLink } from '../OrderUi'
import { orderMoney, type SellerOrder } from '../../../types/orders'
import type { ProviderOrderGroup } from './pickupUtils'

export function PickupPreparationOrders({
  groups,
  selectedIds,
  selectedProviderId,
  onSelectGroup,
  onToggleOrder,
}: {
  groups: ProviderOrderGroup[]
  selectedIds: string[]
  selectedProviderId: string | null
  onSelectGroup: (orders: SellerOrder[]) => void
  onToggleOrder: (order: SellerOrder) => void
}) {
  return (
    <div className="divide-y divide-zinc-200 dark:divide-white/10">
      {groups.map((group) => {
        const lockedToAnother = Boolean(selectedProviderId && group.provider?.id !== selectedProviderId)
        const groupSelected = group.orders.every((order) => selectedIds.includes(order.id))

        return (
          <section className="p-5" aria-labelledby={`provider-group-${group.key}`} key={group.key}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium" id={`provider-group-${group.key}`}>
                  {group.provider?.business_name ?? 'Provider unavailable'}
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {group.orders.length} {group.orders.length === 1 ? 'order' : 'orders'} ·{' '}
                  {group.provider ? 'Locked by customer checkout' : 'Missing checkout provider'}
                </p>
              </div>
              {group.provider && (
                <OrderButton
                  className="min-h-11!"
                  disabled={lockedToAnother}
                  onClick={() => onSelectGroup(group.orders)}
                >
                  {groupSelected ? 'Clear group' : 'Select all'}
                </OrderButton>
              )}
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/10">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">
                  Orders prepared for {group.provider?.business_name ?? 'an unavailable provider'}
                </caption>
                <thead className="bg-zinc-50 text-xs font-semibold text-zinc-600 dark:bg-white/[0.035] dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3" scope="col">Select</th>
                    <th className="px-4 py-3" scope="col">Order and items</th>
                    <th className="px-4 py-3" scope="col">Status</th>
                    <th className="px-4 py-3 text-right" scope="col">Total</th>
                    <th className="px-4 py-3 text-right" scope="col">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                  {group.orders.map((order) => (
                    <PreparationOrderRow
                      checked={selectedIds.includes(order.id)}
                      disabled={lockedToAnother || !order.shipping_provider}
                      key={order.id}
                      order={order}
                      onToggle={onToggleOrder}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {lockedToAnother && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Clear the current selection before choosing orders assigned to this provider.
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function PreparationOrderRow({
  checked,
  disabled,
  order,
  onToggle,
}: {
  checked: boolean
  disabled: boolean
  order: SellerOrder
  onToggle: (order: SellerOrder) => void
}) {
  const itemSummary = order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')

  return (
    <tr className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.025]">
      <td className="px-4 py-3">
        <input
          aria-label={`Select ${order.reference}`}
          checked={checked}
          className="size-4 accent-[#4C1268] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]"
          disabled={disabled}
          onChange={() => onToggle(order)}
          type="checkbox"
        />
      </td>
      <th className={`max-w-[24rem] px-4 py-3 text-left font-medium ${disabled ? 'text-zinc-400' : ''}`} scope="row">
        <Link className={`${orderLink} break-all font-semibold`} to={`/orders/${order.id}/prepare`}>
          {order.reference}
        </Link>
        <span className="mt-1 block truncate text-xs font-normal text-zinc-600 dark:text-zinc-400" title={itemSummary}>
          {itemSummary}
        </span>
      </th>
      <td className="px-4 py-3"><OrderStatus status={order.status} /></td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
        {orderMoney(order.totals.payable, order.totals.currency)}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[#4C1268] underline-offset-4 hover:bg-[#F1EAF4] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:text-purple-300 dark:hover:bg-purple-300/10"
          to={`/orders/${order.id}/prepare`}
        >
          Review order
        </Link>
      </td>
    </tr>
  )
}
