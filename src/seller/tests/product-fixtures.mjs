// Synthetic Seller Product API. Keeps browser checks isolated from accounts and databases.
export function installProductFixtures() {
  const original = window.fetch.bind(window)
  const productId = '50000000-0000-4000-8000-000000000001'
  const mediaId = '60000000-0000-4000-8000-000000000001'
  const variantId = '70000000-0000-4000-8000-000000000001'
  const optionId = '80000000-0000-4000-8000-000000000001'
  const valueId = '90000000-0000-4000-8000-000000000001'
  const state = window.productFixture = {
    productId, writes: [], reads: [], requests: [], uploads: [], mode: 'normal', delaySearch: 0, empty: false, uploadFailure: false,
    products: [
      { id: productId, name: 'Cedar Storage Basket', base_sku: 'CEDAR-01', category_id: 'category-home', category: 'Home', short_description: 'Woven storage', description_markdown: null, price: '850.00', original_price: null, shipping_weight_grams: 900, shipping_length_mm: 300, shipping_width_mm: 250, shipping_height_mm: 180, unit_cost_cents: 42000, cost_currency: 'PHP', currency: 'PHP', status: 'draft', skus: [{ id: 'sku-base', code: 'CEDAR-01', on_hand: 8, reserved: 1, available: 7 }], gallery: [{ id: mediaId, url: '/media/cedar.jpg', alt_text: 'Cedar basket', position: 0, is_default: true }], description_asset_ids: [], option_groups: [{ id: optionId, name: 'Color', values: [{ id: valueId, value: 'Natural' }, { id: '90000000-0000-4000-8000-000000000002', value: 'Charcoal' }] }], variants: [{ id: variantId, sku: 'CEDAR-NAT', price: null, original_price: null, shipping_weight_grams: null, shipping_length_mm: null, shipping_width_mm: null, shipping_height_mm: null, unit_cost_cents: null, cost_currency: null, effective_price: '850.00', effective_original_price: null, inherits_price: true, status: 'active', option_value_ids: [valueId], inventory_sku_id: 'sku-variant', on_hand: 5, reserved: 1, available: 4, primary_media_id: null }] },
      { id: '50000000-0000-4000-8000-000000000002', name: 'Linen Throw', base_sku: 'LINEN-01', category_id: 'category-home', category: 'Home', short_description: null, description_markdown: null, price: '1290.00', original_price: null, shipping_weight_grams: 800, shipping_length_mm: 350, shipping_width_mm: 280, shipping_height_mm: 80, unit_cost_cents: null, cost_currency: null, currency: 'PHP', status: 'active', skus: [{ id: 'sku-linen', code: 'LINEN-01', on_hand: 14, reserved: 2, available: 12 }], gallery: [], description_asset_ids: [], option_groups: [], variants: [] },
      { id: '50000000-0000-4000-8000-000000000003', name: 'Archived Tray', base_sku: 'TRAY-01', category_id: 'category-home', category: 'Home', short_description: null, description_markdown: null, price: '500.00', original_price: null, shipping_weight_grams: 500, shipping_length_mm: 200, shipping_width_mm: 150, shipping_height_mm: 50, unit_cost_cents: null, cost_currency: null, currency: 'PHP', status: 'archived', skus: [{ id: 'sku-tray', code: 'TRAY-01', on_hand: 0, reserved: 0, available: 0 }], gallery: [], description_asset_ids: [], option_groups: [], variants: [] },
      { id: '50000000-0000-4000-8000-000000000004', name: 'Cotton Napkins', base_sku: 'COTTON-01', category_id: 'category-home', category: 'Home', short_description: null, description_markdown: null, price: '390.00', original_price: null, shipping_weight_grams: 250, shipping_length_mm: 180, shipping_width_mm: 180, shipping_height_mm: 30, unit_cost_cents: null, cost_currency: null, currency: 'PHP', status: 'draft', skus: [{ id: 'sku-cotton', code: 'COTTON-01', on_hand: 20, reserved: 0, available: 20 }], gallery: [], description_asset_ids: [], option_groups: [], variants: [] },
    ],
    product: null,
  }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const NativeXHR = window.XMLHttpRequest
  class FixtureXHR extends EventTarget {
    constructor() { super(); this.upload = new EventTarget(); this.status = 0; this.responseText = ''; this.headers = {}; this.withCredentials = false }
    open(method, url) { this.method = method; this.url = url }
    setRequestHeader(name, value) { this.headers[name] = value }
    send(body) {
      const file = body.get('image')
      const upload = { id: crypto.randomUUID(), url: this.url, name: file?.name, purpose: body.get('purpose'), upload_token: body.get('upload_token') }
      state.uploads.push(upload)
      setTimeout(() => {
        const progress = new Event('progress'); Object.assign(progress, { lengthComputable: true, loaded: 50, total: 100 }); this.upload.dispatchEvent(progress)
      }, 25)
      setTimeout(() => {
        const result = state.uploadFailure ? { status: 422, payload: { message: 'Upload rejected.', errors: { image: ['Synthetic image rejection.'] } } } : { status: 201, payload: { data: { id: upload.id, preview_url: '/assets/preview.jpg', url: '/assets/image.jpg' } } }
        this.status = result.status; this.responseText = JSON.stringify(result.payload)
        this.dispatchEvent(new Event('load'))
      }, 250)
    }
  }
  window.XMLHttpRequest = FixtureXHR
  const page = (items, searchParams) => {
    const filtered = items.filter((item) => (!searchParams.get('search') || item.name.toLowerCase().includes(searchParams.get('search').toLowerCase())) && (!searchParams.get('status') || item.status === searchParams.get('status')))
    const current_page = Number(searchParams.get('page') || 1)
    const perPage = 2
    return { data: filtered.slice((current_page - 1) * perPage, current_page * perPage), current_page, last_page: Math.max(1, Math.ceil(filtered.length / perPage)), total: filtered.length }
  }
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, location.origin)
    const path = url.pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(input, options)
    state.requests.push({ path, method: options.method ?? 'GET' })
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (options.method && options.method !== 'GET') state.writes.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : null })
    if (path === '/sanctum/csrf-cookie') return json({})
    if (path.endsWith('/auth/me')) return json({ seller: { id: '30000000-0000-4000-8000-000000000001', email: 'browser-seller@test.local', role: 'seller', status: 'active', profile: { first_name: 'Test', last_name: 'Seller', profile_photo_url: null }, shop: { id: '40000000-0000-4000-8000-000000000001', name: 'Test Shop', status: 'active' } } })
    if (path.endsWith('/policy-consent/status')) return json({ data: { all_required_accepted: true } })
    if (path.includes('/notifications')) return json({ data: [], meta: { total: 0 } })
    if (path === '/api/v1/seller/products/options') return state.mode === 'options-error' ? json({ message: 'Categories unavailable.' }, 503) : json({ categories: [{ id: 'category-home', name: 'Home & Living' }], limits: { gallery_images: 10, variant_images_per_variant: 1, image_max_bytes: 10485760, image_max_edge: 8000, image_max_pixels: 40000000 } })
    if (path === '/api/v1/seller/products' && (options.method ?? 'GET') === 'GET') {
      state.reads.push({ path, query: url.searchParams.toString() })
      if (state.mode === 'list-loading') await new Promise((done) => setTimeout(done, 1800))
      if (state.mode === 'list-delay' && url.searchParams.get('search') === 'ce') await new Promise((done) => setTimeout(done, 500))
      if (state.mode === 'list-error') return json({ message: 'Products service is unavailable.' }, 503)
      const visible = state.products.filter((item) => item.status !== 'archived' || url.searchParams.get('status') === 'archived')
      return json(page(state.empty ? [] : visible, url.searchParams))
    }
    if (path === '/api/v1/seller/products' && options.method === 'POST') {
      if (state.mode === 'save-error') return json({ message: 'Please correct the product details.', errors: { name: ['Product name is already in use.'] } }, 422)
      state.product = JSON.parse(options.body)
      return json({ data: { ...state.products[0], ...state.product, id: productId } }, 201)
    }
    const detail = path.match(/^\/api\/v1\/seller\/products\/([^/]+)$/)
    if (detail && (options.method ?? 'GET') === 'GET') {
      state.reads.push({ path })
      if (state.mode === 'detail-error') return json({ message: 'Product could not be loaded.' }, 503)
      if (detail[1] === productId) return json({ data: state.productDetail ?? state.products[0] })
      return json({ message: 'Not found.' }, 404)
    }
    if (detail && options.method === 'PATCH') {
      if (state.mode === 'save-error') return json({ message: 'Please correct the product details.', errors: { name: ['Product name is already in use.'] } }, 422)
      state.product = JSON.parse(options.body)
      return json({ data: { ...state.products[0], ...state.product, id: detail[1] } })
    }
    const action = path.match(/^\/api\/v1\/seller\/products\/([^/]+)\/(publish|archive|unarchive)$/)
    if (action) {
      const item = state.products.find((product) => product.id === action[1])
      if (item) item.status = ({ publish: 'active', archive: 'archived', unarchive: 'draft' })[action[2]]
      return json({ data: item ?? {} })
    }
    if (path.includes('/assets') || path.includes('/uploads')) return json({ data: { id: crypto.randomUUID(), preview_url: '/assets/preview.jpg', url: '/assets/image.jpg' } }, 201)
    return json({ data: [], meta: { total: 0, current_page: 1, last_page: 1 } })
  }
  window.addEventListener('beforeunload', () => { window.XMLHttpRequest = NativeXHR })
  return { productId, mediaId, variantId, optionId, valueId }
}
