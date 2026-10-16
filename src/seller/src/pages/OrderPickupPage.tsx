import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { OrderButton, OrderError, orderLink, orderPanel } from '../components/orders/OrderUi'
import {
  PickupAddressDialog,
  PickupAddressSection,
} from '../components/orders/pickup/PickupAddressPicker'
import {
  PickupPreparationOrders,
} from '../components/orders/pickup/PickupPreparationOrders'
import { groupOrdersByProvider } from '../components/orders/pickup/pickupUtils'
import { ApiError } from '../lib/api'
import { createPickupRequest } from '../lib/sellerOrderActions'
import { getPickupAddresses } from '../lib/sellerPickupAddresses'
import { useOrderAccessError, useSellerOrders } from '../lib/useSellerOrders'
import type { PickupAddress } from '../types/pickupAddresses'
import type { SellerOrder, SellerOrderPage } from '../types/orders'
import { PickupRequestsTable } from './PickupRequestsTable'

export function OrderPickupPage() {
  const { seller } = useAuth()
  const accessError = useOrderAccessError()
  const processing = useSellerOrders<SellerOrderPage>(
    '/api/v1/seller/orders?status=seller_processing&sort=oldest&per_page=50',
  )
  const [addresses, setAddresses] = useState<PickupAddress[]>([])
  const [addressLoading, setAddressLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [pickupAddressId, setPickupAddressId] = useState('')
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [requestRevision, setRequestRevision] = useState(0)
  const [createdRequestId, setCreatedRequestId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { document.title = 'Order pickup | Aisley Seller' }, [])

  const loadAddresses = useCallback(async () => {
    setAddressLoading(true)
    try {
      const result = (await getPickupAddresses()).data
      setAddresses(result)
      setPickupAddressId((current) => result.some((address) => address.id === current)
        ? current
        : result.find((address) => address.is_default)?.id ?? result[0]?.id ?? '')
    } catch (reason) {
      if (!accessError(reason)) {
        setError(reason instanceof Error
          ? reason.message
          : 'Pickup addresses could not be loaded.')
      }
    } finally {
      setAddressLoading(false)
    }
  }, [accessError])

  useEffect(() => { void loadAddresses() }, [loadAddresses])

  const orders = processing.data?.data ?? []
  const groups = groupOrdersByProvider(orders)
  const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0]
  const selectedAddress = addresses.find((address) => address.id === pickupAddressId)
  const selectedProvider = orders.find((order) => selected.includes(order.id))?.shipping_provider ?? null

  function toggleOrder(order: SellerOrder) {
    if (!order.shipping_provider) return
    setSelected((current) => {
      if (current.includes(order.id)) return current.filter((value) => value !== order.id)
      const currentProvider = orders.find((item) => current.includes(item.id))?.shipping_provider?.id
      return currentProvider && currentProvider !== order.shipping_provider?.id
        ? current
        : [...current, order.id]
    })
    if (!pickupAddressId && defaultAddress) setPickupAddressId(defaultAddress.id)
  }

  function selectProviderGroup(groupOrders: SellerOrder[]) {
    const selectable = groupOrders
      .filter((order) => order.shipping_provider)
      .map((order) => order.id)
    setSelected((current) => selectable.every((id) => current.includes(id)) ? [] : selectable)
    if (!pickupAddressId && defaultAddress) setPickupAddressId(defaultAddress.id)
  }

  async function submitPickupRequest() {
    if (!seller || selected.length === 0 || !selectedProvider || !pickupAddressId || submitting) return
    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      const response = await createPickupRequest(
        seller.id,
        selected,
        selectedProvider.id,
        pickupAddressId,
      )()
      setSelected([])
      setCreatedRequestId(response.data.id)
      setNotice(
        `${response.data.order_ids.length} ${response.data.order_ids.length === 1 ? 'Order is' : 'Orders are'} ready for pickup. Print and attach each waybill before handoff.`,
      )
      processing.refresh()
      setRequestRevision((value) => value + 1)
    } catch (reason) {
      if (!accessError(reason)) {
        setError(reason instanceof ApiError
          ? reason.message
          : 'The pickup request could not be submitted. Refresh and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function refreshAll() {
    processing.refresh()
    setRequestRevision((value) => value + 1)
    void loadAddresses()
  }

  return (
    <main className="portal-page seller-order-workspace">
      <header className="portal-page-header">
        <div>
          <h1 className="portal-page-heading">
            Pickup preparation
          </h1>
          <p className="portal-page-description">
            Pack approved orders, keep each checkout-selected provider, and submit ready parcels for pickup.
          </p>
        </div>
        <OrderButton
          isLoading={processing.loading || addressLoading}
          loadingLabel="Refreshing"
          onClick={refreshAll}
        >
          Refresh
        </OrderButton>
      </header>

      <PreparationGuidance />

      {error && <OrderError message={error} retry={refreshAll} />}
      {notice && (
        <div className="portal-feedback my-4" role="status">
          <p>{notice}</p>
          {createdRequestId && (
            <Link
              className="portal-button mt-2"
              to={`/orders/pickup/${createdRequestId}`}
            >
              Open pickup parcels
            </Link>
          )}
        </div>
      )}

      <section className={`${orderPanel} mt-5`} aria-labelledby="ready-to-submit">
        <div className="order-section-heading">
          <div>
            <h2 className="font-semibold" id="ready-to-submit">Prepared orders</h2>
            <p className="mt-1 text-sm text-[var(--portal-muted)]">
              {orders.length} available · {selected.length} selected
              {selectedProvider ? ` · ${selectedProvider.business_name}` : ''}
            </p>
          </div>
          <OrderButton
            variant="secondary"
            disabled={!selected.length || !selectedProvider || !pickupAddressId}
            isLoading={submitting}
            loadingLabel="Requesting pickup"
            onClick={() => void submitPickupRequest()}
          >
            Request pickup
          </OrderButton>
        </div>

        <PickupAddressSection
          address={selectedAddress}
          addressLoading={addressLoading}
          addressesAvailable={addresses.length > 0}
          onChoose={() => setAddressModalOpen(true)}
        />

        {addresses.length === 0 && !addressLoading && (
          <div className="border-b border-[var(--portal-border)] px-4 py-3 text-sm">
            <p className="text-amber-700 dark:text-amber-300">No pickup address is available.</p>
            <Link className={`${orderLink} mt-2 inline-flex min-h-11 items-center`} to="/account">
              Add one in Account settings
            </Link>
          </div>
        )}

        {processing.error ? (
          <div className="px-5">
            <OrderError message={processing.error} retry={processing.refresh} />
          </div>
        ) : processing.loading && !processing.data ? (
          <div
            aria-label="Loading prepared orders"
            className="m-5 h-56 animate-pulse rounded-lg border border-[var(--portal-border)] bg-[var(--portal-subtle)]"
            role="status"
          >
            <span className="sr-only">Loading prepared orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <p className="p-5 text-sm text-[var(--portal-muted)]">
            Approved orders appear here while they are being prepared.
          </p>
        ) : (
          <PickupPreparationOrders
            groups={groups}
            selectedIds={selected}
            selectedProviderId={selectedProvider?.id ?? null}
            onSelectGroup={selectProviderGroup}
            onToggleOrder={toggleOrder}
          />
        )}
      </section>

      <PickupRequestsTable refreshRevision={requestRevision} />

      {addressModalOpen && (
        <PickupAddressDialog
          addresses={addresses}
          onClose={() => setAddressModalOpen(false)}
          onSelect={(id) => {
            setPickupAddressId(id)
            setAddressModalOpen(false)
          }}
          selectedId={pickupAddressId}
        />
      )}
    </main>
  )
}

function PreparationGuidance() {
  return (
    <details className={`${orderPanel} px-4 text-sm`}>
      <summary className="min-h-11 cursor-pointer py-3 font-medium">Packing checklist</summary>
      <ol className="grid gap-2 pb-3 text-sm sm:grid-cols-2">
        <li><strong>1.</strong> Confirm items, then pack and seal each order separately.</li>
        <li><strong>2.</strong> Select orders within one provider group.</li>
        <li><strong>3.</strong> Choose one pickup address and request pickup.</li>
        <li><strong>4.</strong> Print and attach each generated waybill.</li>
      </ol>
      <p className="border-t border-[var(--portal-border)] py-3 text-xs text-[var(--portal-muted)]">
        The provider is locked from checkout. Keep waybills flat and avoid glare over the QR code.
      </p>
    </details>
  )
}
