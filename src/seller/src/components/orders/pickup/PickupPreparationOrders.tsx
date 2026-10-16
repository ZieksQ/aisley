import { PortalTable } from '@aisley/ui/portal'
import { FaArrowRight } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { OrderStatus } from '../OrdersTable'
import { OrderButton, orderLink } from '../OrderUi'
import { orderMoney, type SellerOrder } from '../../../types/orders'
import type { ProviderOrderGroup } from './pickupUtils'

export function PickupPreparationOrders({ groups, selectedIds, selectedProviderId, onSelectGroup, onToggleOrder }: {
  groups: ProviderOrderGroup[]
  selectedIds: string[]
  selectedProviderId: string | null
  onSelectGroup: (orders: SellerOrder[]) => void
  onToggleOrder: (order: SellerOrder) => void
}) {
  return (
    <div className="divide-y divide-[var(--portal-border)]">
      {groups.map((group) => {
        const locked = Boolean(selectedProviderId && group.provider?.id !== selectedProviderId)
        const groupSelected = group.orders.every((order) => selectedIds.includes(order.id))
        return (
          <section className="order-table-wrap" aria-labelledby={`provider-${group.key}`} key={group.key}>
            <div className="order-section-heading">
              <div>
                <h3 id={`provider-${group.key}`}>{group.provider?.business_name ?? 'Provider unavailable'}</h3>
                <p>{group.orders.length} {group.orders.length === 1 ? 'order' : 'orders'} · Checkout-selected provider</p>
              </div>
              {group.provider && (
                <OrderButton disabled={locked} onClick={() => onSelectGroup(group.orders)}>
                  {groupSelected ? 'Clear group' : 'Select all'}
                </OrderButton>
              )}
            </div>
            <PortalTable density="compact" label={`Orders for ${group.provider?.business_name ?? 'an unavailable provider'}`}>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Select order</span></th>
                  <th scope="col">Order and purchased items</th><th scope="col">Status</th>
                  <th className="portal-number" scope="col">Total</th><th className="portal-row-action" scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {group.orders.map((order) => (
                  <PreparationOrderRow checked={selectedIds.includes(order.id)} disabled={locked || !order.shipping_provider}
                    key={order.id} order={order} onToggle={onToggleOrder} />
                ))}
              </tbody>
            </PortalTable>
            {locked && <p className="portal-secondary px-4 py-2 text-xs">Clear your selection before choosing this provider.</p>}
          </section>
        )
      })}
    </div>
  )
}

function PreparationOrderRow({ checked, disabled, order, onToggle }: {
  checked: boolean
  disabled: boolean
  order: SellerOrder
  onToggle: (order: SellerOrder) => void
}) {
  const summary = order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')
  return (
    <tr>
      <td className="w-14 px-1!">
        <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
          <input aria-label={`Select ${order.reference}`} checked={checked} className="size-4 accent-[var(--portal-accent)]"
            disabled={disabled} onChange={() => onToggle(order)} type="checkbox" />
        </label>
      </td>
      <th scope="row" className="order-cell-items">
        <Link className={`${orderLink} order-identifier`} to={`/orders/${order.id}/prepare`}>{order.reference}</Link>
        <span className="portal-table-meta block max-w-80 truncate" title={summary}>{summary}</span>
      </th>
      <td><OrderStatus status={order.status} /></td>
      <td className="portal-number font-semibold!">{orderMoney(order.totals.payable, order.totals.currency)}</td>
      <td className="portal-row-action">
        <Link className="portal-button portal-button-ghost order-row-action"
          aria-label={`Review order ${order.reference}`} to={`/orders/${order.id}/prepare`}>
          Review order<FaArrowRight aria-hidden="true" />
        </Link>
      </td>
    </tr>
  )
}
