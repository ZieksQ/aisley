import { useState } from 'react'
import { FaDownload, FaEye, FaPrint } from 'react-icons/fa6'
import { Link, useLocation, useParams } from 'react-router-dom'
import { OrderButton, OrderError, orderLink, orderPanel } from '../components/orders/OrderUi'
import { OrderStatus } from '../components/orders/OrdersTable'
import { ApiError } from '../lib/api'
import { useOrderAccessError, useSellerOrders } from '../lib/useSellerOrders'
import { openWaybillPdf } from '../lib/waybillPdf'
import { orderDate, orderMoney, type SellerOrderPage } from '../types/orders'
import type { SellerPickupRequestResponse } from '../types/pickupRequests'
import { PickupStatus } from './PickupRequestsTable'

export function PickupParcelPage() {
  const { pickupId = '' } = useParams()
  return <PickupParcel key={pickupId} pickupId={pickupId} />
}

function PickupParcel({ pickupId }: { pickupId: string }) {
  const location = useLocation()
  const accessError = useOrderAccessError()
  const encodedId = encodeURIComponent(pickupId)
  const request = useSellerOrders<SellerPickupRequestResponse>(
    `/api/v1/seller/pickup-requests/${encodedId}`,
  )
  const orderPage = useSellerOrders<SellerOrderPage>(
    `/api/v1/seller/orders?pickup_request_id=${encodedId}&sort=oldest&per_page=50`,
  )
  const [pdfBusy, setPdfBusy] = useState('')
  const [pdfError, setPdfError] = useState('')
  const pickup = request.data?.data
  const orders = orderPage.data?.data ?? []
  const backTo = typeof location.state?.backTo === 'string'
    && location.state.backTo.startsWith('/orders/pickup')
    ? location.state.backTo
    : '/orders/pickup'

  async function printPdf(
    path: string,
    key: string,
    mode: 'preview' | 'download' | 'print',
    filename: string,
  ) {
    setPdfBusy(`${key}:${mode}`)
    setPdfError('')
    try {
      const pdfPath = mode === 'download'
        ? path
        : `${path}${path.includes('?') ? '&' : '?'}disposition=inline`
      await openWaybillPdf(pdfPath, mode, filename)
    } catch (reason) {
      if (accessError(reason)) return
      setPdfError(reason instanceof ApiError
        ? reason.message
        : 'The waybill could not be opened. Allow pop-ups for preview or print, then try again.')
    } finally {
      setPdfBusy('')
    }
  }

  function refresh() {
    request.refresh()
    orderPage.refresh()
  }

  const canPrintAll = orders.length > 0
    && orders.length <= 30
    && orders.every((order) => order.waybill !== null)
  const requestBusy = request.loading || orderPage.loading
  const backToParcels = `${location.pathname}${location.search}`

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className={`${orderLink} inline-flex min-h-11 items-center text-sm`} to={backTo}>
          ← Back to pickup requests
        </Link>
        <OrderButton isLoading={requestBusy} loadingLabel="Refreshing" onClick={refresh}>
          Refresh
        </OrderButton>
      </div>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4C1268] dark:text-purple-300">
            Order pickup
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Pickup parcels
          </h1>
          <p className="mt-2 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
            Pickup ID · {pickupId}
          </p>
        </div>
        {pickup && (
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:border-white/20 dark:hover:bg-white/5"
              to={`/logistics-messages?pickup_request_id=${pickup.id}`}
            >
              Contact Logistics
            </Link>
            {canPrintAll && (
              <OrderButton
                className="min-h-11!"
                isLoading={pdfBusy === `${pickupId}:print`}
                loadingLabel="Opening labels"
                onClick={() => void printPdf(
                  `/api/v1/seller/pickup-requests/${encodedId}/waybills.pdf`,
                  pickupId,
                  'print',
                  `pickup-waybills-${pickupId}.pdf`,
                )}
              >
                <FaPrint aria-hidden="true" />
                Print all waybills
              </OrderButton>
            )}
          </div>
        )}
      </header>

      {request.error && <OrderError message={request.error} retry={request.refresh} />}
      {orderPage.error && <OrderError message={orderPage.error} retry={orderPage.refresh} />}
      {pdfError && (
        <div className="my-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">
          <p>{pdfError}</p>
          <OrderButton className="mt-3" onClick={() => setPdfError('')}>Dismiss</OrderButton>
        </div>
      )}

      {requestBusy && !pickup ? (
        <PickupParcelLoading />
      ) : pickup ? (
        <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Pickup request summary">
            <Summary label="Logistics provider" value={pickup.provider?.business_name ?? 'Provider unavailable'} />
            <Summary label="Parcels in request" value={String(pickup.order_count)} />
            <div className={`${orderPanel} p-4`}>
              <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Request status</dt>
              <dd className="mt-2"><PickupStatus status={pickup.status} /></dd>
            </div>
            <Summary label="Pickup date" value={formatPickupDate(pickup.pickup_date)} />
          </dl>

          {orders.length > 30 && (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
              Bulk printing supports 30 labels per request. Print each parcel’s waybill from its row.
            </p>
          )}

          <section className={`${orderPanel} mt-6 overflow-hidden`} aria-labelledby="pickup-parcels-title">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
              <div>
                <h2 className="text-lg font-semibold" id="pickup-parcels-title">Orders in this pickup</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Each order keeps its own parcel and waybill.
                </p>
              </div>
              <p className="text-xs tabular-nums text-zinc-500">
                {pickup.order_count} {pickup.order_count === 1 ? 'parcel' : 'parcels'}
              </p>
            </div>

            {orderPage.loading && !orderPage.data ? (
              <PickupParcelLoading />
            ) : orderPage.error && !orderPage.data ? null : orders.length ? (
              <ParcelsTable
                backTo={backToParcels}
                orders={orders}
                pdfBusy={pdfBusy}
                printPdf={printPdf}
              />
            ) : (
              <p className="px-5 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
                No orders are linked to this pickup request.
              </p>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

function ParcelsTable({
  backTo,
  orders,
  pdfBusy,
  printPdf,
}: {
  backTo: string
  orders: SellerOrderPage['data']
  pdfBusy: string
  printPdf: (
    path: string,
    key: string,
    mode: 'preview' | 'download' | 'print',
    filename: string,
  ) => Promise<void>
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <caption className="sr-only">Orders and waybills in this pickup request</caption>
        <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-white/[0.035] dark:text-zinc-400">
          <tr>
            <th className="px-5 py-3" scope="col">Order</th>
            <th className="px-5 py-3" scope="col">Items</th>
            <th className="px-5 py-3" scope="col">Status</th>
            <th className="px-5 py-3" scope="col">Tracking ID</th>
            <th className="px-5 py-3 text-right" scope="col">Total</th>
            <th className="px-5 py-3 text-right" scope="col">Waybill and details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
          {orders.map((order) => {
            const itemQuantity = order.items.reduce((total, item) => total + item.quantity, 0)
            const itemSummary = order.items
              .map((item) => `${item.quantity} × ${item.product_name}`)
              .join(', ')

            return (
              <tr
                className="transition-colors hover:bg-zinc-50/80 dark:hover:bg-white/[0.025]"
                key={order.id}
              >
                <th className="px-5 py-4 font-medium" scope="row">
                  <Link
                    className={`${orderLink} break-all font-semibold`}
                    state={{ backTo }}
                    to={`/orders/${order.id}`}
                  >
                    {order.reference}
                  </Link>
                  <time
                    className="mt-1 block text-xs font-normal text-zinc-500"
                    dateTime={order.placed_at}
                  >
                    Placed {orderDate(order.placed_at)}
                  </time>
                </th>
                <td className="max-w-60 px-5 py-4">
                  <span className="block font-medium">
                    {itemQuantity} {itemQuantity === 1 ? 'item' : 'items'}
                  </span>
                  <span
                    className="mt-1 block truncate text-xs text-zinc-600 dark:text-zinc-400"
                    title={itemSummary}
                  >
                    {itemSummary}
                  </span>
                </td>
                <td className="px-5 py-4"><OrderStatus status={order.status} /></td>
                <td className="max-w-44 break-all px-5 py-4 font-mono text-xs">
                  {order.waybill?.tracking_id ?? order.waybill?.reference ?? 'Unavailable'}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right font-semibold tabular-nums">
                  {orderMoney(order.totals.payable, order.totals.currency)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1.5">
                    {order.waybill ? (
                      <WaybillActions
                        busy={pdfBusy}
                        orderId={order.id}
                        reference={order.waybill.reference}
                        pdfUrl={order.waybill.pdf_url}
                        printPdf={printPdf}
                      />
                    ) : (
                      <span className="self-center text-xs text-zinc-500">Waybill unavailable</span>
                    )}
                    <Link
                      aria-label={`Open order details for ${order.reference}`}
                      className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-[#4C1268] underline-offset-4 hover:bg-[#F1EAF4] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:text-purple-300 dark:hover:bg-purple-300/10"
                      state={{ backTo }}
                      to={`/orders/${order.id}`}
                    >
                      Details
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WaybillActions({
  busy,
  orderId,
  reference,
  pdfUrl,
  printPdf,
}: {
  busy: string
  orderId: string
  reference: string
  pdfUrl: string
  printPdf: (
    path: string,
    key: string,
    mode: 'preview' | 'download' | 'print',
    filename: string,
  ) => Promise<void>
}) {
  const filename = `waybill-${reference}.pdf`
  const buttonClass = 'min-h-11! min-w-11! px-2!'

  return (
    <>
      <OrderButton
        aria-label={`Preview ${reference}`}
        className={buttonClass}
        isLoading={busy === `${orderId}:preview`}
        onClick={() => void printPdf(pdfUrl, orderId, 'preview', filename)}
      >
        <FaEye aria-hidden="true" />
      </OrderButton>
      <OrderButton
        aria-label={`Download ${reference}`}
        className={buttonClass}
        isLoading={busy === `${orderId}:download`}
        onClick={() => void printPdf(pdfUrl, orderId, 'download', filename)}
      >
        <FaDownload aria-hidden="true" />
      </OrderButton>
      <OrderButton
        aria-label={`Print ${reference}`}
        className={buttonClass}
        isLoading={busy === `${orderId}:print`}
        onClick={() => void printPdf(pdfUrl, orderId, 'print', filename)}
      >
        <FaPrint aria-hidden="true" />
      </OrderButton>
    </>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${orderPanel} p-4`}>
      <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="mt-2 break-words text-sm font-semibold">{value}</dd>
    </div>
  )
}

function PickupParcelLoading() {
  return (
    <div aria-label="Loading pickup parcels" className="mt-5 animate-pulse space-y-3" role="status">
      <div className="h-28 rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" />
      <div className="h-72 rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" />
      <span className="sr-only">Loading pickup parcels…</span>
    </div>
  )
}

function formatPickupDate(date: string | null) {
  return date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : 'Not scheduled'
}
