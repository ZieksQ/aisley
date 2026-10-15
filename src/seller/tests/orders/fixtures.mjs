// Synthetic order contracts layered over the existing Seller shell fixture.
// No live accounts, documents, API calls, or database writes are used.
export function installOrderFixtures() {
  const fallback = window.fetch.bind(window)
  const state = window.orderFixture = { requests: [], mode: 'normal', pdfOpens: 0 }
  const uuid = (prefix, number) => `${prefix}000000-0000-4000-8000-${String(number).padStart(12, '0')}`
  const provider = { id: uuid('11', 1), business_name: 'Harbor Parcel Cooperative' }
  const address = {
    recipient_name: 'Lia Mendoza', contact_number: '09171234567', address_line_1: '42 Maginhawa Street',
    address_line_2: null, barangay: 'Teachers Village East', city_municipality: 'Quezon City',
    province: 'Metro Manila', region: 'National Capital Region', postal_code: '1101', country: 'PH',
  }
  const pickups = state.pickups = Array.from({ length: 22 }, (_, index) => ({
    id: uuid('80', index + 1), status: ['pending_logistics', 'scheduled', 'partially_scheduled'][index % 3],
    requested_at: `2026-10-${String(15 - index % 10).padStart(2, '0')}T07:32:00Z`,
    pickup_date: index % 3 === 1 ? '2026-10-18' : null,
    order_count: 2, provider,
  }))
  const orders = state.orders = Array.from({ length: 25 }, (_, index) => {
    const id = uuid('90', index + 1)
    const status = index < 21 ? 'placed' : index === 21 ? 'seller_processing' : 'ready_for_pickup'
    return {
      id, reference: `ASL-20261015-${String(4100 + index)}`, status,
      placed_at: '2026-10-15T04:30:00Z', latest_activity_at: '2026-10-15T07:32:00Z',
      payment: { method: 'cod', status: 'pending' }, shipping_provider: provider,
      items: [{ id: uuid('70', index + 1), product_id: uuid('60', 1), variant_id: null,
        product_name: index % 2 ? 'Glazed ceramic mug' : 'Cedar storage basket', variant_name: 'Natural',
        sku: `${index % 2 ? 'MUG' : 'CEDAR'}-${index + 1}`, selected_options: [], quantity: 2, unit_price: '248.50', line_subtotal: '497.00', currency: 'PHP' }],
      delivery_address: address,
      totals: { merchandise_subtotal: '497.00', shipping_fee: '64.00', discount: '0.00', shipping_discount: '0.00', payable: '561.00', currency: 'PHP' },
      status_history: [{ id: uuid('50', index + 1), from_status: null, to_status: status, occurred_at: '2026-10-15T04:30:00Z' }],
      capabilities: { can_approve: status === 'placed', can_reject: status === 'placed', can_prepare: status === 'seller_processing', can_view_waybill: status === 'ready_for_pickup' },
      notification: null,
      pickup: status === 'ready_for_pickup' ? { request_id: pickups[0].id, status: 'pending_logistics', pickup_date: null, logistics_organization_id: provider.id, pickup_address: null, schedule: null } : null,
      waybill: status === 'ready_for_pickup' ? { id: uuid('40', index + 1), reference: `WB-${4200 + index}`, tracking_id: `AIS-${4200 + index}`, created_at: '2026-10-15T07:32:00Z', pdf_url: `/api/v1/seller/orders/${id}/waybill` } : null,
    }
  })
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const page = (items, params) => {
    const current_page = Math.max(1, Number(params.get('page')) || 1)
    const perPage = Number(params.get('per_page')) || 20
    return { data: items.slice((current_page - 1) * perPage, current_page * perPage), meta: { current_page, last_page: Math.max(1, Math.ceil(items.length / perPage)), per_page: perPage, total: items.length } }
  }
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
    const path = url.pathname
    if (!/^\/api\/v1\/seller\/(orders|pickup-requests|courier-conversations\/order-context)/.test(path)) return fallback(input, options)
    const method = options.method ?? 'GET'
    state.requests.push({ path, query: url.search, method })
    if (path.includes('waybill')) return new Response('%PDF-1.4\n%%EOF', { headers: { 'Content-Type': 'application/pdf' } })
    if (path.includes('order-context')) return json({ data: { order_id: path.split('/').at(-1), send_allowed: false, conversation_id: null } })
    if (path === '/api/v1/seller/orders' && method === 'GET') {
      if (state.mode === 'error') return json({ message: 'Order service unavailable. Try again.' }, 503)
      if (state.mode === 'loading') await new Promise((done) => setTimeout(done, 1000))
      let items = orders
      if (url.searchParams.get('pickup_request_id')) items = orders.filter((order) => order.waybill).slice(0, 2)
      if (url.searchParams.get('status')) items = items.filter((order) => order.status === url.searchParams.get('status'))
      const search = url.searchParams.get('search')?.toLowerCase()
      if (search) items = items.filter((order) => [order.reference, ...order.items.flatMap((item) => [item.product_name, item.sku])].some((text) => text.toLowerCase().includes(search)))
      if (state.mode === 'empty') items = []
      return json({ ...page(items, url.searchParams), status_counts: orders.reduce((counts, order) => ({ ...counts, [order.status]: (counts[order.status] ?? 0) + 1 }), {}) })
    }
    if (path === '/api/v1/seller/pickup-requests') {
      let items = [...pickups]
      if (url.searchParams.get('sort') === 'requested_asc') items.reverse()
      return json(page(items, url.searchParams))
    }
    const pickup = path.match(/^\/api\/v1\/seller\/pickup-requests\/([^/]+)$/)
    if (pickup) return json({ data: pickups.find((item) => item.id === pickup[1]) ?? pickups[0] })
    const decision = path.match(/^\/api\/v1\/seller\/orders\/([^/]+)\/(approve|reject)$/)
    if (decision) {
      const order = orders.find((item) => item.id === decision[1])
      order.status = decision[2] === 'approve' ? 'seller_processing' : 'rejected'
      order.capabilities.can_approve = false
      order.capabilities.can_reject = false
      order.capabilities.can_prepare = decision[2] === 'approve'
      return json({ data: order })
    }
    const detail = path.match(/^\/api\/v1\/seller\/orders\/([^/]+)$/)
    if (detail) return json({ data: orders.find((item) => item.id === detail[1]) })
    return json({ message: `Unhandled synthetic order route: ${path}` }, 501)
  }
}
