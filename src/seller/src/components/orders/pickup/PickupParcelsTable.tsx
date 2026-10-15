import { PortalTable } from '@aisley/ui/portal'
import { FaArrowRight, FaDownload, FaEye, FaPrint } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { OrderButton, orderLink } from '../OrderUi'
import { OrderStatus } from '../OrdersTable'
import { orderDate, orderMoney, type SellerOrder } from '../../../types/orders'

export type PrintWaybill = (
  path: string, key: string, mode: 'preview' | 'download' | 'print', filename: string,
) => Promise<void>

export function PickupParcelsTable({ backTo, orders, pdfBusy, printPdf }: {
  backTo: string
  orders: SellerOrder[]
  pdfBusy: string
  printPdf: PrintWaybill
}) {
  return (
    <PortalTable density="compact" label="Orders and waybills in this pickup request">
      <thead>
        <tr>
          <th scope="col">Order</th><th scope="col">Purchased items</th><th scope="col">Status</th>
          <th scope="col">Tracking ID</th><th className="portal-number" scope="col">Total</th>
          <th className="portal-row-action" scope="col">Waybill and details</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => {
          const summary = order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')
          return (
            <tr key={order.id}>
              <th scope="row">
                <Link className={`${orderLink} order-identifier`} state={{ backTo }} to={`/orders/${order.id}`}>{order.reference}</Link>
                <time className="portal-table-meta" dateTime={order.placed_at}>{orderDate(order.placed_at)}</time>
              </th>
              <td className="order-cell-items"><span title={summary}>{summary || 'Snapshot unavailable'}</span></td>
              <td><OrderStatus status={order.status} /></td>
              <td className="max-w-40 break-all font-mono text-xs!">
                {order.waybill?.tracking_id ?? order.waybill?.reference ?? 'Unavailable'}
              </td>
              <td className="portal-number font-semibold!">{orderMoney(order.totals.payable, order.totals.currency)}</td>
              <td>
                <div className="flex justify-end gap-1">
                  {order.waybill ? (
                    <WaybillActions order={order} busy={pdfBusy} printPdf={printPdf} />
                  ) : <span className="portal-secondary self-center text-xs">Waybill unavailable</span>}
                  <Link className="portal-button portal-button-ghost" aria-label={`Open order details for ${order.reference}`}
                    state={{ backTo }} to={`/orders/${order.id}`}>Details<FaArrowRight aria-hidden="true" /></Link>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </PortalTable>
  )
}

function WaybillActions({ order, busy, printPdf }: { order: SellerOrder; busy: string; printPdf: PrintWaybill }) {
  const waybill = order.waybill!
  const actions = [
    { mode: 'preview', label: 'Preview', icon: <FaEye aria-hidden="true" /> },
    { mode: 'download', label: 'Download', icon: <FaDownload aria-hidden="true" /> },
    { mode: 'print', label: 'Print', icon: <FaPrint aria-hidden="true" /> },
  ] as const
  return actions.map((action) => (
    <OrderButton key={action.mode} variant="ghost" className="w-11 px-0!"
      aria-label={`${action.label} ${waybill.reference}`} title={`${action.label} waybill`}
      disabled={Boolean(busy)} isLoading={busy === `${order.id}:${action.mode}`} loadingLabel="…"
      onClick={() => void printPdf(waybill.pdf_url, order.id, action.mode, `waybill-${waybill.reference}.pdf`)}>
      {action.icon}
    </OrderButton>
  ))
}
