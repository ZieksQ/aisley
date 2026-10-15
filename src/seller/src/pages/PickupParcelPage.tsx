import { PortalSkeleton } from '@aisley/ui/portal'
import { useEffect, useState } from 'react'
import { FaPrint } from 'react-icons/fa6'
import { Link, useLocation, useParams } from 'react-router-dom'
import { OrderButton, OrderError, orderLink } from '../components/orders/OrderUi'
import { PickupParcelsTable } from '../components/orders/pickup/PickupParcelsTable'
import { PickupStatus } from '../components/orders/pickup/PickupRequestStatus'
import { ApiError } from '../lib/api'
import { useOrderAccessError, useSellerOrders } from '../lib/useSellerOrders'
import { openWaybillPdf } from '../lib/waybillPdf'
import type { SellerOrderPage } from '../types/orders'
import { pickupDate, type SellerPickupRequestResponse } from '../types/pickupRequests'

export function PickupParcelPage() {
  const { pickupId = '' } = useParams()
  return <PickupParcel key={pickupId} pickupId={pickupId} />
}

function PickupParcel({ pickupId }: { pickupId: string }) {
  const location = useLocation()
  const accessError = useOrderAccessError()
  const encodedId = encodeURIComponent(pickupId)
  const request = useSellerOrders<SellerPickupRequestResponse>(`/api/v1/seller/pickup-requests/${encodedId}`)
  const orderPage = useSellerOrders<SellerOrderPage>(
    `/api/v1/seller/orders?pickup_request_id=${encodedId}&sort=oldest&per_page=50`,
  )
  const [pdfBusy, setPdfBusy] = useState('')
  const [pdfError, setPdfError] = useState('')
  const pickup = request.data?.data
  const orders = orderPage.data?.data ?? []
  const backTo = typeof location.state?.backTo === 'string' && location.state.backTo.startsWith('/orders/pickup')
    ? location.state.backTo : '/orders/pickup'
  useEffect(() => { document.title = 'Pickup parcels | Aisley Seller' }, [])

  async function printPdf(path: string, key: string, mode: 'preview' | 'download' | 'print', filename: string) {
    if (pdfBusy) return
    setPdfBusy(`${key}:${mode}`)
    setPdfError('')
    try {
      const pdfPath = mode === 'download' ? path : `${path}${path.includes('?') ? '&' : '?'}disposition=inline`
      await openWaybillPdf(pdfPath, mode, filename)
    } catch (reason) {
      if (!accessError(reason)) setPdfError(reason instanceof ApiError ? reason.message
        : 'The waybill could not be opened. Allow pop-ups for preview or print, then try again.')
    } finally { setPdfBusy('') }
  }

  function refresh() { request.refresh(); orderPage.refresh() }
  const canPrintAll = pickup && orders.length > 0 && orders.length === pickup.order_count
    && orders.length <= 30 && orders.every((order) => order.waybill !== null)
  const requestBusy = request.loading || orderPage.loading

  return (
    <main className="portal-page seller-order-workspace">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className={`${orderLink} inline-flex min-h-11 items-center text-sm`} to={backTo}>← Back to pickup requests</Link>
        <OrderButton isLoading={requestBusy} loadingLabel="Refreshing…" onClick={refresh}>Refresh</OrderButton>
      </div>
      <header className="portal-page-header">
        <div>
          <h1 className="portal-page-heading">Pickup parcels</h1>
          <p className="portal-secondary mt-2 break-all font-mono text-xs">Pickup ID · {pickupId}</p>
        </div>
        {pickup && (
          <div className="portal-inline-actions">
            <Link className="portal-button" to={`/logistics-messages?pickup_request_id=${pickup.id}`}>Contact Logistics</Link>
            {canPrintAll && (
              <OrderButton variant="secondary" disabled={Boolean(pdfBusy)} isLoading={pdfBusy === `${pickupId}:print`}
                loadingLabel="Opening labels…" onClick={() => void printPdf(
                  `/api/v1/seller/pickup-requests/${encodedId}/waybills.pdf`, pickupId, 'print', `pickup-waybills-${pickupId}.pdf`,
                )}><FaPrint aria-hidden="true" />Print all waybills</OrderButton>
            )}
          </div>
        )}
      </header>
      {request.error && <OrderError message={request.error} retry={request.refresh} />}
      {orderPage.error && <OrderError message={orderPage.error} retry={orderPage.refresh} />}
      {pdfError && <OrderError message={pdfError} retry={() => setPdfError('')} />}
      {requestBusy && !pickup ? <PortalSkeleton label="Loading pickup parcels" /> : pickup ? (
        <>
          <dl className="order-surface mb-6 grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Pickup request summary">
            <Summary label="Logistics provider" value={pickup.provider?.business_name ?? 'Provider unavailable'} />
            <Summary label="Parcels" value={String(pickup.order_count)} />
            <div><dt className="portal-secondary text-xs">Request status</dt><dd className="mt-2"><PickupStatus status={pickup.status} /></dd></div>
            <Summary label="Pickup date" value={pickup.status === 'scheduled' ? pickupDate(pickup.pickup_date) : 'Awaiting Logistics'} />
          </dl>
          {pickup.order_count > 30 && <p className="order-info mb-4">Bulk printing supports 30 labels per request. Print each parcel’s waybill from its row.</p>}
          <section className="order-surface order-table-wrap overflow-hidden" aria-labelledby="pickup-parcels-title">
            <div className="order-section-heading">
              <h2 id="pickup-parcels-title">Orders in this pickup</h2>
              <p>{pickup.order_count} {pickup.order_count === 1 ? 'parcel' : 'parcels'}</p>
            </div>
            {orderPage.loading && !orderPage.data ? <PortalSkeleton label="Loading orders in this pickup" />
              : orderPage.error && !orderPage.data ? null : orders.length ? (
                <PickupParcelsTable backTo={`${location.pathname}${location.search}`} orders={orders} pdfBusy={pdfBusy} printPdf={printPdf} />
              ) : <p className="order-empty">No orders are linked to this pickup request.</p>}
          </section>
        </>
      ) : null}
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="portal-secondary text-xs">{label}</dt><dd className="mt-2 break-words text-sm font-semibold">{value}</dd></div>
}
