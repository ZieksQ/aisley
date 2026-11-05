// Synthetic HTTP contracts in real Chromium; no live accounts or mail are changed.
// Run from repository root with Admin Vite on 5176 and ChromeDriver on 19516.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const artifacts = resolve('node_modules/.cache/seller-compliance-browser')
await mkdir(artifacts, { recursive: true })
const origin = process.env.SELLER_COMPLIANCE_ORIGIN ?? 'http://127.0.0.1:5176'
const driver = process.env.SELLER_COMPLIANCE_DRIVER ?? 'http://127.0.0.1:19516'
async function command(method, path, body) {
  const response = await fetch(`${driver}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const payload = await response.json()
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`)
  return payload.value
}
function fixture() {
  const original = window.fetch.bind(window)
  const admin = { id: 'manager', email: 'manager@example.test', role: 'admin', status: 'active', profile: { first_name: 'Platform', last_name: 'Admin' }, permissions: ['seller_compliance.manage'], setup_required: false }
  const sellers = Array.from({ length: 23 }, (_, i) => ({ id: `seller-${i}`, name: i === 0 ? 'Alice Rivera' : `Seller ${i}`, email: `seller${i}@example.test`, shop_name: i === 0 ? 'Rivera Home Studio' : i === 1 ? 'North Market' : `Shop ${i}`, status: i === 1 ? 'suspended' : 'active', shop_status: 'active', contact_number: i === 1 ? null : '09171234567', joined_at: '2026-08-01T10:00:00Z' }))
  const product = (id) => ({ id: `product-${id}`, name: `Product for ${id}`, status: 'active', is_restricted: false })
  const cases = Array.from({ length: 2 }, (_, i) => ({ id: `case-${i}`, seller: sellers[i], product: i ? null : product('seller-0'), status: i ? 'confirmed' : 'open', reason: 'Review unsupported listing claims against the platform rule.', revision: 1, policy: null, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z', created_by: { id: 'admin', email: admin.email } }))
  const state = window.complianceFixture = { admin, readError: false, optionsError: false, createError: false, empty: false, sessionLost: false, requests: [], writes: [], holdWrite: false }
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin), path = parsed.pathname, method = options.method ?? 'GET'
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url, options)
    state.requests.push(parsed.pathname + parsed.search)
    if (path.endsWith('/auth/me')) return state.sessionLost ? json({ message: 'Session expired.' }, 401) : json({ admin })
    if (path.endsWith('/auth/logout')) { state.sessionLost = true; return json({}) }
    if (path === '/api/v1/policy-consent/status') return json({ data: { all_required_accepted: true, policies: [] } })
    if (path.includes('/seller-compliance/') && state.sessionLost) return json({ message: 'Session expired.' }, 401)
    if (path.endsWith('/seller-compliance/options')) {
      if (state.optionsError) return json({ message: 'Synthetic options failure.' }, 500)
      const search = parsed.searchParams.get('seller_search') ?? '', page = Number(parsed.searchParams.get('seller_page') ?? 1), seller = parsed.searchParams.get('seller_id')
      if (search === 'slow' || seller === 'seller-1') await new Promise((done) => setTimeout(done, 900))
      const matches = search === 'slow' ? sellers.slice(1, 2) : sellers.filter((s) => `${s.name} ${s.shop_name} ${s.email}`.toLowerCase().includes(search.toLowerCase()))
      return json({ data: { sellers: matches.slice((page - 1) * 20, page * 20), sellers_meta: { current_page: page, last_page: Math.max(1, Math.ceil(matches.length / 20)), total: matches.length }, products: seller ? [product(seller)] : [], policies: [{ id: 'policy-1', title: 'Seller policy', version: 2, type: 'seller' }] } })
    }
    if (path.endsWith('/seller-compliance/cases') && method === 'POST') {
      const body = JSON.parse(options.body)
      state.writes.push(body)
      if (state.holdWrite) await new Promise((done) => { state.releaseWrite = done })
      if (state.createError) return json({ message: 'Review reason needs correction.', errors: { reason: ['Review reason needs correction.'] } }, 422)
      return json({ data: { ...cases[0], id: 'created-case' } }, 201)
    }
    if (path.endsWith('/seller-compliance/cases')) {
      if (state.readError) return json({ message: 'Synthetic list failure.' }, 500)
      const page = Number(parsed.searchParams.get('page') ?? 1), search = parsed.searchParams.get('search'), status = parsed.searchParams.get('status')
      const rows = state.empty ? [] : cases.filter((c) => (!status || c.status === status) && (!search || JSON.stringify(c).toLowerCase().includes(search.toLowerCase())))
      return json({ data: rows, links: {}, meta: { current_page: page, last_page: 2, total: rows.length ? 22 : 0, from: 1, to: rows.length, per_page: 20 } })
    }
    if (path.endsWith('/seller-compliance/cases/created-case')) return json({ data: { ...cases[0], id: 'created-case', source: { type: 'manual_admin_review' }, actions: [], restrictions: [] } })
    return json({ data: [], items: [] })
  }
}
const session = await command('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'chrome', 'goog:chromeOptions': { args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900', `--user-data-dir=${artifacts}/profile-${Date.now()}`] } } } })
const path = `/session/${session.sessionId}`
const js = (script, args = []) => command('POST', `${path}/execute/sync`, { script, args })
const cdp = (cmd, params = {}) => command('POST', `${path}/goog/cdp/execute`, { cmd, params })
const go = (route) => command('POST', `${path}/url`, { url: `${origin}${route}` })
async function until(script, label) {
  const end = Date.now() + 15000
  while (Date.now() < end) { if (await js(script)) return; await new Promise((done) => setTimeout(done, 100)) }
  throw new Error(`Timed out: ${label}`)
}
async function button(label) {
  const selector = await js(`const dialogs = [...document.querySelectorAll('dialog[open]')]; const root = dialogs.at(-1) ?? document; return [...document.querySelectorAll('button')].findIndex(b => root.contains(b) && b.textContent.trim() === arguments[0])`, [label])
  assert.notEqual(selector, -1, `Missing button ${label}`)
  await js(`document.querySelectorAll('[data-browser-target]').forEach(e=>e.removeAttribute('data-browser-target')); const target=document.querySelectorAll('button')[arguments[0]]; target.setAttribute('data-browser-target','active'); target.scrollIntoView({block:'center', behavior:'instant'})`, [selector])
  const element = await command('POST', `${path}/element`, { using: 'css selector', value: 'button[data-browser-target="active"]' })
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {})
}
async function fill(label, value) {
  const id = await js(`return [...document.querySelectorAll('label')].find(l => l.textContent.replace('*','').trim() === arguments[0])?.htmlFor`, [label])
  assert.ok(id, `Missing label ${label}`)
  const element = await command('POST', `${path}/element`, { using: 'css selector', value: `[id="${id}"]` })
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/clear`, {})
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: value })
}
let captures = 0
async function click(selector) {
  const element = await command('POST', `${path}/element`, { using: 'css selector', value: selector })
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {})
}
async function escape() {
  await command('POST', `${path}/actions`, { actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: '\uE00C' }, { type: 'keyUp', value: '\uE00C' }] }] })
}
async function choose(id) {
  await click(`button[aria-label="Select ${id}"]`)
}
async function openPicker() {
  await click('.compliance-seller-trigger')
  await until('return document.querySelectorAll("dialog[open]").length === 2 && document.body.innerText.includes("Select Seller")', 'picker loaded')
}
async function verifyViews(name) {
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 })
    await js('document.documentElement.classList.toggle("dark", arguments[0] === "dark")', [theme])
    await new Promise((done) => setTimeout(done, 100))
    assert.equal(await js('return document.documentElement.scrollWidth <= innerWidth + 2'), true, `${name} ${theme} page overflow ${width}`)
    assert.equal(await js('return [...document.querySelectorAll("dialog[open]")].every(d => d.scrollWidth <= d.clientWidth + 2 && d.getBoundingClientRect().width <= innerWidth)'), true, `${name} ${theme} dialog overflow ${width}`)
    if ([390, 1440].includes(width)) await writeFile(`${artifacts}/${name}-${theme}-${width}.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'))
    captures++
  }
}
try {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixture.toString()})();` })
  await go('/seller-compliance')
  await until('return document.body.innerText.includes("Rivera Home Studio")', 'list')
  await verifyViews('list')
  await cdp('Page.bringToFront')
  await new Promise((done) => setTimeout(done, 500))
  await button('Open case')
  await until('return !!document.querySelector("dialog[open]") && !document.body.innerText.includes("Loading Product")', 'create form')
  await fill('Review reason', 'Preserve this review reason while selecting a Seller.')
  await verifyViews('create')
  await openPicker()
  await verifyViews('picker')
  assert.equal(await js('return document.querySelectorAll("dialog[open]")[1].contains(document.activeElement)'), true)
  for (let index = 0; index < 6; index++) {
    await command('POST', `${path}/actions`, { actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: '\uE004' }, { type: 'keyUp', value: '\uE004' }] }] })
    assert.equal(await js('return document.querySelectorAll("dialog[open]")[1].contains(document.activeElement)'), true, 'Tab stays in the picker')
  }
  for (const text of ['Rivera Home Studio', 'Alice Rivera', '09171234567', 'Shop status', 'Joined', 'Not provided']) assert.equal(await js('return document.querySelectorAll("dialog[open]")[1].innerText.includes(arguments[0])', [text]), true)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 420, deviceScaleFactor: 1, mobile: true })
  assert.equal(await js('const d = document.querySelectorAll("dialog[open]")[1]; return d.getBoundingClientRect().height <= innerHeight && d.scrollHeight > d.clientHeight'), true)
  await escape()
  await until('return document.querySelectorAll("dialog[open]").length === 1', 'picker Escape')
  assert.equal(await js('return document.activeElement.classList.contains("compliance-seller-trigger")'), true)
  assert.equal(await js('return document.querySelector("textarea").value'), 'Preserve this review reason while selecting a Seller.')
  await openPicker()
  await button('Next')
  await until('return document.querySelectorAll("dialog[open]")[1].innerText.includes("Shop 22")', 'seller page 2')
  await button('Previous')
  await until(`return !!document.querySelector('button[aria-label="Select Rivera Home Studio"]')`, 'seller page 1')
  await fill('Search Sellers', 'missing'); await button('Search')
  await until('return document.body.innerText.includes("No Sellers found")', 'picker empty')
  await fill('Search Sellers', 'slow'); await button('Search')
  await fill('Search Sellers', 'Alice'); await button('Search')
  await until('return document.body.innerText.includes("1 Sellers")', 'search results')
  await new Promise((done) => setTimeout(done, 1000))
  assert.equal(await js('return document.querySelectorAll("dialog[open]")[1].innerText.includes("North Market")'), false, 'late search ignored')
  await choose('Rivera Home Studio')
  await until('return !!document.querySelector("option[value=product-seller-0]")', 'selected seller products')
  await js('document.querySelector("#compliance-product").value="product-seller-0"; document.querySelector("#compliance-product").dispatchEvent(new Event("change", { bubbles: true }))')
  await openPicker(); await choose('North Market')
  assert.equal(await js('return document.querySelector("#compliance-product").value'), '')
  await openPicker(); await choose('Rivera Home Studio')
  await until('return !!document.querySelector("option[value=product-seller-0]")', 'products restored')
  await new Promise((done) => setTimeout(done, 1000))
  assert.equal(await js('return !!document.querySelector("option[value=product-seller-1]")'), false, 'late products ignored')
  await js('document.querySelector("#compliance-product").value="product-seller-0"; document.querySelector("#compliance-product").dispatchEvent(new Event("change", { bubbles: true }))')
  await openPicker(); await choose('Rivera Home Studio')
  assert.equal(await js('return document.querySelector("#compliance-product").value'), 'product-seller-0', 'same Seller preserves Product')
  await openPicker(); await escape()
  assert.equal(await js('return document.querySelector("textarea").value'), 'Preserve this review reason while selecting a Seller.')
  await js('complianceFixture.createError=true; document.querySelector(".compliance-case-form").requestSubmit()')
  await until('return document.body.innerText.includes("Review reason needs correction.")', 'create validation')
  await js('complianceFixture.createError=false; complianceFixture.holdWrite=true; document.querySelector(".compliance-case-form").requestSubmit(); document.querySelector(".compliance-case-form").requestSubmit()')
  await until('return document.body.innerText.includes("Opening…")', 'submitting')
  await escape()
  assert.equal(await js('return document.querySelectorAll("dialog[open]").length'), 1, 'busy form remains open')
  assert.equal(await js('return complianceFixture.writes.length'), 2, 'one validation and one guarded submission')
  await js('complianceFixture.releaseWrite()')
  await until('return location.pathname.endsWith("created-case")', 'created case navigation')
  assert.equal(await js('return complianceFixture.writes[1].seller_id'), 'seller-0')
  assert.equal(await js('return complianceFixture.writes[1].product_id'), 'product-seller-0')
  await go('/seller-compliance'); await until('return document.body.innerText.includes("Rivera Home Studio")', 'list reload')
  await fill('Search cases', 'Rivera'); await button('Search')
  await until('return location.search.includes("search=Rivera")', 'URL search')
  await button('Next'); await until('return location.search.includes("page=2")', 'case page')
  await button('Clear filters'); await until('return location.search === ""', 'clear filters')
  await js('complianceFixture.readError=true'); await button('Search')
  // Same URL is intentionally reloaded through a different filter.
  await js('const e=document.querySelector("#compliance-status"); e.value="open"; e.dispatchEvent(new Event("change",{bubbles:true}))')
  await until('return document.body.innerText.includes("Synthetic list failure.")', 'list error')
  await js('complianceFixture.readError=false; complianceFixture.empty=true'); await button('Try again')
  await until('return document.body.innerText.includes("No compliance cases found")', 'list empty')
  await button('Open case'); await until('return !!document.querySelector("dialog[open]")', 'new form')
  await js('complianceFixture.optionsError=true'); await click('.compliance-seller-trigger')
  await until('return document.body.innerText.includes("Synthetic options failure.")', 'picker failure')
  await js('complianceFixture.optionsError=false'); await button('Try again')
  await until(`return !!document.querySelector('button[aria-label="Select Rivera Home Studio"]')`, 'picker retry')
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await js('return getComputedStyle(document.querySelector(".compliance-seller-trigger")).transitionDuration'), '0s')
  await js('complianceFixture.sessionLost=true'); await fill('Search Sellers', 'expired'); await button('Search')
  await until('return location.pathname === "/login"', 'session loss')
  assert.equal(await js('return document.querySelectorAll("dialog[open]").length'), 0)
  console.log(`Seller compliance Chromium passed: ${captures} viewport/theme checks; selection, profiles, search/pagination, nested focus/Escape, short viewport, drafts, stale reads, Product scope, validation, guarded writes, creation, list filters/recovery, picker recovery, reduced motion, and session loss.`)
} catch (error) {
  console.error(await js('return { text: document.body.innerText.slice(-2000), dialogs: document.querySelectorAll("dialog").length, requests: window.complianceFixture?.requests.slice(-10) }'))
  await writeFile(`${artifacts}/failure.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'))
  throw error
} finally { await command('DELETE', path) }
