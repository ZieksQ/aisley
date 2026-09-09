import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

let server
let actions
let logisticsOptions
let ApiError
let storage
let requests
let respond
const originalFetch = globalThis.fetch
const originalDocument = globalThis.document
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
  actions = await server.ssrLoadModule('/src/lib/sellerOrderActions.ts')
  logisticsOptions = await server.ssrLoadModule('/src/lib/sellerLogisticsOptions.ts')
  ;({ ApiError } = await server.ssrLoadModule('/src/lib/api.ts'))
  globalThis.document = { cookie: 'XSRF-TOKEN=test-csrf' }
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  } })
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 })
    requests.push({ url, options })
    return respond()
  }
})

beforeEach(() => {
  storage = new Map()
  requests = []
  respond = () => Response.json({ data: { status: 'seller_processing', capabilities: { can_prepare: true } } })
})

after(async () => {
  globalThis.fetch = originalFetch
  if (originalDocument === undefined) delete globalThis.document
  else globalThis.document = originalDocument
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else delete globalThis.sessionStorage
  await server?.close()
})

test('approval sends a credentialed action with CSRF and a UUID, without an arbitrary status', async () => {
  const result = await actions.createOrderApproval('seller-one', 'order-one')()
  assert.equal(result.data.status, 'seller_processing')
  const { url, options } = requests[0]
  assert.ok(url.endsWith('/api/v1/seller/orders/order-one/approve'))
  assert.equal(options.method, 'POST')
  assert.equal(options.credentials, 'include')
  assert.equal(options.headers.get('X-XSRF-TOKEN'), 'test-csrf')
  assert.match(options.headers.get('Idempotency-Key'), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  assert.equal(options.body, undefined)
  assert.equal(storage.size, 0)
})

test('uncertain network outcomes keep the same key across retries and page reloads', async () => {
  const accept = actions.createOrderApproval('seller-one', 'order-one')
  respond = () => { throw new TypeError('Network lost') }
  await assert.rejects(accept(), /Network lost/)
  await assert.rejects(accept(), /Network lost/)
  const restored = actions.createOrderApproval('seller-one', 'order-one')
  respond = () => Response.json({ data: { status: 'seller_processing' } })
  await restored()
  assert.equal(new Set(requests.map(({ options }) => options.headers.get('Idempotency-Key'))).size, 1)
  assert.equal(storage.size, 0)
})

test('separate orders and sellers never share an action key', async () => {
  respond = () => { throw new TypeError('Offline') }
  for (const [seller, order] of [['one', 'a'], ['one', 'b'], ['two', 'a']]) {
    await assert.rejects(actions.createOrderApproval(seller, order)())
  }
  assert.equal(new Set(requests.map(({ options }) => options.headers.get('Idempotency-Key'))).size, 3)
})

test('a stale conflict is surfaced to the screen for refetch without an automatic second approval', async () => {
  respond = () => Response.json({ code: 'ORDER_NOT_ACCEPTABLE', message: 'Order has changed.' }, { status: 409 })
  await assert.rejects(actions.createOrderApproval('one', 'a')(), (error) => error instanceof ApiError && error.status === 409 && error.code === 'ORDER_NOT_ACCEPTABLE')
  assert.equal(requests.length, 1)
})

test('marking a notification read never calls the approval endpoint', async () => {
  await actions.markOrderNotificationRead('notification-one')
  assert.equal(requests.length, 1)
  assert.ok(requests[0].url.endsWith('/api/v1/seller/notifications/notification-one/read'))
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.headers.has('Idempotency-Key'), false)
  assert.equal(requests[0].options.body, undefined)
})

test('rejection and pickup requests send only their permitted payloads', async () => {
  await actions.createOrderRejection('seller-one', 'order-one', 'Cannot fulfill')()
  assert.ok(requests[0].url.endsWith('/orders/order-one/reject'))
  assert.deepEqual(JSON.parse(requests[0].options.body), { reason: 'Cannot fulfill' })
  requests = []
  respond = () => Response.json({ data: { id: 'pickup-one', status: 'pending_logistics', order_ids: ['one', 'two'] } })
  await actions.createPickupRequest('seller-one', ['one', 'two'], 'logistics-one', { one: 'address-one', two: 'address-two' })()
  assert.ok(requests[0].url.endsWith('/api/v1/seller/orders/pickup-requests'))
  assert.deepEqual(JSON.parse(requests[0].options.body), { order_ids: ['one', 'two'], logistics_organization_id: 'logistics-one', pickup_address_ids: { one: 'address-one', two: 'address-two' } })
  assert.equal('pickup_date' in JSON.parse(requests[0].options.body), false)
})

test('logistics options deduplicate concurrent and short-lived repeated reads', async () => {
  respond = () => Response.json({ data: [], meta: { attribution: ['Geoapify'] } })

  await Promise.all([
    logisticsOptions.getSellerLogisticsOptions('seller-options-cache'),
    logisticsOptions.getSellerLogisticsOptions('seller-options-cache'),
  ])
  await logisticsOptions.getSellerLogisticsOptions('seller-options-cache')

  assert.equal(requests.length, 1)
  assert.ok(requests[0].url.endsWith('/api/v1/seller/logistics-options'))

  await logisticsOptions.getSellerLogisticsOptions('seller-options-cache', true)
  assert.equal(requests.length, 2)
})
