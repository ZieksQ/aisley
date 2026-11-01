export function installRatesFleetFixtures() {
  const original = window.fetch.bind(window)
  const at = '2026-10-28T04:35:00Z'
  const rule = {
    id: 'rule-1', shop_category_id: 'category-1', category_id: null,
    shop_category: { id: 'category-1', name: 'Home & living' }, category: null,
    service_type: 'first_mile', included_weight_grams: 1000,
    additional_weight_grams: 500, additional_fee_cents: 1250,
    max_weight_grams: 20000, max_length_mm: 800, max_width_mm: 600, max_height_mm: 500
  }
  const cards = ['draft', 'published', 'archived'].map((status, index) => ({
    id: `card-${index + 1}`, version_number: 3 - index, status,
    currency: 'PHP', effective_at: index === 1 ? '2099-10-28T04:35:00Z' : at,
    published_at: status === 'draft' ? null : at, revision: 2,
    services: [{ id: 'service-1', service_type: 'first_mile', base_fee_cents: 3500 }],
    rules: [rule, { ...rule, id: 'rule-legacy', shop_category_id: null, category_id: 'legacy', category: { id: 'legacy', name: 'Legacy furniture' } }]
  }))
  const truck = { id: 'truck-1', plate_number: 'NDR 4827', make: 'Isuzu', model: 'N-Series', max_parcels: 60, reserved_or_onboard_parcels: 13, remaining_capacity: 47, is_active: true, availability: 'unloading', revision: 4, last_confirmed_hub: { name: 'San Pedro hub' }, active_trip: { from_hub: 'Calamba hub', to_hub: 'San Pedro hub', driver: 'Rafael Mendoza', parcel_count: 13 } }
  const driver = { courier_id: 'courier-1', name: 'Rafael Mendoza', email: 'rafael@example.test', can_drive_company_truck: true, revision: 3 }
  const vehicle = { id: 'vehicle-1', vehicle_type: 'motorcycle', plate_number: '762 QLX', make: 'Honda', model: 'Click', revision: 2, official_receipt: null, certificate_of_registration: null }
  const application = { id: 'application-1', status: 'pending', created_at: at, courier: { id: 'courier-1', name: 'Rafael Mendoza', email: 'rafael@example.test', account_status: 'pending' }, application: { id: 'registration-1', status: 'pending', submitted_at: at }, completeness: { complete: false, missing: ['government_id'] } }
  const state = window.ratesFleetFixture = { mode: 'normal', writes: [], reads: [], trucks: [truck], drivers: [driver], cards }
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  const page = (data, url) => ({ data, meta: { current_page: Number(url.searchParams.get('page') ?? 1), last_page: 2, total: data.length ? 21 : 0 }, links: {} })
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, location.origin)
    const path = url.pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(input, options)
    const method = options.method ?? 'GET'
    if (path.endsWith('/auth/me')) return json({ logistics: { id: 'logistics', email: 'ops@example.test', role: 'logistics', status: 'active', profile: { first_name: 'Lea', last_name: 'Cruz' }, organization: { id: 'org', business_name: 'Southbound Logistics', hub: { id: 'local', name: 'San Pedro hub' } } } })
    if (path.endsWith('/policy-consent/status')) return json({ data: { all_required_accepted: true, policies: [] } })
    if (path.endsWith('/csrf-cookie')) return new Response(null, { status: 204 })
    const relevant = /rate-cards|shipping-rates|courier-applications|\/vehicles|\/vehicle$|\/fleet/.test(path)
    if (relevant) state.reads.push(path)
    if (relevant && state.mode === 'error') return json({ message: 'Service unavailable. Try again.' }, 503)
    if (relevant && state.mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 1200))
    if (method !== 'GET' && relevant) {
      const body = options.body ? JSON.parse(options.body) : {}
      state.writes.push({ path, method, body })
      if (state.mode === 'validation') return json({ message: 'Please correct the plate number.', errors: { plate_number: ['This plate is already registered.'] } }, 422)
      if (path.endsWith('/publish')) { const card = cards.find((card) => path.includes(card.id)); card.status = 'published'; return json({ data: card }) }
      if (path.endsWith('/trucks')) { state.trucks.push({ ...truck, ...body, id: 'truck-2', revision: 1 }); return json({ data: state.trucks.at(-1) }) }
      if (path.includes('/trucks/')) { Object.assign(truck, body); return json({ data: truck }) }
      if (path.includes('/drivers/')) { Object.assign(driver, body); return json({ data: driver }) }
      return json({ data: {} })
    }
    if (path.endsWith('/rate-cards')) return json({ data: state.mode === 'empty' ? [] : cards, meta: { shop_categories: [{ id: 'category-1', name: 'Home & living' }] } })
    if (path.endsWith('/shipping-rates')) return json({ data: state.mode === 'empty' ? [] : [{ accepted: true, accepted_at: at, rate: { id: 'tariff-1', version_number: 2, status: 'published', currency: 'PHP', effective_at: at, published_at: at, volumetric_divisor: 5000, max_weight_grams: 30000, max_length_mm: 1000, max_width_mm: 800, max_height_mm: 600, region_surcharges: [{ id: 'surcharge-1', destination_region: 'CALABARZON', surcharge_cents: 1750 }] } }] })
    if (path.endsWith('/fleet')) return json({ data: { trucks: state.mode === 'empty' ? [] : state.trucks, drivers: state.mode === 'empty' ? [] : state.drivers } })
    if (path.endsWith('/vehicles')) return json(page(state.mode === 'empty' ? [] : [{ courier: application.courier, vehicle: { ...vehicle, official_receipt_uploaded: true, certificate_of_registration_uploaded: false } }], url))
    if (path.endsWith('/vehicle')) return json({ data: vehicle })
    if (path.endsWith('/courier-applications')) return json(page(state.mode === 'empty' ? [] : [application], url))
    if (path.endsWith('/courier-applications/application-1')) return json({ data: { ...application, organization: { id: 'org', business_name: 'Southbound Logistics', hub: { id: 'local', name: 'San Pedro hub' } }, courier: { ...application.courier, profile: { first_name: 'Rafael', last_name: 'Mendoza', contact_number: '09171234827', birth_date: '1995-04-12', age: 31, sex: 'male' }, address: null, vehicle: { id: 'vehicle-1', type: 'motorcycle', plate_number: '762 QLX', status: 'active' } }, documents: [], completeness: { ...application.completeness, required_documents: [], profile_present: true, address_present: false, vehicle_present: true }, review: null } })
    return json({ data: [], unread_count: 0, meta: { unread_count: 0, next_cursor: null } })
  }
}
