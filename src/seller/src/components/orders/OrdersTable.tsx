import { PortalPagination, PortalTable } from '@aisley/ui/portal'
import { FaArrowRight } from 'react-icons/fa6'
import { Link, useLocation } from 'react-router-dom'
import { pickingSheetLimit } from '../../lib/useOrderPickingSheet'
import { orderDate, orderMoney, orderStatusLabel, type SellerOrder } from '../../types/orders'
import { orderLink, orderPanel } from './OrderUi'

export function OrdersTable({ orders, empty, approval = false, selection }: {
  orders: SellerOrder[]
  empty: string
  approval?: boolean
  selection?: {
    selectedIds: Set<string>
    onToggle: (ids: string[]) => void
    disabled: boolean
  }
}) {
  const location = useLocation()
  const backTo = `${location.pathname}${location.search}`
  if (!orders.length) return <p className={`${orderPanel} order-empty`}>{empty}</p>
  const pageIds = orders.map((order) => order.id)
  const selectedOnPage = selection ? pageIds.filter((id) => selection.selectedIds.has(id)).length : 0
  const allSelected = selectedOnPage === orders.length
  const pageExceedsLimit = selection
    ? selection.selectedIds.size + orders.length - selectedOnPage > pickingSheetLimit : false

  return (
    <PortalTable density="compact" label={approval ? 'Orders awaiting approval' : 'Order monitoring results'}>
      <thead>
        <tr>
          {selection && (
            <th className="order-selection-cell" scope="col">
              <label className="order-print-checkbox">
                <input type="checkbox" aria-label="Select all orders on this page"
                  ref={(input) => { if (input) input.indeterminate = selectedOnPage > 0 && !allSelected }}
                  checked={allSelected} disabled={selection.disabled || (!allSelected && pageExceedsLimit)}
                  onChange={() => selection.onToggle(pageIds)} />
              </label>
            </th>
          )}
          <th scope="col">Order</th><th scope="col">Purchased items</th><th scope="col">Status</th>
          <th scope="col">Last activity</th><th className="portal-number" scope="col">Total</th>
          <th className="portal-row-action" scope="col">Action</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => {
          const itemSummary = order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')
          const quantity = order.items.reduce((total, item) => total + item.quantity, 0)
          return (
            <tr key={order.id} aria-selected={selection ? selection.selectedIds.has(order.id) : undefined}>
              {selection && (
                <td className="order-selection-cell">
                  <label className="order-print-checkbox">
                    <input type="checkbox" aria-label={`Select order ${order.reference}`}
                      checked={selection.selectedIds.has(order.id)}
                      disabled={selection.disabled || (!selection.selectedIds.has(order.id) && selection.selectedIds.size >= pickingSheetLimit)}
                      onChange={() => selection.onToggle([order.id])} />
                  </label>
                </td>
              )}
              <th scope="row">
                <Link className={`${orderLink} order-identifier`} state={{ backTo }} to={`/orders/${order.id}`}>
                  {order.reference}
                </Link>
                <time className="portal-table-meta" dateTime={order.placed_at}>{orderDate(order.placed_at)}</time>
              </th>
              <td className="order-cell-items">
                <span title={itemSummary}>{itemSummary || 'Snapshot unavailable'}</span>
                <span className="portal-table-meta">{quantity} {quantity === 1 ? 'item' : 'items'}</span>
              </td>
              <td><OrderStatus status={order.status} /></td>
              <td className="whitespace-nowrap">
                <time className="portal-secondary text-xs" dateTime={order.latest_activity_at}>{orderDate(order.latest_activity_at)}</time>
              </td>
              <td className="portal-number font-semibold!">{orderMoney(order.totals.payable, order.totals.currency)}</td>
              <td className="portal-row-action">
                <Link className="portal-button portal-button-ghost order-row-action"
                  aria-label={`${approval ? 'Review' : 'View'} order ${order.reference}`}
                  state={{ backTo }} to={`/orders/${order.id}`}>
                  {approval ? 'Review order' : 'View order'}<FaArrowRight aria-hidden="true" />
                </Link>
              </td>
            </tr>
          )
        })}
      </tbody>
    </PortalTable>
  )
}

export function OrderStatus({ status }: { status: string }) {
  const tone = status === 'delivered' ? 'success'
    : ['rejected', 'cancelled', 'delivery_failed'].includes(status) ? 'danger'
      : ['placed', 'seller_processing', 'ready_for_pickup'].includes(status) ? 'brand' : ''
  return <span className={`portal-tag ${tone ? `portal-tag-${tone}` : ''}`}>{orderStatusLabel(status)}</span>
}

export function OrderPagination({ currentPage, lastPage, total, onPage, disabled }: {
  currentPage: number
  lastPage: number
  total: number
  onPage: (page: number) => void
  disabled?: boolean
}) {
  return <PortalPagination page={currentPage} lastPage={lastPage} total={total} onPage={onPage} disabled={disabled} />
}
