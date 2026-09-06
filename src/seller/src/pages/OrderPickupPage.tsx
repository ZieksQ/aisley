import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { OrderButton, OrderError, orderLink, orderPanel } from '../components/orders/OrderUi'
import { ApiError } from '../lib/api'
import { createPickupRequest } from '../lib/sellerOrderActions'
import { useOrderAccessError, useSellerOrders } from '../lib/useSellerOrders'
import { orderDate, type SellerOrder, type SellerOrderPage } from '../types/orders'

export function OrderPickupPage() {
  const { seller } = useAuth()
  const accessError = useOrderAccessError()
  const processing = useSellerOrders<SellerOrderPage>('/api/v1/seller/orders?status=seller_processing&sort=oldest&per_page=50')
  const pending = useSellerOrders<SellerOrderPage>('/api/v1/seller/orders?status=ready_for_pickup&sort=activity_desc&per_page=50')
  const [selected, setSelected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { document.title = 'Order pickup | Aisley Seller' }, [])
  const eligible = processing.data?.data ?? []
  const pickupGroups = Object.values((pending.data?.data ?? []).reduce<Record<string, SellerOrder[]>>((groups, order) => {
    const key = order.pickup?.request_id ?? order.id
    ;(groups[key] ??= []).push(order)
    return groups
  }, {}))
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]) }
  async function submit() {
    if (!seller || selected.length === 0 || submitting) return
    setSubmitting(true); setError(''); setNotice('')
    try {
      const response = await createPickupRequest(seller.id, selected)()
      setSelected([])
      setNotice(`${response.data.order_ids.length} ${response.data.order_ids.length === 1 ? 'order is' : 'orders are'} ready for pickup. Logistics has been notified and will assign the pickup date.`)
      processing.refresh(); pending.refresh()
    } catch (reason) {
      if (!accessError(reason)) setError(reason instanceof ApiError ? reason.message : 'The pickup request could not be submitted. Refresh and try again.')
    } finally { setSubmitting(false) }
  }
  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10"><div><h2 className="text-2xl font-semibold">Order pickup</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Select prepared orders for one Logistics pickup request.</p></div><OrderButton isLoading={processing.loading || pending.loading} loadingLabel="Refreshing" onClick={() => { processing.refresh(); pending.refresh() }}>Refresh</OrderButton></div>
    <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">Logistics assignment and pickup date remain pending after submission. Selected orders stay grouped in the same request.</p>
    {error && <OrderError message={error} retry={() => { processing.refresh(); pending.refresh() }} />}{notice && <p className="my-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-200" role="status">{notice}</p>}
    <section className={`${orderPanel} mt-5`} aria-labelledby="ready-to-submit"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-5 dark:border-white/10"><div><h3 className="font-semibold" id="ready-to-submit">Prepared orders</h3><p className="mt-1 text-sm text-zinc-500">{eligible.length} available · {selected.length} selected</p></div><OrderButton variant="secondary" disabled={!selected.length} isLoading={submitting} loadingLabel="Notifying Logistics" onClick={() => void submit()}>Request pickup</OrderButton></div>
      {processing.error ? <div className="px-5"><OrderError message={processing.error} retry={processing.refresh} /></div> : eligible.length === 0 ? <p className="p-5 text-sm text-zinc-600 dark:text-zinc-400">Approved orders appear here while they are being prepared.</p> : <ul className="divide-y divide-zinc-200 dark:divide-white/10">{eligible.map((order) => <SelectableOrder checked={selected.includes(order.id)} key={order.id} order={order} toggle={toggle} />)}</ul>}
    </section>
    <section className={`${orderPanel} mt-5`} aria-labelledby="pending-pickup"><div className="border-b border-zinc-200 p-5 dark:border-white/10"><h3 className="font-semibold" id="pending-pickup">Pending Logistics pickup</h3></div>{pending.error ? <div className="px-5"><OrderError message={pending.error} retry={pending.refresh} /></div> : pickupGroups.length === 0 ? <p className="p-5 text-sm text-zinc-600 dark:text-zinc-400">No pickup requests are pending.</p> : <div className="divide-y divide-zinc-200 dark:divide-white/10">{pickupGroups.map((orders) => <section className="p-5" key={orders[0].pickup?.request_id ?? orders[0].id}><div className="flex flex-wrap justify-between gap-3 text-sm"><div><h4 className="font-medium">Pickup request · {orders.length} {orders.length === 1 ? 'order' : 'orders'}</h4><p className="mt-1 text-zinc-500">Submitted {orderDate(orders[0].latest_activity_at)}</p></div><div className="sm:text-right"><p>{orders[0].pickup?.pickup_date ? `Pickup ${orders[0].pickup.pickup_date}` : 'Pickup date pending'}</p><p className="mt-1 text-zinc-500">{orders[0].pickup?.logistics_organization_id ? 'Logistics assigned' : 'Logistics assignment pending'}</p></div></div><ul className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">{orders.map((order) => <li className="py-3 text-sm" key={order.id}><Link className={orderLink} to={`/orders/${order.id}`}>{order.reference}</Link></li>)}</ul></section>)}</div>}</section>
  </div>
}

function SelectableOrder({ order, checked, toggle }: { order: SellerOrder; checked: boolean; toggle: (id: string) => void }) {
  return <li className="flex gap-3 p-5"><input className="mt-1 size-4 accent-[#4C1268]" type="checkbox" id={`pickup-${order.id}`} checked={checked} onChange={() => toggle(order.id)} /><label className="min-w-0 flex-1" htmlFor={`pickup-${order.id}`}><span className="font-medium">{order.reference}</span><span className="mt-1 block truncate text-sm text-zinc-600 dark:text-zinc-400">{order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')}</span></label><Link className={`${orderLink} text-sm`} to={`/orders/${order.id}/prepare`}>Review</Link></li>
}
