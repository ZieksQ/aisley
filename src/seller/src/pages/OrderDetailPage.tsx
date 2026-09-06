import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { OrderButton, OrderError, orderLink, orderPanel } from '../components/orders/OrderUi'
import { ApiError } from '../lib/api'
import { createOrderAcceptance, markOrderNotificationRead } from '../lib/sellerOrderActions'
import { useOrderAccessError, useSellerOrders } from '../lib/useSellerOrders'
import { orderDate, orderMoney, orderStatusLabel, type SellerOrder } from '../types/orders'

export function OrderDetailPage({ preparation = false }: { preparation?: boolean }) {
  const { orderId = '' } = useParams()
  return <OrderDetail key={`${orderId}-${preparation}`} orderId={orderId} preparation={preparation} />
}

function OrderDetail({ orderId, preparation }: { orderId: string; preparation: boolean }) {
  const { seller } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const accessError = useOrderAccessError()
  const { data, loading, error, refresh } = useSellerOrders<{ data: SellerOrder }>(`/api/v1/seller/orders/${encodeURIComponent(orderId)}`)
  const order = data?.data
  const [actionError, setActionError] = useState('')
  const [readError, setReadError] = useState('')
  const [readId, setReadId] = useState('')
  const [readRetry, setReadRetry] = useState(0)
  const [accepting, setAccepting] = useState(false)
  const submitting = useRef(false)
  const acceptance = useRef<ReturnType<typeof createOrderAcceptance> | null>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => { document.title = `${preparation ? 'Prepare order' : 'Order'}${order ? ` ${order.reference}` : ''} | Aisley Seller` }, [order, preparation])

  const notificationId = order?.notification?.id
  const notificationReadAt = order?.notification?.read_at
  useEffect(() => {
    if (!notificationId || notificationReadAt || readId === notificationId) return
    const controller = new AbortController()
    async function markRead() {
      try {
        await markOrderNotificationRead(notificationId!, controller.signal)
        if (!controller.signal.aborted) { setReadId(notificationId!); setReadError('') }
      } catch (reason) {
        if (!controller.signal.aborted && !accessError(reason)) setReadError('The order is open, but its notification could not be marked as read.')
      }
    }
    void markRead()
    return () => controller.abort()
  }, [notificationId, notificationReadAt, readId, readRetry, accessError])

  async function accept() {
    if (submitting.current || !order?.capabilities.can_accept || error || loading) return
    submitting.current = true
    setAccepting(true)
    setActionError('')
    try {
      acceptance.current ??= createOrderAcceptance(seller!.id, orderId)
      const response = await acceptance.current()
      if (!alive.current) return
      confirmation.current?.close()
      if (response.data.capabilities.can_prepare) navigate(`/orders/${orderId}/prepare`, { replace: true, state: { accepted: true } })
      else refresh()
    } catch (reason) {
      if (!alive.current || accessError(reason)) return
      confirmation.current?.close()
      if (reason instanceof ApiError && reason.status === 409) {
        setActionError(`${reason.message} The order is being refreshed; review its current status before trying again.`)
        refresh()
      } else {
        setActionError(reason instanceof ApiError ? reason.message : 'Acceptance could not be confirmed. Refresh to check the order, or retry safely with the same request.')
      }
    } finally {
      submitting.current = false
      if (alive.current) setAccepting(false)
    }
  }

  const backTo = typeof location.state?.backTo === 'string' && /^\/orders\?/.test(location.state.backTo) ? location.state.backTo : '/orders'
  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <Link className={`${orderLink} text-sm`} to={preparation ? `/orders/${orderId}` : backTo}>{preparation ? 'Back to order' : 'Back to orders'}</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
      <div><h2 className="break-all text-xl font-semibold sm:text-2xl">{preparation ? 'Prepare order' : 'Order details'}</h2>{order && <p className="mt-1 break-all text-sm text-zinc-600 dark:text-zinc-400">{order.reference} · Placed {orderDate(order.placed_at)}</p>}</div>
      <OrderButton disabled={accepting} isLoading={loading} loadingLabel="Refreshing" onClick={refresh}>Refresh</OrderButton>
    </div>
    {error && <OrderError message={error} retry={refresh} />}
    {readError && <OrderError message={readError} retry={() => setReadRetry((value) => value + 1)} />}
    {actionError && <OrderError message={actionError} retry={refresh} />}
    {!order && loading ? <p className="mt-5" role="status">Loading order…</p> : order ? <>
      <section className={`${orderPanel} my-5 p-5`} aria-labelledby="order-state">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h3 className="font-semibold" id="order-state">{orderStatusLabel(order.status)}</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{order.payment.method === 'cod' ? 'Cash on delivery' : order.payment.method} · Payment {order.payment.status}</p></div>
          {!preparation && <div className="flex flex-wrap gap-3">
            {order.capabilities.can_prepare ? <Link className={orderLink} to={`/orders/${order.id}/prepare`}>Review preparation</Link> : <OrderButton variant="secondary" disabled={!order.capabilities.can_accept || loading || !!error} isLoading={accepting} loadingLabel="Accepting order" onClick={() => confirmation.current?.showModal()}>Accept order</OrderButton>}
          </div>}
        </div>
        {location.state?.accepted && order.capabilities.can_prepare && <p role="status" className="mt-3 text-sm font-medium">Order accepted. Processing has started.</p>}
        {order.capabilities.can_accept && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Accepting starts fulfillment and ends the customer’s normal cancellation window. COD payment remains pending until delivery.</p>}
        {!order.capabilities.can_accept && !order.capabilities.can_prepare && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">This order is not available for acceptance or preparation in its current state.</p>}
        {preparation && <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-white/10">
          <h3 className="font-medium">{order.capabilities.can_prepare ? 'Package submission is not available yet' : 'Preparation unavailable'}</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{order.capabilities.can_prepare ? 'Review the purchased items below. Package details and ready-for-pickup confirmation are not available yet; this order remains in processing.' : 'Return to the order to review its current status and available actions.'}</p>
          <Link className={`${orderLink} mt-3 inline-block text-sm`} to="/inventory">Review inventory</Link>
        </div>}
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={orderPanel} aria-labelledby="purchased-items"><h3 className="border-b border-zinc-200 p-5 font-semibold dark:border-white/10" id="purchased-items">Purchased items</h3>
          <ul className="divide-y divide-zinc-200 dark:divide-white/10">{order.items.map((item) => <li className="p-5" key={item.id}>
            <h4 className="font-medium">{item.product_name}</h4>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.selected_options.length ? item.selected_options.map((option) => `${option.group}: ${option.value}`).join(' · ') : item.variant_name}</p>
            <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">SKU: {item.sku ?? 'Not recorded'}</p>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><p>{item.quantity} × {orderMoney(item.unit_price, item.currency)}</p><p className="font-medium">{orderMoney(item.line_subtotal, item.currency)}</p></div>
          </li>)}</ul>
          {!order.items.length && <p className="p-5 text-sm">Purchased item details are unavailable.</p>}
        </section>
        <div className="space-y-5">
          <section className={`${orderPanel} p-5`} aria-labelledby="delivery-address"><h3 className="font-semibold" id="delivery-address">Delivery address</h3>{order.delivery_address ? <address className="mt-3 space-y-1 text-sm not-italic leading-6"><p className="font-medium">{order.delivery_address.recipient_name}</p><p>{order.delivery_address.contact_number}</p><p>{[order.delivery_address.address_line_1, order.delivery_address.address_line_2].filter(Boolean).join(', ')}</p><p>{[order.delivery_address.barangay, order.delivery_address.city_municipality, order.delivery_address.province, order.delivery_address.region, order.delivery_address.postal_code, order.delivery_address.country].filter(Boolean).join(', ')}</p></address> : <p className="mt-3 text-sm">Address snapshot unavailable.</p>}</section>
          <section className={`${orderPanel} p-5`} aria-labelledby="order-total"><h3 className="font-semibold" id="order-total">Order total</h3><dl className="mt-3 space-y-3 text-sm">{([
            ['Items', order.totals.merchandise_subtotal], ['Shipping', order.totals.shipping_fee],
            ['Discount', String(-Number(order.totals.discount))], ['Shipping discount', String(-Number(order.totals.shipping_discount))], ['Total', order.totals.payable],
          ] as const).map(([label, amount]) => <div className="flex justify-between gap-3 last:border-t last:border-zinc-200 last:pt-3 last:font-semibold dark:last:border-white/10" key={label}><dt>{label}</dt><dd className="tabular-nums">{orderMoney(amount, order.totals.currency)}</dd></div>)}</dl></section>
          <section className={`${orderPanel} p-5`}><h3 className="font-semibold">Waybill</h3><p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Not available. Logistics generates the waybill after receiving the parcel.</p></section>
        </div>
      </div>
      <section className={`${orderPanel} mt-5 p-5`} aria-labelledby="order-history"><h3 className="font-semibold" id="order-history">Order history</h3><ol className="mt-4 space-y-4">{order.status_history.map((event) => <li className="flex flex-wrap justify-between gap-2 text-sm" key={event.id}><span>{orderStatusLabel(event.to_status)}</span><time className="text-zinc-600 dark:text-zinc-400" dateTime={event.occurred_at}>{orderDate(event.occurred_at)}</time></li>)}</ol></section>
    </> : null}
    <dialog ref={confirmation} aria-labelledby="accept-title" aria-describedby="accept-description" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-zinc-950 backdrop:bg-black/50 dark:border-white/20 dark:bg-[#18181b] dark:text-white" onCancel={(event) => { if (accepting) event.preventDefault() }}>
      <h3 id="accept-title" className="text-lg font-semibold">Accept this order?</h3><p id="accept-description" className="mt-3 text-sm leading-6">You will take responsibility for preparing {order?.reference}. The customer will no longer be able to cancel normally. Payment remains cash on delivery.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3"><OrderButton disabled={accepting} onClick={() => confirmation.current?.close()}>Keep reviewing</OrderButton><OrderButton variant="secondary" disabled={loading || !!error || !order?.capabilities.can_accept} isLoading={accepting} loadingLabel="Accepting" onClick={() => void accept()}>Confirm acceptance</OrderButton></div>
    </dialog>
  </div>
}
