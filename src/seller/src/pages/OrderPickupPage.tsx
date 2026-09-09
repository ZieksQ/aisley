import { useCallback, useEffect, useState } from 'react'
import { FaDownload, FaEye, FaLocationDot, FaMagnifyingGlass, FaPrint, FaTruck, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { OrderButton, OrderError, orderLink, orderPanel } from '../components/orders/OrderUi'
import { ApiError, apiPdfRequest } from '../lib/api'
import { createPickupRequest } from '../lib/sellerOrderActions'
import { getSellerLogisticsOptions, type LogisticsOption } from '../lib/sellerLogisticsOptions'
import { getPickupAddresses, pickupAddressSummary } from '../lib/sellerPickupAddresses'
import { useOrderAccessError, useSellerOrders } from '../lib/useSellerOrders'
import type { PickupAddress } from '../types/pickupAddresses'
import { orderDate, type SellerOrder, type SellerOrderPage } from '../types/orders'

async function handlePdf(path: string, mode: 'preview' | 'download' | 'print', filename: string) {
  const popup = mode === 'download' ? null : window.open('', '_blank')
  try {
    const blob = await apiPdfRequest(path)
    const objectUrl = URL.createObjectURL(blob)
    if (mode === 'download') {
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
      return
    }
    if (!popup) throw new Error('Pop-up blocked')
    popup.location.href = objectUrl
    if (mode === 'print') popup.addEventListener('load', () => popup.print(), { once: true })
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000)
  } catch (error) { popup?.close(); throw error }
}

export function OrderPickupPage() {
  const { seller } = useAuth()
  const accessError = useOrderAccessError()
  const processing = useSellerOrders<SellerOrderPage>('/api/v1/seller/orders?status=seller_processing&sort=oldest&per_page=50')
  const pending = useSellerOrders<SellerOrderPage>('/api/v1/seller/orders?status=ready_for_pickup&sort=activity_desc&per_page=50')
  const [providers, setProviders] = useState<LogisticsOption[]>([])
  const [addresses, setAddresses] = useState<PickupAddress[]>([])
  const [providerLoading, setProviderLoading] = useState(true)
  const [addressLoading, setAddressLoading] = useState(true)
  const [providerId, setProviderId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [pickupAddressIds, setPickupAddressIds] = useState<Record<string, string>>({})
  const [providerModalOpen, setProviderModalOpen] = useState(false)
  const [addressOrderId, setAddressOrderId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pdfBusy, setPdfBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { document.title = 'Order pickup | Aisley Seller' }, [])

  const loadProviders = useCallback(async (force = false) => {
    if (!seller) { setProviderLoading(false); return }
    setProviderLoading(true)
    try {
      const result = await getSellerLogisticsOptions(seller.id, force)
      setProviders(result.data)
      setProviderId((current) => result.data.some((option) => option.id === current)
        ? current
        : result.data.find((option) => option.default)?.id ?? result.data.find((option) => option.recommended)?.id ?? '')
      setError('')
    } catch (reason) {
      if (!accessError(reason)) setError(reason instanceof ApiError ? reason.message : 'Logistics providers could not be loaded.')
    } finally { setProviderLoading(false) }
  }, [accessError, seller])

  const loadAddresses = useCallback(async () => {
    setAddressLoading(true)
    try { setAddresses((await getPickupAddresses()).data) }
    catch (reason) { if (!accessError(reason)) setError(reason instanceof Error ? reason.message : 'Pickup addresses could not be loaded.') }
    finally { setAddressLoading(false) }
  }, [accessError])

  useEffect(() => { void loadProviders(); void loadAddresses() }, [loadAddresses, loadProviders])

  const eligible = processing.data?.data ?? []
  const pickupGroups = Object.values((pending.data?.data ?? []).reduce<Record<string, SellerOrder[]>>((groups, order) => {
    const key = order.pickup?.request_id ?? order.id
    ;(groups[key] ??= []).push(order)
    return groups
  }, {}))
  const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0]
  const selectedProvider = providers.find((provider) => provider.id === providerId)
  const addressesComplete = selected.every((orderId) => Boolean(pickupAddressIds[orderId]))

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
    if (!selected.includes(id) && defaultAddress) setPickupAddressIds((current) => ({ ...current, [id]: current[id] ?? defaultAddress.id }))
  }

  async function submit() {
    if (!seller || selected.length === 0 || !providerId || !addressesComplete || submitting) return
    setSubmitting(true); setError(''); setNotice('')
    try {
      const selectedAddresses = Object.fromEntries(selected.map((orderId) => [orderId, pickupAddressIds[orderId]]))
      const response = await createPickupRequest(seller.id, selected, providerId, selectedAddresses)()
      setSelected([]); setPickupAddressIds({})
      setNotice(`${response.data.order_ids.length} ${response.data.order_ids.length === 1 ? 'Order is' : 'Orders are'} ready for pickup. Print and attach each waybill before handoff.`)
      processing.refresh(); pending.refresh(); void loadProviders(true)
    } catch (reason) {
      if (!accessError(reason)) setError(reason instanceof ApiError ? reason.message : 'The pickup request could not be submitted. Refresh and try again.')
    } finally { setSubmitting(false) }
  }

  async function waybill(path: string, key: string, mode: 'preview' | 'download' | 'print', filename: string) {
    setPdfBusy(`${key}:${mode}`); setError('')
    try { await handlePdf(`${path}${path.includes('?') ? '&' : '?'}disposition=inline`, mode, filename) }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : 'The waybill could not be opened. Allow pop-ups for preview or print and try again.') }
    finally { setPdfBusy('') }
  }

  return <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10"><div><h2 className="text-2xl font-semibold">Order pickup</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Prepare parcels, choose pickup addresses and a Logistics provider, then print the shared waybills.</p></div><OrderButton isLoading={processing.loading || pending.loading || providerLoading || addressLoading} loadingLabel="Refreshing" onClick={() => { processing.refresh(); pending.refresh(); void loadProviders(true); void loadAddresses() }}>Refresh</OrderButton></div>

    <section className={`${orderPanel} mt-5 p-5`} aria-labelledby="packing-steps"><h3 className="font-semibold" id="packing-steps">Before requesting pickup</h3><ol className="mt-3 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300 sm:grid-cols-2"><li><strong>1.</strong> Confirm the items, then pack and seal each Order separately.</li><li><strong>2.</strong> Confirm a pickup address for every Order.</li><li><strong>3.</strong> Choose a Logistics provider and request pickup.</li><li><strong>4.</strong> Print and attach each generated waybill.</li></ol><p className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-white/10">Do not place the waybill across a seam or fold it. Avoid tape glare over the QR.</p></section>

    {error && <OrderError message={error} retry={() => { processing.refresh(); pending.refresh(); void loadProviders(true); void loadAddresses() }} />}
    {notice && <p className="my-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-400/20 dark:bg-green-400/10 dark:text-green-200" role="status">{notice}</p>}

    <section className={`${orderPanel} mt-5`} aria-labelledby="ready-to-submit">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-5 dark:border-white/10"><div><h3 className="font-semibold" id="ready-to-submit">Prepared orders</h3><p className="mt-1 text-sm text-zinc-500">{eligible.length} available · {selected.length} selected</p></div><OrderButton variant="secondary" disabled={!selected.length || !providerId || !addressesComplete || providers.length === 0} isLoading={submitting} loadingLabel="Requesting pickup" onClick={() => void submit()}>Request pickup</OrderButton></div>

      <div className="border-b border-zinc-200 p-5 dark:border-white/10">
        <p className="text-sm font-medium">Logistics provider</p>
        {selectedProvider ? <div className="mt-2 flex flex-col justify-between gap-3 border border-zinc-200 p-4 dark:border-white/10 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{selectedProvider.business_name}</p><ProviderTags option={selectedProvider} /></div><ProviderNote option={selectedProvider} /></div><OrderButton disabled={providerLoading} onClick={() => setProviderModalOpen(true)}>Change provider</OrderButton></div> : <OrderButton className="mt-2" disabled={providerLoading || providers.length === 0} onClick={() => setProviderModalOpen(true)}>{providerLoading ? 'Loading providers…' : 'Choose provider'}</OrderButton>}
        {providers.length === 0 && !providerLoading ? <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">No eligible provider is available. Retry after a Logistics organization has an approved active Courier.</p> : null}
        <p className="mt-2 text-[11px] text-zinc-500">Distance data © Geoapify · OpenStreetMap contributors</p>
      </div>

      {addresses.length === 0 && !addressLoading ? <div className="border-b border-zinc-200 p-5 text-sm dark:border-white/10"><p className="text-amber-700 dark:text-amber-300">No pickup address is available.</p><Link className={`${orderLink} mt-2 inline-block`} to="/account">Add one in Account settings</Link></div> : null}
      {processing.error ? <div className="px-5"><OrderError message={processing.error} retry={processing.refresh} /></div> : eligible.length === 0 ? <p className="p-5 text-sm text-zinc-600 dark:text-zinc-400">Approved Orders appear here while they are being prepared.</p> : <ul className="divide-y divide-zinc-200 dark:divide-white/10">{eligible.map((order) => <SelectableOrder address={addresses.find((item) => item.id === pickupAddressIds[order.id])} checked={selected.includes(order.id)} key={order.id} onChooseAddress={() => setAddressOrderId(order.id)} order={order} toggle={toggle} />)}</ul>}
    </section>

    {pending.error ? <OrderError message={pending.error} retry={pending.refresh} /> : <PickupRequests groups={pickupGroups} pdfBusy={pdfBusy} waybill={waybill} />}

    {providerModalOpen ? <ProviderModal onClose={() => setProviderModalOpen(false)} onSelect={(id) => { setProviderId(id); setProviderModalOpen(false) }} options={providers} selectedId={providerId} /> : null}
    {addressOrderId ? <AddressModal addresses={addresses} onClose={() => setAddressOrderId(null)} onSelect={(id) => { setPickupAddressIds((current) => ({ ...current, [addressOrderId]: id })); setAddressOrderId(null) }} selectedId={pickupAddressIds[addressOrderId]} /> : null}
  </div>
}

function PickupRequests({ groups, pdfBusy, waybill }: { groups: SellerOrder[][]; pdfBusy: string; waybill: (path: string, key: string, mode: 'preview' | 'download' | 'print', filename: string) => Promise<void> }) {
  return <section className={`${orderPanel} mt-5`} aria-labelledby="pending-pickup"><div className="border-b border-zinc-200 p-5 dark:border-white/10"><h3 className="font-semibold" id="pending-pickup">Pickup requests</h3></div>{groups.length === 0 ? <p className="p-5 text-sm text-zinc-600 dark:text-zinc-400">No pickup requests are pending.</p> : <div className="divide-y divide-zinc-200 dark:divide-white/10">{groups.map((orders) => { const requestId = orders[0].pickup?.request_id ?? orders[0].id; return <section className="p-5" key={requestId}><div className="flex flex-wrap justify-between gap-3 text-sm"><div><h4 className="font-medium">Pickup request · {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}</h4><p className="mt-1 text-zinc-500">Submitted {orderDate(orders[0].latest_activity_at)}</p></div>{orders.length <= 30 ? <OrderButton isLoading={pdfBusy === `${requestId}:print`} onClick={() => void waybill(`/api/v1/seller/pickup-requests/${requestId}/waybills.pdf`, requestId, 'print', `pickup-waybills-${requestId}.pdf`)}><FaPrint />Print all</OrderButton> : <span className="max-w-52 text-xs text-zinc-500">Bulk print supports 30 labels. Print these waybills individually.</span>}</div><ul className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">{orders.map((order) => <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm" key={order.id}><div><Link className={orderLink} to={`/orders/${order.id}`}>{order.reference}</Link>{order.pickup?.pickup_address ? <p className="mt-1 text-xs text-zinc-500">Pickup: {order.pickup.pickup_address.label || order.pickup.pickup_address.city_municipality}</p> : null}{order.waybill ? <p className="mt-1 text-xs text-zinc-500">{order.waybill.reference}</p> : null}{order.pickup?.schedule ? <p className="mt-1 text-xs font-medium text-[#4C1268] dark:text-purple-300">Pickup {pickupWindow(order.pickup.schedule.starts_at, order.pickup.schedule.ends_at)} PHT · {order.pickup.schedule.reference}</p> : <p className="mt-1 text-xs text-zinc-500">Waiting for Logistics to schedule pickup</p>}</div>{order.waybill ? <div className="flex gap-2"><OrderButton isLoading={pdfBusy === `${order.id}:preview`} onClick={() => void waybill(order.waybill!.pdf_url, order.id, 'preview', `waybill-${order.waybill!.reference}.pdf`)}><FaEye />Preview</OrderButton><OrderButton aria-label={`Download ${order.waybill.reference}`} isLoading={pdfBusy === `${order.id}:download`} onClick={() => void waybill(order.waybill!.pdf_url, order.id, 'download', `waybill-${order.waybill!.reference}.pdf`)}><FaDownload /></OrderButton><OrderButton aria-label={`Print ${order.waybill.reference}`} isLoading={pdfBusy === `${order.id}:print`} onClick={() => void waybill(order.waybill!.pdf_url, order.id, 'print', `waybill-${order.waybill!.reference}.pdf`)}><FaPrint /></OrderButton></div> : <span className="text-xs text-zinc-500">Waybill unavailable</span>}</li>)}</ul></section> })}</div>}</section>
}

function ProviderModal({ onClose, onSelect, options, selectedId }: { onClose: () => void; onSelect: (id: string) => void; options: LogisticsOption[]; selectedId: string }) {
  const [search, setSearch] = useState('')
  const filtered = options.filter((option) => `${option.business_name} ${Object.values(option.hub.area).filter(Boolean).join(' ')}`.toLowerCase().includes(search.toLowerCase().trim()))
  useDialogEscape(onClose)
  return <div aria-labelledby="provider-dialog-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="dialog" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#18181b]"><div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5 dark:border-white/10"><div><h3 className="text-lg font-semibold" id="provider-dialog-title">Choose a Logistics provider</h3><p className="mt-1 text-sm text-zinc-500">Suggestions use your default pickup address. You can choose any eligible provider.</p></div><button aria-label="Close provider picker" className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10" onClick={onClose}><FaXmark /></button></div><div className="p-5"><label className="relative block"><span className="sr-only">Search providers</span><FaMagnifyingGlass className="pointer-events-none absolute left-3 top-3.5 text-zinc-400" /><input autoFocus className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#E6007A] focus:ring-2 focus:ring-pink-100 dark:border-white/15 dark:bg-[#111113] dark:focus:ring-pink-500/10" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, city, province, or address" type="search" value={search} /></label><div className="mt-4 max-h-[55vh] divide-y divide-zinc-200 overflow-y-auto border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">{filtered.map((option) => <button className={`block w-full p-4 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E6007A] dark:hover:bg-white/5 ${selectedId === option.id ? 'bg-purple-50/70 dark:bg-purple-400/10' : ''}`} key={option.id} onClick={() => onSelect(option.id)}><div className="flex items-start gap-3"><FaTruck className="mt-1 shrink-0 text-[#4C1268] dark:text-purple-300" /><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="font-medium">{option.business_name}</strong><ProviderTags option={option} /></span><span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-300">{option.hub.name}</span><span className="mt-1 block text-xs leading-5 text-zinc-500">{providerAddress(option)}</span><ProviderNote option={option} /></span></div></button>)}{filtered.length === 0 ? <p className="p-5 text-sm text-zinc-500">No providers match your search.</p> : null}</div><p className="mt-3 text-[11px] text-zinc-500">Distance data © Geoapify · OpenStreetMap contributors</p></div></div></div>
}

function AddressModal({ addresses, onClose, onSelect, selectedId }: { addresses: PickupAddress[]; onClose: () => void; onSelect: (id: string) => void; selectedId?: string }) {
  useDialogEscape(onClose)
  return <div aria-labelledby="address-dialog-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="dialog" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><div className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#18181b]"><div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5 dark:border-white/10"><div><h3 className="text-lg font-semibold" id="address-dialog-title">Choose pickup address</h3><p className="mt-1 text-sm text-zinc-500">This address will be saved on this Order’s waybill.</p></div><button aria-label="Close address picker" className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10" onClick={onClose}><FaXmark /></button></div><div className="max-h-[60vh] divide-y divide-zinc-200 overflow-y-auto dark:divide-white/10">{addresses.map((address) => <button className={`flex w-full items-start gap-3 p-4 text-left hover:bg-zinc-50 dark:hover:bg-white/5 ${selectedId === address.id ? 'bg-purple-50/70 dark:bg-purple-400/10' : ''}`} key={address.id} onClick={() => onSelect(address.id)}><FaLocationDot className="mt-1 shrink-0 text-[#4C1268] dark:text-purple-300" /><span><span className="flex flex-wrap gap-2"><strong className="font-medium">{address.label || 'Pickup address'}</strong>{address.is_default ? <span className="text-xs font-semibold text-[#9B0757] dark:text-pink-300">Default</span> : null}</span><span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-300">{address.recipient_name} · {address.contact_number}</span><span className="mt-1 block text-xs leading-5 text-zinc-500">{pickupAddressSummary(address)}</span></span></button>)}</div><div className="border-t border-zinc-200 p-4 text-right dark:border-white/10"><Link className={orderLink} onClick={onClose} to="/account">Manage pickup addresses</Link></div></div></div>
}

function useDialogEscape(onClose: () => void) {
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose])
}

function ProviderTags({ option }: { option: LogisticsOption }) {
  const tags = [option.default ? 'Default' : null, option.recommended ? 'Suggested' : null, option.recommendation_reason === 'same_city' || option.recommendation_reason === 'nearest_by_road' ? 'Near you' : null, option.recommendation_reason === 'same_province' ? 'Same province' : null].filter((tag): tag is string => Boolean(tag))
  return <>{tags.map((tag) => <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-200" key={tag}>{tag}</span>)}</>
}

function ProviderNote({ option }: { option: LogisticsOption }) {
  const reason = option.recommendation_reason === 'same_city' ? 'Same city as your default pickup address' : option.recommendation_reason === 'same_province' ? 'Same province as your default pickup address' : option.recommendation_reason === 'nearest_by_road' ? 'Nearest available road distance' : 'Eligible for this pickup'
  return <span className="mt-1 block text-xs text-zinc-500">{reason}{option.distance_km === null ? ' · Distance unavailable' : ` · ${option.distance_km.toFixed(1)} km by road`}</span>
}

function providerAddress(option: LogisticsOption) {
  const area = option.hub.area
  return [area.address_line_1, area.address_line_2, area.barangay, area.city_municipality, area.province, area.region, area.postal_code, area.country].filter(Boolean).join(', ')
}

function pickupWindow(startsAt: string, endsAt: string) {
  return `${new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(startsAt))}–${new Intl.DateTimeFormat('en-PH', { timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(endsAt))}`
}

function SelectableOrder({ address, checked, onChooseAddress, order, toggle }: { address?: PickupAddress; checked: boolean; onChooseAddress: () => void; order: SellerOrder; toggle: (id: string) => void }) {
  return <li className="p-5"><div className="flex gap-3"><input checked={checked} className="mt-1 size-4 accent-[#4C1268]" id={`pickup-${order.id}`} onChange={() => toggle(order.id)} type="checkbox" /><label className="min-w-0 flex-1" htmlFor={`pickup-${order.id}`}><span className="font-medium">{order.reference}</span><span className="mt-1 block truncate text-sm text-zinc-600 dark:text-zinc-400">{order.items.map((item) => `${item.quantity} × ${item.product_name}`).join(', ')}</span></label><Link className={`${orderLink} text-sm`} to={`/orders/${order.id}/prepare`}>Review</Link></div>{checked ? <div className="ml-7 mt-3 flex flex-col justify-between gap-3 border-l-2 border-zinc-200 pl-3 dark:border-white/15 sm:flex-row sm:items-center"><div className="min-w-0"><p className="text-xs font-medium text-zinc-500">Pickup address</p>{address ? <><p className="mt-1 text-sm font-medium">{address.label || address.city_municipality}{address.is_default ? ' · Default' : ''}</p><p className="mt-1 truncate text-xs text-zinc-500">{pickupAddressSummary(address)}</p></> : <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Choose an address for this Order.</p>}</div><OrderButton className="shrink-0" onClick={onChooseAddress}>{address ? 'Change' : 'Choose address'}</OrderButton></div> : null}</li>
}
