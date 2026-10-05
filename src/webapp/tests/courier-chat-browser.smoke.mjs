// Real Chromium interaction with mocked HTTP contracts; never touches seeded accounts or a database.
// Start storefront on 15173 and chromedriver on 19515 before running this script from src/webapp.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const artifacts = resolve('node_modules/.cache/courier-chat-browser')
await mkdir(artifacts, { recursive: true })
const driver = process.env.CHAT_BROWSER_DRIVER ?? 'http://127.0.0.1:19515'
const origin = process.env.CHAT_BROWSER_BUYER ?? 'http://127.0.0.1:15173'

async function command(method, path, body) {
  const response = await fetch(`${driver}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`)
  return payload.value
}

// This fixture models an accepted final-mile Courier task; API authorization is tested separately in Laravel.
function mockApi() {
  const original = window.fetch.bind(window)
  const order = '10000000-0000-4000-8000-000000000001'
  const id = '20000000-0000-4000-8000-000000000001'
  const state = window.chatFixture = {
    active: false, messages: [], keys: [], replays: {}, read: 0,
    loseResponse: false, nextError: null, delay: 0, deny: false,
  }
  const conversation = () => ({
    id, order_id: order, order_reference: 'ORDER-SMOKE', task_reference: 'PARCEL-SMOKE',
    last_message_preview: state.messages.at(-1)?.body ?? null,
    last_sequence: state.messages.length, last_read_sequence: state.read,
    unread_count: state.messages.filter((message) => !message.mine && message.sequence > state.read).length,
    send_allowed: state.active, read_only_reason: state.active ? null : 'TASK_NOT_ACTIVE',
  })
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (url, options = {}) => {
    const path = new URL(url, location.origin).pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url, options)
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (path === '/sanctum/csrf-cookie') return json({})
    if (path.endsWith('/auth/me')) return json({ customer: {
      id: '30000000-0000-4000-8000-000000000001', role: 'customer', status: 'active',
      displayName: 'Browser Buyer', avatarUrl: null,
    } })
    if (path === '/api/v1/policy-consent/status') return json({ data: { all_required_accepted: true } })
    if (path.includes('/notifications')) return json({ data: [], meta: { total: 0 } })
    if (path === '/api/v1/customer/home') return json({
      viewer: { isAuthenticated: true, displayName: 'Browser Buyer', email: null, deliveryLocation: null, cartItemCount: 0 },
      campaigns: { hero: [], side: [] }, advertisementLayer: null, quickActions: [], categories: [],
      flashDeals: null, topProducts: [], recentlyViewed: [], recommendations: { items: [], nextCursor: null, pageSize: 20 },
    })
    if (path === '/api/v1/customer/cart') return json({ data: { items: [], itemCount: 0 } })
    if (path.endsWith('/unread-count')) return json({ unread_count: 0 })
    if (path.startsWith('/api/v1/customer/orders/')) return json({ data: {
      id: order, reference: 'ORDER-SMOKE', status: 'assigned', statusLabel: 'Scheduled for delivery',
      group: 'to_ship', groupLabel: 'To Ship', placedAt: '2026-10-02T00:00:00Z',
      shop: { id: '40000000-0000-4000-8000-000000000001', name: 'Test Shop', slug: 'test-shop' },
      delivery: { status: 'assigned', courier: { name: 'Test Courier', contactNumber: null } },
      deliveryAddress: { recipientName: 'Test Buyer', addressLine1: '1 Test Road', barangay: 'Test',
        cityMunicipality: 'Manila', province: 'Metro Manila', postalCode: '1000', country: 'PH' },
      payment: { method: 'cod', status: 'pending' }, items: [], actions: {},
      totals: { merchandiseSubtotal: '100', shippingFee: '0', discount: '0', shippingDiscount: '0', payable: '100', currency: 'PHP' },
      timeline: [], timelineCount: 0, timelineHasMore: false, vouchers: [], map: { available: false, state: 'unavailable', message: 'No live map.' },
    } })
    if (!path.includes('/courier-conversations')) return json({})
    if (state.deny) return json({ message: 'This conversation is unavailable.' }, 404)
    if (state.delay) await new Promise((done) => setTimeout(done, state.delay))
    if (path.includes('/order-context/')) return json({ data: { order_id: order, order_reference: 'ORDER-SMOKE', send_allowed: state.active, conversation_id: state.messages.length ? id : null } })
    if (options.method === 'POST') {
      const input = JSON.parse(options.body)
      if (path.endsWith('/read')) { state.read = Math.max(state.read, input.last_read_sequence); return json({ data: conversation() }) }
      const key = new Headers(options.headers).get('Idempotency-Key')
      state.keys.push(key)
      if (state.replays[key]) return json(state.replays[key])
      if (state.nextError) {
        const error = state.nextError
        state.nextError = null
        return json({ message: 'Fixture validation or rate limit.', errors: error === 422 ? { body: ['Invalid message text.'] } : {} }, error)
      }
      if (!state.active) return json({ code: 'TASK_NOT_ACTIVE', message: 'This pickup has ended.' }, 409)
      const message = { id: crypto.randomUUID(), sequence: state.messages.length + 1, mine: true, body: input.body, created_at: new Date().toISOString() }
      state.messages.push(message)
      const result = { conversation: conversation(), message }
      state.replays[key] = result
      if (state.loseResponse) { state.loseResponse = false; throw new TypeError('Lost response after commit') }
      return json(result, 201)
    }
    if (path.endsWith('/messages')) {
      const cursor = Number(new URL(url, location.origin).searchParams.get('cursor') ?? state.messages.length)
      const eligible = state.messages.filter((message) => message.sequence <= cursor)
      const data = eligible.slice(-20)
      return json({ data, meta: { next_cursor: eligible.length > data.length ? String(data[0].sequence - 1) : null } })
    }
    if (path.endsWith('/courier-conversations')) return json({ data: state.messages.length ? [conversation()] : [], meta: { next_cursor: null, unread_count: conversation().unread_count } })
    return json({ data: conversation() })
  }
}

const session = await command('POST', '/session', { capabilities: { alwaysMatch: {
  browserName: 'chrome', 'goog:chromeOptions': { args: [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=390,850',
    `--user-data-dir=${artifacts}/profile`,
  ] },
} } })
const path = `/session/${session.sessionId}`
const js = (script, args = []) => command('POST', `${path}/execute/sync`, { script, args })
const cdp = (cmd, params = {}) => command('POST', `${path}/goog/cdp/execute`, { cmd, params })
const go = (route) => command('POST', `${path}/url`, { url: `${origin}${route}` })
async function click(selector) {
  const element = await command('POST', `${path}/element`, { using: 'css selector', value: selector })
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {})
}
async function type(text) {
  const element = await command('POST', `${path}/element`, { using: 'css selector', value: '#courier-message' })
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/value`, { text })
}
async function until(script, label, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await js(script)) return
    await new Promise((done) => setTimeout(done, 150))
  }
  throw new Error(`Timed out: ${label}`)
}
const order = '10000000-0000-4000-8000-000000000001'
const send = 'form:has(#courier-message) button[type=submit]'

try {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${mockApi.toString()})();` })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 850, deviceScaleFactor: 1, mobile: true })
  await go('/courier-messages')
  await until('return document.body.innerText.includes("No conversations yet.")', 'empty inbox')
  await go(`/orders/${order}`)
  await until('return document.body.innerText.includes("Messaging opens after final-mile acceptance")', 'offered task is not contactable')
  assert.equal(await js('return Boolean(document.querySelector(\'a[href^="/courier-messages?order="]\'))'), false)
  await js('chatFixture.active = true; window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Message delivery Courier")', 'eligible Order entry')
  await click('a[href^="/courier-messages?order="]')
  await until('return document.querySelector("#courier-message")?.disabled === false', 'first-message composer')
  await js('chatFixture.loseResponse = true')
  await type('Delivery instructions <script>alert(1)</script>')
  await click(send)
  await until('return document.body.innerText.includes("Delivery is unconfirmed")', 'uncertain first send')
  await js('window.dispatchEvent(new Event("focus"))')
  assert.equal(await js('return new URLSearchParams(location.search).has("order")'), true, 'Polling discarded an uncertain first-send context')
  await click(send)
  await until('return new URLSearchParams(location.search).has("conversation") && document.querySelector("#courier-message")?.disabled === false', 'confirmed first send')
  assert.equal(await js('return chatFixture.keys[0] === chatFixture.keys[1] && chatFixture.messages.length === 1'), true, 'Exact-key retry was not deduplicated')
  assert.equal(await js('return [...document.querySelectorAll("ol p")].some(p => p.textContent === "Delivery instructions <script>alert(1)</script>")'), true, 'Message rendered as markup')
  await js('chatFixture.messages.push({ id: crypto.randomUUID(), sequence: 2, mine: false, body: "Courier on the way", created_at: new Date().toISOString() }); window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Courier on the way") && chatFixture.read === 2', 'incoming message and read marker')
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 850, deviceScaleFactor: 1, mobile: false })
  await type('Desktop keyboard send\uE007')
  await until('return document.body.innerText.includes("Desktop keyboard send") && document.querySelector("#courier-message")?.value === ""', 'desktop Enter sends')
  for (const width of [390, 768, 1280]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 1024 })
    assert.equal(await js('return document.documentElement.scrollWidth <= innerWidth + 2'), true, `Overflow at ${width}px`)
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 850, deviceScaleFactor: 1, mobile: true })
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  await js('document.querySelector("#courier-message").focus()')
  assert.equal(await js('return document.activeElement.id'), 'courier-message', 'Composer focus')
  assert.equal(await js(`return document.querySelector('${send}').getBoundingClientRect().height >= 44`), true, 'Send target is smaller than 44px')
  await type('Touch line one\nTouch line two')
  assert.equal(await js('return document.querySelector("#courier-message").value === "Touch line one\\nTouch line two"'), true, 'Touch keyboard newline was not preserved')
  await click(send)
  await until('return document.body.innerText.includes("Touch line one") && document.body.innerText.includes("Touch line two") && document.querySelector("#courier-message")?.value === ""', 'touch composer explicit send')
  await writeFile(`${artifacts}/light.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'))
  assert.equal(await js('return getComputedStyle(document.querySelector("#courier-message")).backgroundColor'), 'rgb(255, 255, 255)', 'Storefront must remain light')
  await js('Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); window.dispatchEvent(new Event("offline"))')
  await until('return document.body.innerText.includes("You are offline")', 'offline state')
  assert.equal(await js(`return document.querySelector('${send}').disabled`), true)
  await js('Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); window.dispatchEvent(new Event("online"))')
  await type('Validation draft')
  await js('chatFixture.nextError = 422')
  await click(send)
  await until('return document.body.innerText.includes("Invalid message text")', 'validation state')
  assert.equal(await js('return document.querySelector("#courier-message").disabled'), false)
  await js('chatFixture.nextError = 429')
  await click(send)
  await until('return document.body.innerText.includes("Too many messages")', 'throttled safe retry')
  await click(send)
  await until('return document.querySelector("#courier-message")?.value === ""', 'retry confirmation')
  await js(`
    for (let count = 0; count < 35; count++) {
      chatFixture.messages.push({ id: crypto.randomUUID(), sequence: chatFixture.messages.length + 1,
        mine: false, body: 'Long-pause Courier message ' + count, created_at: new Date().toISOString() });
    }
    window.dispatchEvent(new Event('focus'));
  `)
  await until('return document.body.innerText.includes("Long-pause Courier message 34") && [...document.querySelectorAll("button")].some(b => b.textContent === "Load earlier messages")', 'paging gap after background pause')
  await click('section[aria-label="Courier conversation"] div[aria-label="Final-mile conversation messages"] button')
  await until(`return document.querySelectorAll('section[aria-label="Courier conversation"] ol li').length === chatFixture.messages.length`, 'complete deduplicated older history')
  await js('chatFixture.active = false; window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Existing history remains available")', 'delivery read-only state')
  assert.equal(await js('return document.querySelector("#courier-message").disabled'), true)
  await js('chatFixture.deny = true; window.dispatchEvent(new Event("focus"))')
  await until('return !document.body.innerText.includes("Courier on the way") && !document.querySelector("#courier-message")', 'scoped denial clears private history')
  console.log('Buyer Courier browser smoke passed: Order entry, empty inbox, first-send replay, plain text, incoming/read, responsive widths, desktop Enter, mobile newline, focus, light-only, offline, validation, rate limit, read-only, denial.')
} finally {
  await command('DELETE', path)
}
