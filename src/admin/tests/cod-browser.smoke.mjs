// Real Chromium with mocked APIs. Set FINANCE_ROLE and FINANCE_ORIGIN for each dashboard; Chromium CDP uses 19225.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const role = process.env.FINANCE_ROLE ?? 'admin'
const origin = process.env.FINANCE_ORIGIN ?? 'http://127.0.0.1:15175'
assert.ok(['admin', 'logistics', 'seller'].includes(role))
const targets = await (await fetch('http://127.0.0.1:19225/json')).json()
const ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
let serial = 0
const pending = new Map()
const loaded = new Set()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.method === 'Page.javascriptDialogOpening') void cdp('Page.handleJavaScriptDialog', { accept: true })
  if (message.method === 'Fetch.requestPaused') {
    const path = new URL(message.params.request.url).pathname
    const name = path.split('/').at(-1)
    if (/^[A-Za-z0-9_.-]+\.(js|css)$/.test(name)) {
      void readFile(`src/${role}/dist/assets/${name}`).then((body) => cdp('Fetch.fulfillRequest', {
        requestId: message.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: name.endsWith('.js') ? 'text/javascript' : 'text/css' }],
        body: body.toString('base64'),
      }))
    }
  }
  if (message.method === 'Page.lifecycleEvent' && message.params.name === 'load') loaded.add(message.params.loaderId)
  if (message.method === 'Runtime.exceptionThrown') console.error('Browser error', JSON.stringify(message.params.exceptionDetails))
  if (!message.id) return
  const task = pending.get(message.id)
  pending.delete(message.id)
  if (!task) return
  clearTimeout(task.timeout)
  if (message.error) task.reject(message.error)
  else task.resolve(message.result)
})
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++serial; const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); ws.close() }, 15000); pending.set(id, { resolve, reject, timeout }); ws.send(JSON.stringify({ id, method, params })) })
}
async function js(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function until(expression) {
  for (let i = 0; i < 150; i++) {
    if (await js(`Boolean(document.body) && Boolean(${expression})`)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${expression}; ${await js('document.body.innerText')}`)
}
function fixtures(role) {
  const original = window.fetch.bind(window)
  window.confirm = () => true
  const at = '2026-10-05T01:00:00Z'
  const invoice = { id: 'invoice-1', reference: 'COD-0001', order_id: 'order-1', order_reference: 'AIS-0001', logistics_organization_id: 'org-1', collector_name: 'Final Mile', status: 'outstanding', overdue: true, total_cents: 60000, remaining_cents: 60000, currency: 'PHP', delivered_at: at, due_at: at, seller_eligible_at: at, logistics_eligible_at: at, paid_at: null, review_reason: null }
  const batch = { id: 'batch-1', reference: 'PAY-1', status: 'submitted', is_gateway: true, total_cents: 60000, currency: 'PHP', submitted_at: at, cleared_at: null, allocations: [{ order_id: 'order-1', order_reference: 'AIS-0001', amount_cents: 60000 }], attempts: [{ id: 'attempt-1', status: 'unknown', amount_cents: 60000, currency: 'PHP', provider_reference: null, created_at: at }] }
  const settings = { cod_deadline_hours: 72, seller_delay_hours: 336, logistics_delay_hours: 24, collection_time: '09:00', seller_payout_time: '09:00', logistics_payout_time: '09:00', collection_enabled: true, seller_payout_enabled: true, logistics_payout_enabled: true }
  window.financeFixture = { writes: [], mode: 'normal', navigation: crypto.randomUUID() }
  const page = (data) => ({ data, current_page: 1, last_page: 1, total: data.length, meta: { current_page: 1, last_page: 1, total: data.length } })
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin)
    const path = parsed.pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url, options)
    if (path.endsWith('/auth/me') && role === 'logistics') return json({ logistics: { id: 'logistics', email: 'logistics@example.com', role, status: 'active', profile: { first_name: 'Logistics', last_name: 'User' }, organization: { id: 'org-1', business_name: 'Final Mile', hub: { id: 'hub-1', name: 'Main Hub' } } } })
    if (path.endsWith('/auth/me') && role === 'seller') return json({ seller: { id: 'seller', email: 'seller@example.com', role, status: 'active', profile: { first_name: 'Seller', last_name: 'User' }, shop: { id: 'shop-1', name: 'Test Store', status: 'active', category: null, is_on_vacation: false } } })
    if (path.endsWith('/auth/me')) return json({ admin: { id: 'admin', role: 'admin', status: 'active', email: 'admin@example.com', profile: { first_name: 'Admin', last_name: 'User' }, permissions: sessionStorage.getItem('finance-readonly') ? ['finance.view'] : ['finance.view', 'finance.manage'] } })
    if (path.endsWith('/policy-consent/status')) return json({ data: { all_required_accepted: true, policies: [] } })
    if (!path.includes('/finance/')) return json({ data: [], unread_count: 0 })
    if (options.method && options.method !== 'GET') {
      window.financeFixture.writes.push({ path, body: JSON.parse(options.body ?? '{}') })
      return json({ data: { id: 'attempt-1', cod_remittance_batch_id: 'batch-1' } }, 202)
    }
    if (window.financeFixture.mode === 'error') return json({ message: 'Finance temporarily unavailable.' }, 503)
    if (path.endsWith('/automation')) return json({ data: { platform: settings, collection: settings, timezone: 'Asia/Manila', next_collection_at: at, gateway_enabled: true, can_manage: role !== 'seller' && !sessionStorage.getItem('finance-readonly') } })
    if (path.endsWith('/invoices')) return json({ ...page(window.financeFixture.mode === 'empty' ? [] : [invoice]), summary: { outstanding_cents: 60000, overdue_cents: 60000, currency: 'PHP' } })
    if (path.endsWith('/invoices/invoice-1')) return json({ data: invoice, batches: [batch] })
    if (path.endsWith('/remittances/batch-1')) return json({ data: batch })
    if (path.endsWith('/remittances')) return json(page([batch]))
    if (path.endsWith('/payout-obligations')) return json(page([{ order_id: 'order-1', order_reference: 'AIS-0001', beneficiary_id: 'org-1', beneficiary_name: 'Final Mile', beneficiary_type: parsed.searchParams.get('beneficiary_type'), amount_cents: 9000, currency: 'PHP', eligible_at: at, blocked: [] }]))
    if (path.endsWith('/payout-history')) return json(page([{ id: 'payout-1', beneficiary_type: 'logistics', status: 'succeeded', currency: 'PHP', amount_cents: 9000, submitted_at: at, provider_reference: 'provider-1', attempts: [] }]))
    if (path.endsWith('/sandbox')) return json({ accounts: [{ id: 'account-1', reference: 'logistics-org-1', balance_cents: 100000, scenario: 'delay', is_active: true }], transactions: page([{ id: 'tx-1', direction: 'collection', status: 'pending', amount_cents: 60000, currency: 'PHP', account_reference: 'logistics-org-1', metadata: { attempt_id: 'attempt-1' }, created_at: at }]), events: [{ id: 'event-1', delivery_attempts: 1, delivered_at: at, payload: { type: 'collection.succeeded', data: {} } }], organizations: [{ id: 'org-1', business_name: 'Final Mile' }] })
    return json(page([]))
  }
}
await cdp('Page.enable')
await cdp('Page.setLifecycleEventsEnabled', { enabled: true })
await cdp('Runtime.enable')
await cdp('Network.setCacheDisabled', { cacheDisabled: true })
await cdp('Network.setBypassServiceWorker', { bypass: true })
await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/assets/*', requestStage: 'Request' }] })
const fixtureScript = await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixtures.toString()})(${JSON.stringify(role)})` })
async function navigate(route) {
  const previous = await js('window.financeFixture?.navigation')
  await cdp('Page.navigate', { url: `${origin}${route}?cod-smoke=${crypto.randomUUID()}` })
  await until(`location.pathname === ${JSON.stringify(route)} && window.financeFixture?.navigation !== ${JSON.stringify(previous)} && document.querySelector('.finance-payments')`)
}

const routes = role === 'admin' ? ['/finance/remittances', '/finance/remittances/invoices/invoice-1', '/finance/remittances/batch-1', '/finance/payouts', '/finance/automation', '/finance/sandbox'] : role === 'logistics' ? ['/finance/remittances', '/finance/remittances/invoices/invoice-1', '/finance/remittances/batch-1', '/finance/payouts', '/finance/payment-settings'] : ['/finance/payouts', '/finance/payment-settings']
for (const width of [390, 768, 1440]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
  for (const theme of ['light', 'dark']) {
    for (const route of routes) {
      console.log('Checking', width, theme, route)
      await navigate(route)
      await js(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`)
      await until('!document.querySelector(".finance-payments")?.innerText.includes("Loading…")')
      assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, `${route}: page overflow at ${width}/${theme}`)
      assert.equal(await js('getComputedStyle(document.querySelector(".finance-payments")).color'), theme === 'dark' ? 'rgb(250, 250, 250)' : 'rgb(24, 24, 27)')
    }
  }
}
if (role === 'admin') {
await navigate('/finance/payouts')
await until('document.querySelector(".payment-table input[type=checkbox]")')
await js('document.querySelector(".payment-table input[type=checkbox]").click()')
await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Send payout").click()')
await until('window.financeFixture.writes.length === 1')
assert.equal((await js('window.financeFixture.writes[0]')).path, '/api/v1/admin/finance/payout-send')
}
if (role === 'logistics') {
  await navigate('/finance/remittances')
  await until('document.querySelector(".payment-table input[type=checkbox]")')
  await js('document.querySelector(".payment-table input[type=checkbox]").click()')
  await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Pay now").click()')
  await until('window.financeFixture.writes.length === 1')
  assert.equal((await js('window.financeFixture.writes[0]')).path, '/api/v1/logistics/finance/invoice-payments')
  await until('location.pathname === "/finance/remittances/batch-1"')
}
if (role !== 'seller') {
await navigate('/finance/remittances/batch-1')
await until('document.body.innerText.includes("Payment outcome is being checked")')
assert.equal(await js('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("Clear receipt"))'), false)
await navigate('/finance/remittances')
await until('document.body.innerText.includes("AIS-0001")')
await js('window.financeFixture.mode="empty";Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Refresh").click()')
await until('document.body.innerText.includes("No invoices match")')
await js('window.financeFixture.mode="error";Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Refresh").click()')
await until('document.querySelector("[role=alert]")?.innerText.includes("Finance temporarily unavailable")')
}
await navigate(role === 'admin' ? '/finance/automation' : '/finance/payment-settings')
await until('document.body.innerText.includes("All schedules use Asia/Manila")')
await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
assert.equal(await js('document.activeElement !== document.body'), true)
if (role === 'logistics') {
  await js('const input=document.querySelector("#collection-time");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"10:00");input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}))')
  await js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent.trim()==="Save settings").click()')
  await until('window.financeFixture.writes.length === 1')
  assert.equal((await js('window.financeFixture.writes[0]')).path, '/api/v1/logistics/finance/automation')
}
if (role === 'seller') assert.equal(await js('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.trim()==="Save settings")'), false)
if (role === 'admin') await js('sessionStorage.setItem("finance-readonly","1")')
await navigate('/finance/payouts')
await until('document.body.innerText.includes("AIS-0001")')
assert.equal(await js('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.trim()==="Send payout")'), false)
await cdp('Fetch.disable')
await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixtureScript.identifier })
ws.close()
console.log(`COD Finance browser checks passed: ${role}, ${routes.length} routes, three widths, both themes, keyboard access, role actions/permissions${role === 'seller' ? '' : ', unknown payment, empty/error states'}.`)
