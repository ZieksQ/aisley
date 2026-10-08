// Run from the repository root with an isolated Logistics preview and Chromium CDP.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { installPodFixtures } from './pod-browser.fixtures.mjs'

const origin = process.env.LOGISTICS_UI_ORIGIN ?? 'http://127.0.0.1:15187'
const browser = process.env.LOGISTICS_UI_CDP ?? 'http://127.0.0.1:19348'
const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
const pending = new Map()
const errors = []
let serial = 0
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data)
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text)
  if (data.method === 'Page.javascriptDialogOpening') void cdp('Page.handleJavaScriptDialog', { accept: true })
  if (!data.id) return
  const call = pending.get(data.id)
  if (!call) return
  pending.delete(data.id)
  clearTimeout(call.timer)
  if (data.error) call.reject(data.error)
  else call.resolve(data.result)
})
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function js(expression) {
  const data = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (data.exceptionDetails) throw new Error(JSON.stringify(data.exceptionDetails))
  return data.result.value
}
async function until(expression) {
  for (let count = 0; count < 150; count++) {
    if (await js(`Boolean(document.body && (${expression}))`)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${expression}\n${await js('JSON.stringify({text:document.body?.innerText,url:location.href,ready:document.readyState})')}\n${errors.join('\n')}`)
}
const button = (label) => `[...document.querySelectorAll('button')].find(b=>b.textContent.trim() === ${JSON.stringify(label)})`
async function click(label) {
  await until(`${button(label)} && !${button(label)}.disabled`)
  await js(`${button(label)}.click()`)
}
async function key(value, code = value, keyCode = 0) {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code, windowsVirtualKeyCode: keyCode })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code, windowsVirtualKeyCode: keyCode })
}
async function fill(selector, value) {
  await js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); })()`)
}
async function navigate(path, mode = 'normal') {
  await js(`sessionStorage.setItem('ui-mode', ${JSON.stringify(mode)})`)
  const previous = await js('window.uiFixture?.navigation')
  await cdp('Page.navigate', { url: origin + path })
  await until(`window.uiFixture && window.uiFixture.navigation !== ${JSON.stringify(previous)} && document.querySelector('header h1, #email')`)
  const canonical = mode === 'consent' ? '/settings/terms' : ({ '/settings': '/settings/account', '/account': '/settings/account', '/policy-consent': '/settings/terms', '/finance/billing': '/settings/billing' }[path] ?? path)
  const ready = {
    '/settings/account': 'document.querySelector("#first_name, .animate-pulse, [role=alert]")',
    '/settings/appearance': 'document.querySelector("#logistics-theme")',
    '/settings/billing': '[...document.querySelectorAll("h2")].some(h=>h.textContent === "Billing")',
    '/settings/terms': 'document.querySelector("section.max-w-5xl, .animate-pulse, [role=alert]")',
    '/support-tickets': mode === 'denied' ? 'location.pathname === "/login"' : 'document.querySelector(".logistics-support")',
    '/finance/payment-settings': '[...document.querySelectorAll("h2")].some(h=>h.textContent === "Payment settings")',
    '/sort-plan': `document.querySelector('[aria-label="Refresh sort plan"]')`,
  }[canonical]
  if (ready) await until(ready)
  await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
}

function installUiFixtures() {
  const original = window.fetch.bind(window)
  const at = '2026-10-08T01:00:00Z'
  const ticket = (id, subject, status) => ({ id, reference: `SUP-${id}`, subject, category: 'delivery', status, revision: 2, requester_role: 'logistics', requester_name: 'Logistics Reviewer', assignee_name: 'Support agent', assignee_id: 'admin-1', unread_count: 1, last_activity_at: at, created_at: at, resolved_at: null })
  const tickets = [ticket('1', 'Parcel delivery question', 'waiting_for_requester'), ticket('2', 'Account access question', 'resolved')]
  const policy = (type) => ({ type, label: type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy', required: false, accepted: true, accepted_at: at, accepted_version: null, current_version: { id: type, version: 1, title: type, change_summary: null, requires_reconsent: false, published_at: at } })
  const settings = { cod_deadline_hours: 72, seller_delay_hours: 336, logistics_delay_hours: 24, collection_time: '09:00', seller_payout_time: '09:00', logistics_payout_time: '09:00', collection_enabled: true, seller_payout_enabled: true, logistics_payout_enabled: true }
  window.uiFixture = { mode: sessionStorage.getItem('ui-mode') ?? 'normal', navigation: crypto.randomUUID(), tickets, writes: [], failNext: false, confirms: [], detailDelay: 0 }
  window.confirm = (text) => { window.uiFixture.confirms.push(text); return window.uiFixture.acceptConfirm !== false }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin)
    const path = parsed.pathname
    const fixture = window.uiFixture
    if (path.endsWith('/policy-consent/status')) return json({ data: { all_required_accepted: fixture.mode !== 'consent', policies: [policy('terms_of_service'), policy('privacy_policy')] } })
    if (path.includes('/platform/policies/')) {
      while (fixture.mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 50))
      if (fixture.mode === 'error') return json({ message: 'Policy temporarily unavailable.' }, 503)
      return json({ data: { version: { id: 'policy-1', version: 1, content: 'Platform policy. Read this text before accepting.', published_at: at } } })
    }
    const relevant = path.endsWith('/logistics/account') || path.includes('/support-tickets') || path.endsWith('/finance/automation') || path.endsWith('/finance/billing')
    if (!relevant) return original(url, options)
    if (options.method === 'POST' || options.method === 'PATCH') {
      if (path.endsWith('/read')) return json({ data: tickets.find((ticket) => ticket.id === path.split('/').at(-2)) })
      fixture.writes.push({ path, body: options.body, key: new Headers(options.headers).get('Idempotency-Key') })
      if (fixture.failNext) { fixture.failNext = false; return json({ message: 'Outcome unconfirmed. Retry the same request.' }, 503) }
      if (path.endsWith('/support-tickets')) {
        const body = JSON.parse(options.body)
        const created = ticket('3', body.subject, 'open')
        fixture.tickets.unshift(created)
        return json({ data: created, event: {} }, 201)
      }
      return json({ data: tickets[0], event: {} })
    }
    while (fixture.mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 50))
    if (fixture.mode === 'error') return json({ message: 'Read temporarily unavailable. Try again.' }, 503)
    if (fixture.mode === 'denied') return json({ message: 'Session expired.' }, 401)
    if (path.endsWith('/logistics/account')) return json({ account: { id: 'logistics', email: 'logistics@example.test', role: 'logistics', status: 'active', profile: { first_name: 'Logistics', last_name: 'Reviewer', middle_name: '', contact_number: '09123456789', sex: 'prefer_not_to_say', birth_date: '1990-01-01', age: 36, profile_photo_url: null }, organization: { id: 'org-1', business_name: 'Final Mile' }, hub: { id: 'hub-1', name: 'Main Hub', address: null, location: null }, security: { email_editable: false, password_change_requires_current_password: true, organization_editable: true, hub_name_editable: true, hub_address_editable: false, hub_location_editable: false } } })
    if (path.endsWith('/finance/billing')) return json({ data: { label: 'Simulated payment account', masked_identifier: '••••1234', currency: 'PHP', active: true, simulation_enabled: true } })
    if (path.endsWith('/finance/automation')) return json({ data: { platform: settings, collection: settings, timezone: 'Asia/Manila', next_collection_at: at, gateway_enabled: true, can_manage: true } })
    if (path.endsWith('/support-tickets')) return json({ items: fixture.mode === 'empty' ? [] : parsed.searchParams.has('cursor') ? [ticket('4', 'Older ticket', 'open')] : fixture.tickets, next_cursor: parsed.searchParams.has('cursor') ? null : 'page-two' })
    const id = path.split('/').at(-1)
    if (fixture.mode === 'detail-error') return json({ message: 'Conversation unavailable. Try again.' }, 503)
    if (id === '1' && fixture.detailDelay) await new Promise((resolve) => setTimeout(resolve, fixture.detailDelay))
    const data = fixture.tickets.find((ticket) => ticket.id === id) ?? ticket(id, 'Older ticket', 'open')
    return json({ data: { ...data }, events: [{ id: `event-${id}-${parsed.searchParams.has('cursor') ? 1 : 2}`, sequence: parsed.searchParams.has('cursor') ? 1 : 2, type: 'reply', actor_role: 'admin', is_mine: false, body: parsed.searchParams.has('cursor') ? 'Older history entry' : 'Please describe the delivery issue. <script>untrusted text</script>', created_at: at }], next_cursor: parsed.searchParams.has('cursor') ? null : 'older' })
  }
}

await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Network.setBypassServiceWorker', { bypass: true })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installPodFixtures.toString()})();(${installUiFixtures.toString()})();` })
await cdp('Page.navigate', { url: origin + '/settings/appearance' })
await until('window.uiFixture && document.querySelector("header h1")')
const shots = 'src/logistics/node_modules/.cache/ui-shots'
await mkdir(shots, { recursive: true })

try {
  for (const width of [390, 768, 1440]) for (const theme of ['light', 'dark']) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await js(`localStorage.setItem('logistics-theme', ${JSON.stringify(theme)})`)
    for (const [path, ready] of [
      ['/settings/account', 'document.querySelector("#first_name")'],
      ['/settings/terms', 'document.body.innerText.includes("Platform policy.")'],
      ['/settings/billing', 'document.body.innerText.includes("••••1234")'],
      ['/settings/appearance', 'document.querySelector("#logistics-theme")'],
      ['/support-tickets', 'document.querySelector(".support-ticket-list-item")'],
    ]) {
      await navigate(path)
      await until(ready)
      if (path === '/support-tickets') {
        await js('document.querySelector(".support-ticket-list-item").click()')
        await until('document.querySelector("#ticket-reply")')
        assert.equal(await js('parseFloat(getComputedStyle(document.querySelector("#ticket-reply")).borderTopWidth) >= 1'), true, 'Production reply input has a border')
        assert.equal(await js('document.querySelector("#ticket-reply").getBoundingClientRect().width > 200'), true, 'Production reply fills the content width')
      }
      assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, `${path} ${width}/${theme} overflow`)
      assert.equal(await js('document.documentElement.classList.contains("dark")'), theme === 'dark', 'Theme applied')
      await key('Tab', 'Tab', 9)
      assert.equal(await js('document.activeElement !== document.body'), true, 'Keyboard focus')
      if (path === '/support-tickets' && width < 1200) {
        assert.equal(await js('getComputedStyle(document.querySelector(".support-ticket-list")).display'), 'none')
        await click('All tickets')
        await until('getComputedStyle(document.querySelector(".support-ticket-list")).display !== "none"')
        await click('New ticket')
        await until('document.activeElement.id === "ticket-subject"')
        assert.equal(await js('parseFloat(getComputedStyle(document.querySelector("#ticket-subject")).borderTopWidth) >= 1'), true, 'Production creation input has a border')
        assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Mobile creation form')
      }
      if (width === 390 || (width === 1440 && theme === 'dark')) {
        const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
        await writeFile(`${shots}/${path.replaceAll('/', '-')}-${width}-${theme}.png`, Buffer.from(screenshot.data, 'base64'))
      }
      console.log('Responsive / keyboard', path, width, theme)
    }
  }

  await navigate('/settings/appearance')
  await fill('#logistics-theme', 'system')
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
  await until('document.documentElement.classList.contains("dark")')
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
  await until('!document.documentElement.classList.contains("dark")')
  await fill('#logistics-theme', 'dark')
  await until('document.documentElement.classList.contains("dark")')
  await navigate('/settings/appearance')
  assert.equal(await js('document.querySelector("#logistics-theme").value'), 'dark')
  await js('localStorage.removeItem("logistics-theme")')
  await navigate('/settings/appearance')
  assert.equal(await js('document.querySelector("#logistics-theme").value'), 'system', 'Default System')
  await js('localStorage.setItem("logistics-theme","dark"); window.dispatchEvent(new StorageEvent("storage", { key:"logistics-theme",newValue:"dark" }))')
  await until('document.querySelector("#logistics-theme").value === "dark"')

  for (const [legacy, expected] of [['/settings', '/settings/account'], ['/account', '/settings/account'], ['/policy-consent', '/settings/terms'], ['/finance/billing', '/settings/billing']]) {
    await navigate(legacy)
    await until(`location.pathname === ${JSON.stringify(expected)}`)
  }
  await navigate('/settings/appearance', 'consent')
  await until('location.pathname === "/settings/terms" && document.body.innerText.includes("Platform policy.")')
  await navigate('/settings/appearance')
  await js('document.querySelector("[aria-controls=logistics-account-menu]").click()')
  await until('document.activeElement.textContent.trim() === "Settings"')
  await key('ArrowDown', 'ArrowDown', 40)
  assert.equal(await js('document.activeElement.textContent.trim()'), 'Notifications')
  await key('Escape', 'Escape', 27)
  await until('!document.querySelector("#logistics-account-menu")')
  assert.equal(await js('document.activeElement.getAttribute("aria-controls")'), 'logistics-account-menu')

  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false })
  await js(`document.querySelector('[aria-label="Open navigation"]').click()`)
  await until('document.querySelector("#logistics-navigation").getAttribute("aria-modal") === "true"')
  await key('Tab', 'Tab', 9)
  assert.equal(await js('document.querySelector("#logistics-navigation").contains(document.activeElement)'), true, 'Mobile sidebar focus')
  await js(`document.querySelector('nav[aria-label=Settings] a[href="/settings/billing"]').click()`)
  await until(`location.pathname === "/settings/billing" && document.querySelector('[aria-label="Open navigation"]').getAttribute("aria-expanded") === "false"`)
  await until('document.body.innerText.includes("••••1234")')
  await js(`document.querySelector('[aria-label="Open navigation"]').click()`)
  await until('document.activeElement.getAttribute("aria-label") === "Close navigation"')
  await key('Escape', 'Escape', 27)
  await until('document.activeElement.getAttribute("aria-label") === "Open navigation"')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  await navigate('/support-tickets')
  await js('document.querySelector(".support-ticket-list-item").click()')
  await until('document.querySelector("#ticket-reply")')
  await fill('#ticket-reply', 'My unsent reply')
  await js('window.uiFixture.acceptConfirm = false; document.querySelectorAll(".support-ticket-list-item")[1].click()')
  assert.equal(await js('document.querySelector("#ticket-reply").value'), 'My unsent reply', 'Cancelled discard preserves draft')
  await js('window.uiFixture.acceptConfirm = true; window.uiFixture.failNext = true')
  await click('Send reply')
  await until('document.body.innerText.includes("Retry reply")')
  assert.equal(await js('document.querySelector("#ticket-reply").disabled'), true)
  await js(`window.uiFixture.tickets[0].revision = 8; document.querySelector('[aria-label="Refresh support tickets"]').click()`)
  await click('Retry reply')
  await until('window.uiFixture.writes.length === 2 && document.querySelector("#ticket-reply").value === ""')
  assert.deepEqual(await js('window.uiFixture.writes[0]'), await js('window.uiFixture.writes[1]'), 'Retry preserves UUID/body/revision')
  await click('Older history')
  await until('document.body.innerText.includes("Older history entry")')
  await js(`document.querySelector('[aria-label="Refresh support tickets"]').click()`)
  await until('document.body.innerText.includes("Older history entry")')
  await click('Load more tickets')
  await until('document.body.innerText.includes("Older ticket")')
  await js(`document.querySelector('[aria-label="Refresh support tickets"]').click()`)
  await until('document.body.innerText.includes("Older ticket")')

  await click('New ticket')
  await fill('#ticket-subject', 'New delivery request')
  await fill('#ticket-description', 'Help with this delivery.')
  await js('window.uiFixture.failNext = true')
  await click('Submit ticket')
  await until('document.body.innerText.includes("Retry submission")')
  await click('Retry submission')
  await until('document.querySelector(".support-ticket-detail h2")?.textContent === "New delivery request"')
  assert.deepEqual(await js('window.uiFixture.writes.at(-2)'), await js('window.uiFixture.writes.at(-1)'), 'Create exact retry')
  assert.equal(await js('document.querySelector(".support-ticket-message").textContent.includes("<script>")'), true, 'Plain text rendering')

  for (const mode of ['loading', 'empty', 'error', 'detail-error']) {
    await navigate('/support-tickets', mode)
    if (mode === 'loading') await until('document.body.innerText.includes("Loading tickets")')
    if (mode === 'empty') await until('document.body.innerText.includes("No tickets yet")')
    if (mode === 'error') {
      await until('document.querySelector("[role=alert]")')
      assert.equal(await js('document.body.innerText.includes("No tickets yet")'), false)
      await js('window.uiFixture.mode = "normal"')
      await click('Retry')
      await until('document.querySelector(".support-ticket-list-item")')
    }
    if (mode === 'detail-error') {
      await until('document.querySelector(".support-ticket-list-item")')
      await js('document.querySelector(".support-ticket-list-item").click()')
      await until('document.body.innerText.includes("Conversation unavailable")')
      assert.equal(await js('document.body.innerText.includes("Loading conversation")'), false)
    }
  }
  await navigate('/support-tickets')
  await until('document.querySelector(".support-ticket-list-item")')
  await js('window.uiFixture.detailDelay = 1200; document.querySelector(".support-ticket-list-item").click()')
  await js('document.querySelectorAll(".support-ticket-list-item")[1].click()')
  await until('document.querySelector(".support-ticket-detail h2")?.textContent === "Account access question"')
  await new Promise((resolve) => setTimeout(resolve, 1400))
  assert.equal(await js('document.querySelector(".support-ticket-detail h2").textContent'), 'Account access question', 'Obsolete detail ignored')
  await navigate('/support-tickets', 'denied')
  await until('location.pathname === "/login"')
  assert.equal(await js('document.querySelector("#ticket-reply")'), null, 'Private draft unmounted')

  for (const path of ['/settings/account', '/settings/billing', '/settings/terms']) {
    await navigate(path, 'loading')
    await until('document.querySelector(".animate-pulse") || document.body.innerText.includes("Loading payment method")')
    await navigate(path, 'error')
    await until('document.querySelector("[role=alert]")')
  }

  await navigate('/settings/appearance')
  await js('document.querySelector("[aria-controls=logistics-account-menu]").click()')
  await js(`document.querySelector('#logistics-account-menu a[href="/notifications"]').click()`)
  await until('location.pathname === "/notifications" && document.body.innerText.includes("No notifications yet.")')
  await click('Communication')
  await js(`document.querySelector('a[href="/support-tickets"]').click()`)
  await until('document.querySelector(".support-ticket-list-item")')
  await js('document.querySelector(".support-ticket-list-item").click()')
  await until('document.querySelector("#ticket-reply")')
  await fill('#ticket-reply', 'Preserve on browser Back')
  await js('window.uiFixture.acceptConfirm = false; history.back()')
  await until('window.uiFixture.confirms.length > 0 && location.pathname === "/support-tickets"')
  assert.equal(await js('document.querySelector("#ticket-reply").value'), 'Preserve on browser Back')
  await js('window.uiFixture.acceptConfirm = true; history.back()')
  await until('location.pathname === "/notifications"')

  await navigate('/finance/payment-settings')
  await until('document.querySelector("#collection-time")?._flatpickr')
  assert.equal(await js('document.querySelector("#collection-time").readOnly'), false, 'Time field permits keyboard entry and required validation')
  await js('document.querySelector("#collection-time")._flatpickr.setDate("13:17", true)')
  await click('Save settings')
  await until('window.uiFixture.writes.length > 0')
  assert.equal(await js('JSON.parse(window.uiFixture.writes.at(-1).body).collection_time'), '13:17')
  await until('document.querySelector("#collection-time")?._flatpickr')
  await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  await js('document.querySelector("#collection-time")._flatpickr.open()')
  await until('document.querySelector(".flatpickr-calendar.open")')
  assert.equal(await js('document.querySelector(".flatpickr-calendar.open").classList.contains("noCalendar")'), true)
  for (const width of [390, 1440]) for (const dark of [false, true]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await js(`(() => { document.documentElement.classList.toggle('dark', ${dark}); const picker=document.querySelector('#collection-time')._flatpickr; picker.close(); picker.input.scrollIntoView({block:'center'}); picker.open() })()`)
    assert.equal(await js('(() => { const r=document.querySelector(".flatpickr-calendar.open").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight })()'), true, 'Time picker stays within viewport')
  }

  // Reuse the established sort-plan fixture, without rerunning its unrelated workflows.
  const sortingSource = await readFile('src/logistics/tests/sorting-browser.smoke.mjs', 'utf8')
  const sortingFunction = sortingSource.slice(sortingSource.indexOf('function fixtures()'), sortingSource.indexOf('\nconst shots'))
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${sortingFunction})();` })
  await navigate('/sort-plan')
  await click('Edit active plan')
  await click('Published versions (2)')
  await until('document.querySelector("dialog[aria-labelledby=published-versions-title] input.flatpickr-input")')
  assert.equal(await js('document.querySelector("dialog[aria-labelledby=published-versions-title] input.flatpickr-input").checkValidity()'), false, 'Empty activation date remains required')
  await js('document.querySelector("dialog[aria-labelledby=published-versions-title] input.flatpickr-input")._flatpickr.setDate("2026-12-01T14:27",true)')
  await click('Schedule activation')
  await until('window.sortFixture.writes.length === 1')
  assert.equal(await js('JSON.parse(window.sortFixture.writes[0].body).scheduled_for'), '2026-12-01T14:27:00+08:00')
  await navigate('/sort-plan')
  await js(`window.sortFixture.plan.draft_dirty = true; document.querySelector('[aria-label="Refresh sort plan"]').click()`)
  await click('Edit active plan')
  await until('document.querySelector("dialog[aria-labelledby=plan-workspace-title] input.flatpickr-input")')
  await js('document.querySelector("dialog[aria-labelledby=plan-workspace-title] input.flatpickr-input")._flatpickr.setDate("2026-12-02T15:28",true)')
  await click('Publish and schedule')
  await until('window.sortFixture.writes.length === 1')
  assert.equal(await js('JSON.parse(window.sortFixture.writes[0].body).scheduled_for'), '2026-12-02T15:28:00+08:00')
  assert.deepEqual(errors, [], 'No runtime exceptions')
  console.log('PASS: 30 responsive/theme states, settings navigation, theme persistence, draft safety, retries, pagination, errors and Flatpickr contracts')
} finally {
  socket.close()
  await fetch(`${browser}/json/close/${target.id}`)
}
