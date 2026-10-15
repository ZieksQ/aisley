import { Link } from 'react-router-dom'
import { CourierOrderContact } from '../courier-messages/CourierOrderContact'
import { orderLink, orderPanel } from './OrderUi'
import { orderDate, orderMoney, type SellerOrder } from '../../types/orders'

export function OrderDetailSidebar({ order }: { order: SellerOrder }) {
  return (
    <aside className="space-y-5">
      <section className={`${orderPanel} p-5`} aria-labelledby="shipping-provider">
        <h2 className="font-semibold" id="shipping-provider">Shipping provider</h2>
        {order.shipping_provider ? (
          <>
            <p className="mt-3 text-sm font-medium">{order.shipping_provider.business_name}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Selected by the Customer at checkout and locked for this Order.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            No checkout provider is attached to this Order.
          </p>
        )}
      </section>

      <DeliveryAddress address={order.delivery_address} />
      <PaymentSummary order={order} />
      <WaybillSummary order={order} />
      <CourierOrderContact key={order.id} orderId={order.id} />
    </aside>
  )
}

function DeliveryAddress({ address }: { address: SellerOrder['delivery_address'] }) {
  return (
    <section className={`${orderPanel} p-5`} aria-labelledby="delivery-address">
      <h2 className="font-semibold" id="delivery-address">Delivery address</h2>
      {address ? (
        <address className="mt-3 space-y-1 text-sm not-italic leading-6">
          <p className="font-medium">{address.recipient_name}</p>
          <p>{address.contact_number}</p>
          <p>{[address.address_line_1, address.address_line_2].filter(Boolean).join(', ')}</p>
          <p>{[
            address.barangay,
            address.city_municipality,
            address.province,
            address.region,
            address.postal_code,
            address.country,
          ].filter(Boolean).join(', ')}</p>
        </address>
      ) : (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Address snapshot unavailable.
        </p>
      )}
    </section>
  )
}

function PaymentSummary({ order }: { order: SellerOrder }) {
  const rows = [
    ['Items', order.totals.merchandise_subtotal],
    ['Shipping', order.totals.shipping_fee],
    ['Discount', String(-Number(order.totals.discount))],
    ['Shipping discount', String(-Number(order.totals.shipping_discount))],
    ['Total', order.totals.payable],
  ] as const

  return (
    <section className={`${orderPanel} p-5`} aria-labelledby="order-total">
      <h2 className="font-semibold" id="order-total">Payment summary</h2>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map(([label, amount]) => (
          <div
            className="flex justify-between gap-3 last:border-t last:border-zinc-200 last:pt-3 last:font-semibold dark:last:border-white/10"
            key={label}
          >
            <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
            <dd className="tabular-nums">{orderMoney(amount, order.totals.currency)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function WaybillSummary({ order }: { order: SellerOrder }) {
  return (
    <section className={`${orderPanel} p-5`} aria-labelledby="waybill-title">
      <h2 className="font-semibold" id="waybill-title">Waybill</h2>
      {order.waybill ? (
        <>
          <p className="mt-3 text-xs text-zinc-500">Tracking ID</p>
          <p className="mt-1 break-all text-sm font-semibold">
            {order.waybill.tracking_id ?? order.waybill.reference}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Code 128 barcode · Created {orderDate(order.waybill.created_at)}
          </p>
          {order.pickup?.request_id && (
            <Link
              className={`${orderLink} mt-2 inline-flex min-h-11 items-center text-sm`}
              to={`/orders/pickup/${order.pickup.request_id}`}
            >
              Open pickup parcels
            </Link>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          The waybill is created when you request pickup from the locked provider.
        </p>
      )}
    </section>
  )
}
