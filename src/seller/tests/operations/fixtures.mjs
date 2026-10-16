// Synthetic Seller operations API. Every request stays in the browser fixture;
// these regressions never authenticate against or mutate the live API.
export function installOperationsFixtures() {
  const originalFetch = window.fetch.bind(window)
  const sellerId = '30000000-0000-4000-8000-000000000001'
  const shopId = '40000000-0000-4000-8000-000000000001'
  const ids = {
    providerEnabled: '11000000-0000-4000-8000-000000000001',
    providerExact: '11000000-0000-4000-8000-000000000002',
    providerExactNoDistance: '11000000-0000-4000-8000-000000000003',
    providerDifferentRegion: '11000000-0000-4000-8000-000000000004',
    providerSameRegion: '11000000-0000-4000-8000-000000000005',
    pickupAddress: '12000000-0000-4000-8000-000000000001',
    skuActive: '21000000-0000-4000-8000-000000000001',
    skuLow: '21000000-0000-4000-8000-000000000002',
    skuOut: '21000000-0000-4000-8000-000000000003',
    skuArchived: '21000000-0000-4000-8000-000000000004',
    alertActive: '31000000-0000-4000-8000-000000000001',
    alertResolved: '31000000-0000-4000-8000-000000000002',
    alertArchived: '31000000-0000-4000-8000-000000000003',
    voucherActive: '41000000-0000-4000-8000-000000000001',
    voucherDraft: '41000000-0000-4000-8000-000000000002',
    voucherCreated: '41000000-0000-4000-8000-000000000003',
  }
  const state = window.operationsFixture = {
    sellerId,
    shopId,
    ids,
    modes: {
      shippingRead: 'normal', shippingWrite: 'normal',
      pickupAddress: 'normal',
      inventoryList: 'normal', inventoryDetail: 'normal', movements: 'normal',
      adjustment: 'normal', threshold: 'normal',
      alerts: 'normal', alertDetail: 'normal',
      voucherList: 'normal', voucherDetail: 'normal', voucherWrite: 'normal',
    },
    reads: [],
    writes: [],
    requests: [],
    unhandled: [],
    vouchers: [],
    inventoryMovements: {},
    receipts: {},
  }
  try {
    const initialModes = JSON.parse(sessionStorage.getItem('seller-operations-next-modes') ?? '{}')
    Object.assign(state.modes, initialModes)
    sessionStorage.removeItem('seller-operations-next-modes')
  } catch { /* A test page can still run with the default fixture state. */ }

  const response = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  })
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  const parseBody = (options) => {
    try { return options.body ? JSON.parse(options.body) : null } catch { return null }
  }
  const requestHeaders = (options) => {
    const headers = new Headers(options.headers)
    return Object.fromEntries(['idempotency-key', 'x-xsrf-token'].map((name) => [name, headers.get(name)]))
  }
  const paginated = (items, query, perPage = 20) => {
    const current_page = Math.max(1, Number(query.get('page') || 1))
    return {
      data: items.slice((current_page - 1) * perPage, current_page * perPage),
      current_page,
      last_page: Math.max(1, Math.ceil(items.length / perPage)),
      total: items.length,
    }
  }
  const matchesSearch = (item, value) => !value || [item.product?.name, item.name, item.code, item.sku?.code]
    .filter(Boolean).some((text) => text.toLowerCase().includes(value.toLowerCase()))
  const remember = (path, url, options) => {
    const request = {
      path,
      method: options.method ?? 'GET',
      query: url.searchParams.toString(),
      body: parseBody(options),
      headers: requestHeaders(options),
    }
    state.requests.push(request)
    if (request.method === 'GET') state.reads.push(request)
    else state.writes.push(request)
    return request
  }

  const providers = state.providers = [
    { organization_id: ids.providerEnabled, business_name: 'Harbor Parcel Cooperative', hub: { id: '51000000-0000-4000-8000-000000000001', name: 'Port District Hub' }, is_enabled: true, revision: 4 },
    { organization_id: ids.providerExact, business_name: 'North Avenue Dispatch', hub: { id: '51000000-0000-4000-8000-000000000002', name: 'North Avenue Hub' }, is_enabled: false, revision: 5 },
    { organization_id: ids.providerExactNoDistance, business_name: 'Quezon City Parcel Cooperative', hub: { id: '51000000-0000-4000-8000-000000000003', name: 'Commonwealth Hub' }, is_enabled: false, revision: 2 },
    { organization_id: ids.providerDifferentRegion, business_name: 'Quezon City Provincial Link', hub: { id: '51000000-0000-4000-8000-000000000004', name: 'Quezon City North Hub' }, is_enabled: false, revision: 1 },
    { organization_id: ids.providerSameRegion, business_name: 'Pasig Same Region Logistics', hub: { id: '51000000-0000-4000-8000-000000000005', name: 'Pasig Hub' }, is_enabled: false, revision: 7 },
  ]
  const pickupAddresses = [{
    id: ids.pickupAddress,
    label: 'Default Shop pickup',
    recipient_name: 'Mara Santos',
    contact_number: '+63 917 555 0184',
    address_line_1: '48 Scout Borromeo Street',
    address_line_2: null,
    barangay: 'South Triangle',
    city_municipality: 'Quezon City',
    province: 'Metro Manila',
    region: 'National Capital Region',
    postal_code: '1103',
    country: 'Philippines',
    latitude: 14.6421,
    longitude: 121.0358,
    is_default: true,
  }]
  const hubArea = (city, province, region) => ({
    address_line_1: 'Synthetic hub address', address_line_2: null, barangay: 'Central',
    city_municipality: city, province, region, postal_code: '1100', country: 'Philippines',
  })
  const rankedOptions = [
    { id: ids.providerExact, business_name: 'North Avenue Dispatch', hub: { id: '51000000-0000-4000-8000-000000000002', name: 'North Avenue Hub', area: hubArea('Quezon City', 'Metro Manila', 'National Capital Region') }, available: true, match_tier: 'same_city', recommendation_reason: 'same_city', distance_km: 8.3, status: 'active', recommended: true, default: false },
    { id: ids.providerExactNoDistance, business_name: 'Quezon City Parcel Cooperative', hub: { id: '51000000-0000-4000-8000-000000000003', name: 'Commonwealth Hub', area: hubArea('Quezon City', 'Metro Manila', 'National Capital Region') }, available: true, match_tier: 'same_city', recommendation_reason: 'same_city', distance_km: null, status: 'active', recommended: false, default: false },
    // The API's historical SameCity tier compares city/province/country only.
    // Keep a same-city but different-region record to catch the UI requirement.
    { id: ids.providerDifferentRegion, business_name: 'Quezon City Provincial Link', hub: { id: '51000000-0000-4000-8000-000000000004', name: 'Quezon City North Hub', area: hubArea('Quezon City', 'Metro Manila', 'Central Luzon') }, available: true, match_tier: 'same_city', recommendation_reason: 'same_city', distance_km: 13.1, status: 'active', recommended: false, default: false },
    { id: ids.providerSameRegion, business_name: 'Pasig Same Region Logistics', hub: { id: '51000000-0000-4000-8000-000000000005', name: 'Pasig Hub', area: hubArea('Pasig', 'Metro Manila', 'National Capital Region') }, available: true, match_tier: 'same_region', recommendation_reason: 'same_region', distance_km: null, status: 'active', recommended: false, default: false },
    { id: ids.providerEnabled, business_name: 'Harbor Parcel Cooperative', hub: { id: '51000000-0000-4000-8000-000000000001', name: 'Port District Hub', area: hubArea('Manila', 'Metro Manila', 'National Capital Region') }, available: true, match_tier: 'same_province', recommendation_reason: 'same_province', distance_km: 17.6, status: 'active', recommended: false, default: true },
  ]

  const sku = (id, code, name, status, on_hand, reserved, alert_threshold, stock_state, productStatus = 'active', variant = null) => ({
    id, code, status,
    product: { id: `product-${id}`, name, status: productStatus },
    variant,
    on_hand, reserved, available: on_hand - reserved,
    alert_threshold,
    stock_state,
  })
  const activeSku = sku(ids.skuActive, 'BASKET-NAT', 'Cedar Storage Basket', 'active', 11, 2, null, 'in_stock', 'active', { id: 'variant-1', sku: 'BASKET-NAT', option_values: [{ group: 'Color', value: 'Natural' }] })
  const lowSku = sku(ids.skuLow, 'OLIVE-500', 'Olive Oil Set', 'active', 6, 2, 4, 'low')
  const outSku = sku(ids.skuOut, 'MUG-GLAZE', 'Blue Glaze Mug', 'active', 3, 3, 0, 'out')
  const archivedSku = sku(ids.skuArchived, 'LINEN-ARCH', 'Linen Gift Set', 'inactive', 9, 2, 5, 'in_stock', 'archived')
  const inventoryItems = state.inventoryItems = [activeSku, lowSku, outSku, archivedSku]
  state.inventoryMovements[ids.skuActive] = [
    { id: 'movement-3', movement_type: 'fulfillment', on_hand_delta: -2, reserved_delta: -2, resulting_on_hand: 11, resulting_reserved: 2, reason: 'First-mile pickup confirmed', reference_type: 'Order', reference_id: 'ORD-SYN-2048', created_at: '2026-10-14T06:42:00.000Z' },
    { id: 'movement-2', movement_type: 'restock', on_hand_delta: 5, reserved_delta: 0, resulting_on_hand: 13, resulting_reserved: 4, reason: 'Counted delivery from textile supplier', created_at: '2026-10-13T06:42:00.000Z' },
    { id: 'movement-1b', movement_type: 'reserve', on_hand_delta: 0, reserved_delta: 4, resulting_on_hand: 8, resulting_reserved: 4, reason: 'Order placed', reference_type: 'Order', reference_id: 'ORD-SYN-2048', created_at: '2026-10-12T06:42:00.000Z' },
    { id: 'movement-1', movement_type: 'manual_increase', on_hand_delta: 8, reserved_delta: 0, resulting_on_hand: 8, resulting_reserved: 0, reason: 'Opening stock', created_at: '2026-10-10T01:10:00.000Z' },
  ]
  state.inventoryMovements[ids.skuArchived] = [
    { id: 'movement-archived', movement_type: 'restock', on_hand_delta: 9, reserved_delta: 0, resulting_on_hand: 9, resulting_reserved: 0, reason: 'Archived catalog history', created_at: '2026-09-28T04:00:00.000Z' },
  ]

  const alert = (id, currentSku, stateValue, threshold, available, triggerAt, resolvedAt = null, resolutionReason = null) => ({
    id,
    state: stateValue,
    alert_type: available === 0 ? 'out_of_stock' : 'low_stock',
    product: currentSku.product,
    sku: { id: currentSku.id, code: currentSku.code, variant: currentSku.variant ? { id: currentSku.variant.id, sku: currentSku.variant.sku } : null },
    trigger_threshold: threshold,
    trigger_available: Math.max(0, threshold - 1),
    current_threshold: threshold,
    current_available: available,
    triggered_at: triggerAt,
    resolved_at: resolvedAt,
    resolution_reason: resolutionReason,
    trigger_movement: { id: `movement-${id.slice(-1)}`, type: 'manual_decrease', reference_type: null, reference_id: null },
    inventory_destination: `/inventory/${currentSku.id}`,
  })
  state.alertItems = [
    alert(ids.alertActive, lowSku, 'active', 4, 4, '2026-10-15T02:15:00.000Z'),
    alert(ids.alertResolved, outSku, 'resolved', 0, 2, '2026-10-12T09:30:00.000Z', '2026-10-13T04:00:00.000Z', 'stock_recovered'),
    alert(ids.alertArchived, archivedSku, 'resolved', 5, 7, '2026-09-20T08:00:00.000Z', '2026-09-22T08:00:00.000Z', 'stock_recovered'),
  ]

  const terms = (overrides = {}) => ({
    distribution_mode: 'claim_required',
    name: 'Harvest weekend savings',
    code: 'HARVEST-WKND',
    benefit_type: 'discount',
    value_type: 'percent',
    value: '12.50',
    maximum_discount: '180.00',
    minimum_spend: '750.00',
    starts_at: '2026-10-20T02:30:00.000Z',
    ends_at: '2026-10-31T15:15:00.000Z',
    global_limit: 240,
    per_customer_limit: 2,
    payment_method: 'cod',
    eligibility_scope: 'unrestricted',
    eligibility_rules: [],
    stacking_policy: null,
    terms_summary: 'Valid for eligible Cedar Home goods during the posted dates.',
    ...overrides,
  })
  const voucher = (id, overrides = {}) => {
    const voucherTerms = terms(overrides.terms)
    return {
      id,
      name: voucherTerms.name,
      code: voucherTerms.code,
      issuer_type: 'shop',
      benefit_type: voucherTerms.benefit_type,
      currency: 'PHP',
      lifecycle: 'published',
      status: 'active',
      revision: 4,
      version: 2,
      availability_revision: 6,
      is_active: true,
      authoring_supported: true,
      draft: null,
      published_at: '2026-10-14T01:00:00.000Z',
      ended_at: null,
      redeemed_count: 31,
      remaining_capacity: 209,
      customer_savings: '1460.00',
      ...overrides,
      terms: voucherTerms,
    }
  }
  const activeVoucher = voucher(ids.voucherActive, {
    terms: terms({ starts_at: '2026-10-10T02:30:00.000Z' }),
  })
  const draftVoucher = voucher(ids.voucherDraft, {
    name: 'First basket thank-you', code: 'FIRST-BASKET', lifecycle: 'draft', status: 'draft',
    revision: 2, version: 0, is_active: false, redeemed_count: 0, remaining_capacity: 180, customer_savings: '0.00',
    terms: terms({ name: 'First basket thank-you', code: 'FIRST-BASKET', value: '90.00', value_type: 'fixed', maximum_discount: null, minimum_spend: '600.00', terms_summary: 'For a first basket from Cedar Home.' }),
    draft: { id: 'voucher-version-draft', number: 1, terms: terms({ name: 'First basket thank-you', code: 'FIRST-BASKET', value: '90.00', value_type: 'fixed', maximum_discount: null, minimum_spend: '600.00', terms_summary: 'For a first basket from Cedar Home.' }) },
  })
  state.vouchers = [activeVoucher, draftVoucher]
  state.createdVoucher = null

  window.fetch = async (input, options = {}) => {
    const url = new URL(input, window.location.origin)
    const path = url.pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return originalFetch(input, options)
    const request = remember(path, url, options)
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (path === '/sanctum/csrf-cookie') return response({})
    if (path.endsWith('/auth/me')) return response({ seller: { id: sellerId, email: 'mara.santos@test.local', role: 'seller', status: 'active', profile: { first_name: 'Mara', last_name: 'Santos', profile_photo_url: null }, shop: { id: shopId, name: 'Cedar Home', status: 'active' } } })
    if (path.endsWith('/auth/logout') && request.method === 'POST') return response({})
    if (path.endsWith('/policy-consent/status')) return response({ data: { all_required_accepted: true } })
    if (path === '/api/v1/seller/chat-notifications') return response({ data: [], meta: { unread_count: 0 } })
    if (path === '/api/v1/seller/notifications') return response({ data: [], meta: { total: 0 } })

    if (path === '/api/v1/seller/pickup-addresses' && request.method === 'GET') {
      if (state.modes.pickupAddress === 'error') return response({ message: 'Pickup addresses could not be loaded.' }, 503)
      if (state.modes.pickupAddress === 'incomplete') return response({ data: [] })
      return response({ data: pickupAddresses })
    }
    if (path === '/api/v1/seller/logistics-options' && request.method === 'GET') return response({ data: rankedOptions, meta: { attribution: ['Synthetic fixture only'] } })
    if (path === '/api/v1/seller/shipping-providers' && request.method === 'GET') {
      if (state.modes.shippingRead === 'loading') await wait(850)
      if (state.modes.shippingRead === 'error') return response({ message: 'Shipping provider service is unavailable.' }, 503)
      if (state.modes.shippingRead === 'empty') return response({ data: providers.map((item) => ({ ...item, is_enabled: false })) })
      return response({ data: providers.map((item) => ({ ...item })) })
    }
    const shippingWrite = path.match(/^\/api\/v1\/seller\/shipping-providers\/([^/]+)$/)
    if (shippingWrite && request.method === 'PUT') {
      if (state.modes.shippingWrite === 'conflict') {
        const current = providers.find((item) => item.organization_id === shippingWrite[1])
        if (current) current.revision += 1
        state.modes.shippingWrite = 'normal'
        return response({ message: 'The shipping provider setting changed. Refresh and try again.' }, 409)
      }
      const current = providers.find((item) => item.organization_id === shippingWrite[1])
      if (!current) return response({ message: 'Provider not found.' }, 404)
      const input = request.body ?? {}
      if (current.revision !== null && input.expected_revision !== undefined && Number(input.expected_revision) !== current.revision) {
        return response({ message: 'The shipping provider setting changed. Refresh and try again.' }, 409)
      }
      current.is_enabled = Boolean(input.is_enabled)
      current.revision = current.revision === null ? 1 : current.revision + 1
      return response({ data: { logistics_organization_id: current.organization_id, is_enabled: current.is_enabled, revision: current.revision } })
    }

    if (path === '/api/v1/seller/inventory' && request.method === 'GET') {
      const query = url.searchParams
      if (state.modes.inventoryList === 'loading') await wait(850)
      if (state.modes.inventoryList === 'error') return response({ message: 'Inventory service is unavailable.' }, 503)
      if (state.modes.inventoryList === 'delay-search' && query.get('search') === 'Cedar') await wait(650)
      let items = inventoryItems.filter((item) => matchesSearch(item, query.get('search')))
      if (query.get('stock') === 'low') items = items.filter((item) => item.stock_state === 'low')
      if (query.get('stock') === 'out') items = items.filter((item) => item.stock_state === 'out')
      return response(paginated(state.modes.inventoryList === 'empty' ? [] : items, query, 2))
    }
    const inventoryDetail = path.match(/^\/api\/v1\/seller\/inventory\/([^/]+)$/)
    if (inventoryDetail && request.method === 'GET') {
      if (state.modes.inventoryDetail === 'error') return response({ message: 'Inventory item could not be loaded.' }, 503)
      const item = inventoryItems.find((entry) => entry.id === inventoryDetail[1])
      return item ? response({ data: { ...item } }) : response({ message: 'Inventory item not found.' }, 404)
    }
    const movementHistory = path.match(/^\/api\/v1\/seller\/inventory\/([^/]+)\/movements$/)
    if (movementHistory && request.method === 'GET') {
      if (state.modes.movements === 'error') return response({ message: 'Movement history could not be loaded.' }, 503)
      return response(paginated(state.inventoryMovements[movementHistory[1]] ?? [], url.searchParams, 30))
    }
    const thresholdUpdate = path.match(/^\/api\/v1\/seller\/inventory\/([^/]+)\/threshold$/)
    if (thresholdUpdate && request.method === 'PATCH') {
      if (state.modes.threshold === 'error') return response({ message: 'Threshold could not be saved.' }, 503)
      const item = inventoryItems.find((entry) => entry.id === thresholdUpdate[1])
      if (!item) return response({ message: 'Inventory item not found.' }, 404)
      item.alert_threshold = request.body?.alert_threshold ?? null
      item.stock_state = item.available <= 0 ? 'out' : item.alert_threshold !== null && item.available <= item.alert_threshold ? 'low' : 'in_stock'
      return response({ data: { ...item } })
    }
    const adjustment = path.match(/^\/api\/v1\/seller\/inventory\/([^/]+)\/adjustments$/)
    if (adjustment && request.method === 'POST') {
      if (state.modes.adjustment === 'forbidden') return response({ message: 'Seller access was revoked.' }, 403)
      if (state.modes.adjustment === 'validation') return response({ message: 'Review this adjustment.', errors: { quantity: ['Quantity is greater than available stock.'] } }, 422)
      const item = inventoryItems.find((entry) => entry.id === adjustment[1])
      if (!item) return response({ message: 'Inventory item not found.' }, 404)
      if (item.status !== 'active' || item.product.status === 'archived') return response({ message: 'Archived or inactive inventory cannot be adjusted.' }, 422)
      const key = request.body?.idempotency_key
      const identity = JSON.stringify(request.body)
      const previous = key ? state.receipts[`inventory:${key}`] : null
      if (previous) {
        if (previous.identity !== identity) return response({ message: 'This idempotency key was used for different inventory.' }, 409)
        return response(previous.result, 201)
      }
      const quantity = Number(request.body?.quantity)
      const type = request.body?.movement_type
      const delta = type === 'manual_decrease' ? -quantity : quantity
      const onHand = item.on_hand + delta
      if (onHand < item.reserved) return response({ message: 'The adjustment would reduce stock below the reserved quantity.', errors: { quantity: ['The adjustment would reduce stock below the reserved quantity.'] } }, 422)
      const movement = {
        id: `movement-created-${state.writes.length}`,
        movement_type: type,
        on_hand_delta: delta,
        reserved_delta: 0,
        resulting_on_hand: onHand,
        resulting_reserved: item.reserved,
        reason: request.body?.reason ?? '',
        created_at: '2026-10-15T04:30:00.000Z',
      }
      item.on_hand = onHand
      item.available = onHand - item.reserved
      item.stock_state = item.available <= 0 ? 'out' : item.alert_threshold !== null && item.available <= item.alert_threshold ? 'low' : 'in_stock'
      state.inventoryMovements[item.id] ??= []
      state.inventoryMovements[item.id].unshift(movement)
      const result = { data: movement, inventory: { ...item } }
      if (key) state.receipts[`inventory:${key}`] = { identity, result }
      if (state.modes.adjustment === 'uncertain-once') {
        state.modes.adjustment = 'normal'
        return response({ message: 'The adjustment response was not confirmed.' }, 503)
      }
      return response(result, 201)
    }

    if (path === '/api/v1/seller/low-stock-alerts' && request.method === 'GET') {
      const query = url.searchParams
      if (state.modes.alerts === 'loading') await wait(850)
      if (state.modes.alerts === 'error') return response({ message: 'Alert service is unavailable.' }, 503)
      if (state.modes.alerts === 'delay-search' && query.get('search') === 'Blue') await wait(650)
      let items = state.alertItems.filter((item) => matchesSearch(item, query.get('search')))
      if (query.get('state')) items = items.filter((item) => item.state === query.get('state'))
      if (query.get('from')) items = items.filter((item) => item.triggered_at.slice(0, 10) >= query.get('from'))
      if (query.get('to')) items = items.filter((item) => item.triggered_at.slice(0, 10) <= query.get('to'))
      const result = paginated(state.modes.alerts === 'empty' ? [] : items, query, 2)
      return response({ ...result, configured_threshold_count: state.modes.alerts === 'empty' ? 0 : 4 })
    }
    const alertDetail = path.match(/^\/api\/v1\/seller\/low-stock-alerts\/([^/]+)$/)
    if (alertDetail && request.method === 'GET') {
      if (state.modes.alertDetail === 'error') return response({ message: 'This alert could not be loaded.' }, 503)
      const item = state.alertItems.find((entry) => entry.id === alertDetail[1])
      return item ? response({ data: { ...item } }) : response({ message: 'Alert not found.' }, 404)
    }

    if (path === '/api/v1/seller/vouchers' && request.method === 'GET') {
      const query = url.searchParams
      if (state.modes.voucherList === 'loading') await wait(850)
      if (state.modes.voucherList === 'error') return response({ message: 'Voucher service is unavailable.' }, 503)
      let items = state.vouchers.filter((item) => (!query.get('search') || `${item.name} ${item.code}`.toLowerCase().includes(query.get('search').toLowerCase())) && (!query.get('status') || item.status === query.get('status')) && (!query.get('benefit') || item.benefit_type === query.get('benefit')))
      const result = paginated(state.modes.voucherList === 'empty' ? [] : items, query, 1)
      return response({ data: result.data, meta: { current_page: result.current_page, last_page: result.last_page, total: result.total } })
    }
    if (path === '/api/v1/seller/vouchers' && request.method === 'POST') {
      return mutateVoucher(request, null, 'create')
    }
    const voucherRoute = path.match(/^\/api\/v1\/seller\/vouchers\/([^/]+)(?:\/(draft|publish|duplicate|pause|resume|end|discard|versions|actions|redemptions))?$/)
    if (voucherRoute && request.method === 'GET') {
      const [, id, suffix] = voucherRoute
      if (suffix && ['versions', 'actions', 'redemptions'].includes(suffix)) {
        const result = paginated([], url.searchParams, 15)
        return response({
          data: result.data,
          meta: { current_page: result.current_page, last_page: result.last_page, total: result.total },
        })
      }
      if (state.modes.voucherDetail === 'error') return response({ message: 'Voucher could not be loaded.' }, 503)
      const item = state.vouchers.find((entry) => entry.id === id)
      return item ? response({ data: structuredClone(item) }) : response({ message: 'Voucher not found.' }, 404)
    }
    if (voucherRoute && ['PUT', 'POST'].includes(request.method)) {
      const [, id, suffix] = voucherRoute
      return mutateVoucher(request, id, suffix === 'draft' ? 'save' : suffix ?? 'save')
    }
    state.unhandled.push({ method: request.method, path, query: request.query })
    return response({ message: `No synthetic Seller operation fixture for ${request.method} ${path}.` }, 501)
  }

  function mutateVoucher(request, id, action) {
    const key = request.headers['idempotency-key']
    const identity = `${action}:${id ?? 'new'}:${JSON.stringify(request.body)}`
    const receipt = key ? state.receipts[`voucher:${key}`] : null
    if (receipt) {
      if (receipt.identity !== identity) return response({ message: 'This idempotency key was reused for another request.' }, 409)
      return response({ data: structuredClone(receipt.result) }, id ? 200 : 201)
    }
    if (state.modes.voucherWrite === 'error') return response({ message: 'Voucher could not be saved.', errors: { name: ['Use a different voucher name.'] } }, 422)
    if (state.modes.voucherWrite === 'conflict' && id) {
      state.modes.voucherWrite = 'normal'
      const current = state.vouchers.find((item) => item.id === id)
      if (current) current.revision += 1
      return response({ message: 'The voucher changed in another session.' }, 409)
    }

    let result
    if (!id) {
      const body = request.body ?? {}
      const normalizedTerms = terms({
        ...body,
        code: body.code || 'AIS-BROWSER-0001',
        distribution_mode: 'claim_required',
        eligibility_scope: 'unrestricted',
        eligibility_rules: [],
        stacking_policy: null,
        payment_method: 'cod',
      })
      result = voucher(ids.voucherCreated, {
        name: normalizedTerms.name,
        code: normalizedTerms.code,
        lifecycle: 'draft', status: 'draft', revision: 1, version: 0, is_active: false,
        redeemed_count: 0, remaining_capacity: normalizedTerms.global_limit, customer_savings: '0.00',
        terms: normalizedTerms,
        draft: { id: 'created-draft-version', number: 1, terms: normalizedTerms },
      })
      state.createdVoucher = result
      state.vouchers.unshift(result)
    } else {
      const existing = state.vouchers.find((item) => item.id === id)
      if (!existing) return response({ message: 'Voucher not found.' }, 404)
      result = structuredClone(existing)
      if (action === 'save') {
        const body = request.body ?? {}
        if (Number(body.revision) !== existing.revision) return response({ message: 'The voucher changed in another session.' }, 409)
        const savedTerms = terms({ ...body, distribution_mode: 'claim_required', payment_method: 'cod', eligibility_scope: 'unrestricted', eligibility_rules: [], stacking_policy: null })
        result.revision += 1
        result.terms = existing.lifecycle === 'published' ? existing.terms : savedTerms
        result.draft = { id: `draft-${result.revision}`, number: result.version + 1, terms: savedTerms }
        result.name = savedTerms.name
        result.code = savedTerms.code
      } else if (action === 'publish') {
        const draft = existing.draft?.terms ?? existing.terms
        result.terms = structuredClone(draft)
        result.name = draft.name
        result.code = draft.code
        result.lifecycle = 'published'
        result.version += 1
        result.revision += 1
        result.status = new Date(draft.starts_at) > new Date('2026-10-15T00:00:00.000Z') ? 'scheduled' : 'active'
        result.is_active = true
        result.draft = null
      } else if (action === 'pause' || action === 'resume') {
        result.is_active = action === 'resume'
        result.status = result.is_active ? 'active' : 'paused'
        result.revision += 1
      } else if (action === 'duplicate') {
        result = voucher(ids.voucherCreated, {
          ...existing,
          id: ids.voucherCreated,
          name: `${existing.name} copy`,
          code: 'AIS-COPY-0001',
          lifecycle: 'draft', status: 'draft', revision: 1, version: 0, is_active: false,
          redeemed_count: 0, remaining_capacity: existing.terms.global_limit, customer_savings: '0.00',
          terms: terms({ ...existing.terms, name: `${existing.name} copy`, code: 'AIS-COPY-0001', distribution_mode: 'claim_required' }),
          draft: { id: 'copy-draft', number: 1, terms: terms({ ...existing.terms, name: `${existing.name} copy`, code: 'AIS-COPY-0001', distribution_mode: 'claim_required' }) },
        })
        state.vouchers.unshift(result)
      } else if (action === 'end') {
        result.lifecycle = 'ended'
        result.status = 'ended'
        result.is_active = false
        result.revision += 1
      }
      if (action !== 'duplicate') state.vouchers = state.vouchers.map((item) => item.id === id ? result : item)
    }
    if (key) state.receipts[`voucher:${key}`] = { identity, result: structuredClone(result) }
    if (state.modes.voucherWrite === 'uncertain-once') {
      state.modes.voucherWrite = 'normal'
      return response({ message: 'The voucher response was not confirmed.' }, 503)
    }
    return response({ data: structuredClone(result) }, id ? 200 : 201)
  }

  return { sellerId, shopId, ids }
}
