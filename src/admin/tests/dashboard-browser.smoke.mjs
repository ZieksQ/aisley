// Real Chromium with mocked HTTP contracts; no accounts, mutations, or application database.
// Start Admin Vite on 15175 and ChromeDriver on 19515; run from src/admin.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const artifacts = resolve('node_modules/.cache/dashboard-browser')
await mkdir(artifacts, { recursive: true })
const driver = process.env.DASHBOARD_DRIVER ?? 'http://127.0.0.1:19515'
const origin = process.env.DASHBOARD_ORIGIN ?? 'http://127.0.0.1:15175'

async function command(method, path, body) {
  const response = await fetch(`${driver}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const payload = await response.json()
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`)
  return payload.value
}

function mockApi() {
  const original = window.fetch.bind(window)
  const defaults = ['registrations.view', 'support-tickets.view', 'seller_compliance.manage']
  const permissions = JSON.parse(localStorage.getItem('dashboard-test-permissions') ?? JSON.stringify(defaults))
  const state = window.dashboardFixture = {
    delay: 400, support: 3, compliance: 2, supportUnavailable: false, deniedSections: false,
    nextError: null, consentError: false, networkFailure: false, requests: [], writes: [], active: 0, maximum: 0,
  }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin)
    const path = parsed.pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url, options)
    if (options.method && options.method !== 'GET') state.writes.push(path)
    if (path.endsWith('/auth/me')) return json({ admin: { id: '30000000-0000-4000-8000-000000000001', role: 'admin', status: 'active', email: 'browser@example.com', profile: { first_name: 'Test', last_name: 'Admin', profile_photo_url: null }, permissions } })
    if (path === '/api/v1/policy-consent/status') return json({ data: { all_required_accepted: true, policies: [] } })
    if (path.endsWith('/auth/logout')) return json({})
    if (path === '/api/v1/admin/dashboard') {
      state.requests.push(path)
      state.maximum = Math.max(state.maximum, ++state.active)
      try {
        await new Promise((done, reject) => {
          const timer = setTimeout(done, state.delay)
          const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
          if (options.signal?.aborted) abort()
          else options.signal?.addEventListener('abort', abort, { once: true })
        })
        if (state.nextError) {
          const error = state.nextError
          state.nextError = null
          return json({ message: 'Fixture access or infrastructure failure.', code: error === 403 && state.consentError ? 'POLICY_CONSENT_REQUIRED' : undefined }, error)
        }
        if (state.networkFailure) throw new TypeError('Offline fixture')
        const allowed = (permission) => permissions.includes(permission) && !state.deniedSections
        const summary = (count, destination) => ({ state: 'ready', count, filter: { status: 'open' }, destination })
        return json({ data: {
          registrations: allowed('registrations.view') ? { pending: { total: 3, by_role: { customer: 1, seller: 1, logistics: 1 } }, action_items: [{ id: '10000000-0000-4000-8000-000000000001', role: 'logistics', submitted_at: '2026-10-01T08:00:00Z' }] } : null,
          support_tickets: allowed('support-tickets.view') ? { ...summary(state.support, '/support-tickets?status=open'), ...(state.supportUnavailable ? { state: 'unavailable', count: null } : {}) } : null,
          seller_compliance: allowed('seller_compliance.manage') ? summary(state.compliance, '/seller-compliance?status=open') : null,
          generated_at: '2026-10-02T08:00:00Z',
        } })
      } finally { state.active-- }
    }
    if (path === '/api/v1/admin/support-tickets') {
      state.requests.push(path + parsed.search)
      return json({ items: [], next_cursor: null })
    }
    if (path === '/api/v1/admin/seller-compliance/cases') {
      state.requests.push(path + parsed.search)
      return json({ data: [], meta: { total: 0, current_page: 1, last_page: 1, from: null, to: null } })
    }
    return json({ data: [], items: [] })
  }
}

const session = await command('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'chrome', 'goog:chromeOptions': { args: [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=390,850', `--user-data-dir=${artifacts}/profile`,
] } } } })
const path = `/session/${session.sessionId}`
const js = (script, args = []) => command('POST', `${path}/execute/sync`, { script, args })
const cdp = (cmd, params = {}) => command('POST', `${path}/goog/cdp/execute`, { cmd, params })
const go = (route) => command('POST', `${path}/url`, { url: `${origin}${route}` })
async function click(selector) {
  const element = await command('POST', `${path}/element`, { using: 'css selector', value: selector })
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {})
}
async function until(script, label) {
  const end = Date.now() + 15000
  while (Date.now() < end) {
    if (await js(script)) return
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
const refresh = 'main section > div > div > button'

try {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${mockApi.toString()})();` })
  await cdp('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage' })
  await go('/dashboard')
  await until('return document.body.innerText.includes("Registration Action Center")', 'initial summary')
  assert.equal(await js('return dashboardFixture.writes.length'), 0, 'Dashboard wrote domain/read-marker state')
  assert.equal(await js('return document.querySelector(\'section[aria-label="Open support tickets"] .text-3xl\').textContent'), '3')
  for (const theme of ['light', 'dark']) {
    await js('document.documentElement.classList.toggle("dark", arguments[0] === "dark")', [theme])
    for (const width of [390, 768, 1280]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 1024 })
      assert.equal(await js('return document.documentElement.scrollWidth <= innerWidth + 2'), true, `${theme} overflow at ${width}`)
      assert.equal(await js('return [...document.querySelectorAll(\'section[aria-label^="Open "]\')].every(s => getComputedStyle(s).backgroundColor === (document.documentElement.classList.contains("dark") ? "rgb(23, 20, 27)" : "rgb(255, 255, 255)"))'), true, 'Card theme mismatch')
    }
    await writeFile(`${artifacts}/${theme}.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'))
  }
  await js(`document.querySelector('${refresh}').focus()`)
  await command('POST', `${path}/actions`, { actions: [{ type: 'key', id: 'keyboard', actions: [
    { type: 'keyDown', value: '\uE004' }, { type: 'keyUp', value: '\uE004' },
    { type: 'keyDown', value: '\uE008' }, { type: 'keyDown', value: '\uE004' },
    { type: 'keyUp', value: '\uE004' }, { type: 'keyUp', value: '\uE008' },
  ] }] })
  await until(`return dashboardFixture.active === 0 && !document.querySelector('${refresh}').disabled`, 'settled foreground refresh')
  await js(`document.querySelector('${refresh}').focus()`)
  assert.equal(await js('return document.activeElement.textContent.includes("Refresh dashboard") && getComputedStyle(document.activeElement).outlineStyle !== "none"'), true, 'Refresh focus indicator')
  const focused = await command('GET', `${path}/element/active`)
  await command('POST', `${path}/element/${focused['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: '\uE007' })
  await until('return dashboardFixture.requests.length >= 2 && dashboardFixture.active === 0', 'keyboard refresh')
  await js('dashboardFixture.maximum = 0; dashboardFixture.support = 0; dashboardFixture.compliance = 0; dashboardFixture.delay = 600; window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Loading dashboard")', 'refresh loading')
  await until('return document.body.innerText.includes("No open records")', 'real zero')
  assert.equal(await js('return dashboardFixture.maximum'), 1, 'Overlapping reads')
  await js('dashboardFixture.supportUnavailable = true; window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Count unavailable")', 'section failure')
  assert.equal(await js('return document.querySelector(\'section[aria-label="Open compliance cases"] .text-3xl\').textContent'), '0', 'Successful section erased')
  await js('dashboardFixture.networkFailure = true; window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Previous results are stale")', 'stale network result')
  await js('dashboardFixture.networkFailure = false; dashboardFixture.supportUnavailable = false; window.dispatchEvent(new Event("focus"))')
  await until('return !document.body.innerText.includes("Previous results are stale") && dashboardFixture.active === 0', 'recovery')
  await js('dashboardFixture.nextError = 500; window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Fixture access or infrastructure failure") && !document.querySelector(\'section[aria-label="Open support tickets"]\')', 'infrastructure failure clears cached sections')
  await click(refresh)
  await until('return document.body.innerText.includes("Registration Action Center") && dashboardFixture.active === 0', 'explicit retry')
  await js('dashboardFixture.nextError = 429; window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Too many requests") && document.body.innerText.includes("Previous results are stale")', 'throttled stale state')
  const throttledReads = await js('return dashboardFixture.requests.length')
  await js('window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("online"))')
  assert.equal(await js('return dashboardFixture.requests.length'), throttledReads, 'Throttling triggered automatic read retries')
  await click(refresh)
  await until('return !document.body.innerText.includes("Too many requests") && dashboardFixture.active === 0', 'throttle recovery')
  await click('a[href="/support-tickets?status=open"]')
  await until('return dashboardFixture.requests.some(p => p === "/api/v1/admin/support-tickets?status=open")', 'exact support queue filter')
  assert.equal(await js('return document.querySelector(\'section[aria-label="Support queue"] select\').value'), 'open')
  await js('history.back()')
  await until('return document.body.innerText.includes("Registration Action Center")', 'return from support')
  await click('a[href="/seller-compliance?status=open"]')
  await until('return dashboardFixture.requests.some(p => p.includes("/seller-compliance/cases?") && new URLSearchParams(p.split("?")[1]).get("status") === "open")', 'exact compliance queue filter')
  await go('/dashboard')
  await until('return document.body.innerText.includes("Registration Action Center")', 'dashboard reload')
  await js('dashboardFixture.deniedSections = true; window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("No dashboard queues are available")', 'server revoked sections clear cached counts')
  assert.equal(await js('return Boolean(document.querySelector(\'a[href="/support-tickets?status=open"]\'))'), false)
  for (const permissions of [[], ['support-tickets.view'], ['seller_compliance.manage']]) {
    await js('localStorage.setItem("dashboard-test-permissions", JSON.stringify(arguments[0]))', [permissions])
    await go('/dashboard')
    await until('return dashboardFixture.requests.includes("/api/v1/admin/dashboard") && dashboardFixture.active === 0', 'non-registration access')
    assert.equal(await js('return document.body.innerText.includes("Registration Action Center")'), false)
    assert.equal(await js('return Boolean(document.querySelector(\'section[aria-label="Open support tickets"]\'))'), permissions.includes('support-tickets.view'))
    assert.equal(await js('return Boolean(document.querySelector(\'section[aria-label="Open compliance cases"]\'))'), permissions.includes('seller_compliance.manage'))
  }
  await js('dashboardFixture.nextError = 403; window.dispatchEvent(new Event("focus"))')
  await until('return document.body.innerText.includes("Fixture access or infrastructure failure") && !document.querySelector(\'section[aria-label="Open compliance cases"]\')', 'forbidden clears private state')
  assert.equal(await js('return location.pathname'), '/dashboard', 'Forbidden was treated as a sign-in loop')
  await js('dashboardFixture.consentError = true; dashboardFixture.nextError = 403; window.dispatchEvent(new Event("focus"))')
  await until('return location.pathname === "/policy-consent"', 'consent redirect')
  await go('/dashboard')
  await until('return dashboardFixture.active === 0 && document.body.innerText.includes("Open compliance cases")', 'ready before session expiration')
  await js('dashboardFixture.nextError = 401; window.dispatchEvent(new Event("focus"))')
  await until('return location.pathname === "/login"', 'session cleanup')
  console.log('Admin dashboard browser smoke passed: themes, widths, keyboard/focus, exact queue links, zero/unavailable/stale/loading, independent permissions, revoked access, consent, and 401 cleanup.')
} finally {
  await command('DELETE', path)
}
