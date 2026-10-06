// Run from the repo root against the Logistics production preview and isolated Chromium CDP.
// These controlled API fixtures verify UI behavior; Laravel and PostgreSQL checks run separately.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { installPodFixtures } from './pod-browser.fixtures.mjs'
const origin = process.env.SORTING_ORIGIN ?? 'http://127.0.0.1:15176'
const target = await (await fetch('http://127.0.0.1:19226/json/new?about:blank', { method: 'PUT' })).json()
const oldTargets = await (await fetch('http://127.0.0.1:19226/json')).json()
await Promise.all(oldTargets.filter((page) => page.type === 'page' && page.id !== target.id).map((page) => fetch(`http://127.0.0.1:19226/json/close/${page.id}`)))
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let serial = 0
const pending = new Map()
const errors = []
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
  if (!message.id) return
  const task = pending.get(message.id)
  if (!task) return
  pending.delete(message.id); clearTimeout(task.timer)
  if (message.error) task.reject(message.error)
  else task.resolve(message.result)
})
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15000)
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
  })
}
async function js(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function until(expression) {
  for (let i = 0; i < 100; i++) {
    if (await js(`Boolean(document.body && (${expression}))`)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${expression}`)
}
function fixtures() {
  const original = window.fetch.bind(window)
  const at = '2026-10-06T01:00:00Z'
  const lane = (id, code, type = 'standard') => ({ id, code, name: `Physical ${code}`, type, is_active: true, position: 1, revision: 1, operational_state: 'open', blocking_reason: null, label_url: '/label', label_payload: '' })
  const lanes = [lane('lane-1', 'LANE-1'), lane('lane-5', 'LANE-5'), lane('ex', 'EX', 'exception')]
  const mappings = [{ id: 'mapping-1', sorting_lane_id: 'lane-1', postal_code: '6000', destination_type: 'postal_code', destination_hub_id: null, position: 1 }]
  const version = { id: 'version-1', number: 1, name: 'Daily plan', published_by: 'operator-1', published_at: at, mappings, differences: { added: mappings } }
  const versionTwo = { ...version, id: 'version-2', number: 2, mappings: mappings.map(m => ({ ...m, sorting_lane_id: 'lane-5' })), differences: { changed: [{ before: mappings[0], after: { ...mappings[0], sorting_lane_id: 'lane-5' } }] } }
  const plan = { id: 'plan-1', name: 'Daily plan', is_active: true, revision: 4, active_version_id: version.id, draft_dirty: false, archived_at: null, versions: [versionTwo, version], activations: [], lanes: mappings.map((m) => ({ ...m, lane: lanes[0] })) }
  const assignment = { legacy_reconstructed: false, version_id: version.id, version_number: 1, plan_name: plan.name, lane: { id: 'lane-1', code: 'OLD-1', name: 'Original label', revision: 1 }, destination_type: 'postal_code', postal_code: '6000' }
  const item = (n, status) => ({ id: `item-${n}`, shipment_id: `shipment-${n}`, reference: `WAY-${n}`, tracking_id: `WAY-${n}`, order_reference: `ORDER-${n}`, status, expected_revision: 3, shipment_revision: 3, can_move: false, lane_id: status === 'sorted' ? 'lane-1' : null, sorting_assignment: status === 'sorted' ? assignment : null, exception_code: null, exception_reason: null, destination: { city_municipality: 'Cebu', province: 'Cebu', postal_code: '6000' }, route: null, automatic_routing: { lane: lanes[0], reason: 'matched', postal_code: '6000', sort_plan_id: plan.id, sort_plan_name: plan.name } })
  const context = { organization_id: 'org-1', hub_id: 'hub-1', hub_name: 'Main hub' }
  const session = { id: 'session-1', reference: 'SESSION-1', status: 'open', opened_at: at, expected_count: 2, revision: 1, counts: { pending: 1, sorted: 1, exception: 0 }, items: [item(1, 'pending'), item(2, 'sorted')] }
  const exception = { id: 'exception-1', shipment_id: 'damaged-1', reference: 'DAMAGED-1', revision: 1, exception_code: 'damaged', cause: 'manual_lane', reason: 'Damaged wrapping', attempts: 2, last_attempt_at: at, next_action: 'Complete documented inspection and release', can_recover: false, released_at: null }
  const trip = { id: 'trip-1', status: 'scheduled', direction: 'outbound', from_hub: { id: 'hub-1', name: 'Main hub' }, to_hub: { id: 'hub-2', name: 'Next hub' }, truck: { plate_number: 'AAA-123', id: 'truck-1' }, driver: { id: 'driver-1', name: 'Test driver' }, scheduled_for: at, capacity_snapshot: 10, parcel_count: 1, remaining_capacity: 9, references: ['WAY-2'], revision: 2, can_depart: false, lane_blocked: true, parcels: [{ reference: 'WAY-2', sorting_assignment: assignment, lane: { operational_state: 'held', blocking_reason: 'Safety inspection' } }] }
  window.sortFixture = { mode: sessionStorage.getItem('sort-mode') ?? 'normal', copies: [], writes: [], lanes, plan, session, exception, navigation: crypto.randomUUID(), failNext: false }
  window.confirm = () => true
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin); const path = parsed.pathname
    const f = window.sortFixture
    if (path.endsWith('/logistics/linehaul')) return json({ data: { service_areas: [], connections: [] } })
    if (!path.includes('/sorting') && !path.includes('/dispatch/') && !path.includes('/dashboard/queue') && !path.includes('/linehaul/trips')) return original(url, options)
    if (options.method && options.method !== 'GET') {
      const write = { path, body: options.body, key: new Headers(options.headers).get('Idempotency-Key') }; f.writes.push(write)
      if (f.failNext) { f.failNext = false; return json({ message: 'Outcome unavailable. Verify the same request.' }, 503) }
      if (path.endsWith('/actions/duplicate')) {
        const name = `Daily plan (${f.copies.length + 1})`
        const copy = { ...plan, id: `copy-${f.copies.length + 1}`, name, versions: [], is_active: false, active_version_id: null, draft_dirty: true }
        f.copies.push(copy)
        return json({ data: { plan_id: copy.id, plan_name: name, revision: 1 } })
      }
      if (path.endsWith('/batches')) {
        const capture = JSON.parse(options.body).captures[0]
        return json({ data: [{ client_id: capture.client_id, reference: capture.reference, status: 'sorted', lane: lanes[1], sorting_assignment: { ...assignment, lane: lanes[1] } }], summary: { sorted: 1, exception: 0, failed: 0 } })
      }
      if (path.endsWith('/release')) { exception.can_recover = true; exception.released_at = at; return json({ data: exception }) }
      if (path.includes('/lanes/')) { const body = JSON.parse(options.body); Object.assign(lanes[0], body, { revision: 2 }); return json({ data: lanes[0] }) }
      return json({ data: { plan_id: plan.id, revision: 5 } })
    }
    if (f.mode === 'loading') await new Promise((resolve) => setTimeout(resolve, 1500))
    if (f.mode === 'error') return json({ message: 'Sorting service temporarily unavailable.' }, 503)
    if (path.endsWith('/sorting/plans')) return json({ data: { context, active_plan_id: f.mode === 'empty' ? null : plan.id, plans: f.mode === 'empty' ? [] : [plan, ...f.copies], lanes: f.mode === 'empty' ? [] : lanes, next_hubs: [] } })
    if (path.endsWith('/sorting/exceptions')) return json({ data: f.mode === 'empty' ? [] : [exception], total: f.mode === 'empty' ? 0 : 1, current_page: 1, last_page: 1 })
    if (path.endsWith('/sorting')) return json({ data: { context, session: f.mode === 'empty' || f.mode === 'recovery' ? null : session, lanes, automatic_sorting: { enabled: true, active_plan: plan, exception_lane: lanes[2] }, waiting_received: 0, session_limit: 100 } })
    if (path.endsWith('/dispatch/couriers')) return json({ data: [] })
    if (path.endsWith('/dispatch/schedules')) return json({ data: [] })
    if (path.endsWith('/dashboard/queue')) return json({ data: parsed.searchParams.get('status') === 'sorted_at_hub' ? [{ shipment_id: 'shipment-2', revision: 3, status: 'sorted_at_hub', parcel: { order_reference: 'ORDER-2', tracking_id: 'WAY-2' }, tasks: [], sorting_lane: { ...assignment.lane, operational_state: 'held', blocking_reason: 'Safety inspection' }, sorting_assignment: assignment }] : [], summary: { by_lane: [{ id: 'lane-1', code: 'LANE-1', name: 'Physical lane', count: 1 }], by_status: {} }, source_lanes: [{ id: 'lane-1', code: 'LANE-1', name: 'Physical lane', count: 1 }], meta: { current_page: 1, last_page: 1, total: 1, per_page: 25 }, freshness: {} })
    if (path.endsWith('/linehaul/trips')) return json({ data: { ready_groups: [], outbound: [trip], inbound: [], trucks: [], drivers: [], enabled: true } })
    return original(url, options)
  }
}
const shots = 'src/api/storage/framework/testing/sorting-browser-shots'
await mkdir(shots, { recursive: true })
await cdp('Page.enable'); await cdp('Runtime.enable')
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installPodFixtures.toString()})(); (${fixtures.toString()})();` })
const findButton = (text) => `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)} && b.getClientRects().length)`
async function click(text) { await until(`${findButton(text)} && !${findButton(text)}.disabled`); await js(`${findButton(text)}.click()`) }
async function clickLabel(label) {
  await js(`document.querySelector(${JSON.stringify(`button[aria-label="${label}"]`)}).click()`)
}
async function navigate(path) {
  const previous = await js('window.sortFixture?.navigation')
  await cdp('Page.navigate', { url: origin + path })
  await until(`window.sortFixture && window.sortFixture.navigation !== ${JSON.stringify(previous)} && document.querySelector('main h2')`)
}
async function fill(selector, value) {
  await js(`(() => { const input=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype,'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); })()`)
}
try {
  for (const width of [390, 768, 1440]) for (const dark of [false, true]) for (const path of ['/sort-plan', '/sorting', '/dispatch', '/linehaul-dispatch']) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await navigate(path); await until('document.body.innerText.includes("LANE-1") || document.body.innerText.includes("OLD-1") || document.body.innerText.includes("Safety inspection")')
    await js(`document.documentElement.classList.toggle('dark', ${dark})`)
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (path === '/sort-plan') { await click('Edit active plan'); await click('Published versions (2)'); await until('document.body.innerText.includes("Preserved destinations")') }
    assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, `${path}: ${width}/${dark} page overflow`)
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    assert.equal(await js('document.activeElement !== document.body'), true, 'Keyboard focus')
    if (path === '/sort-plan') {
      assert.equal(await js('document.querySelector("dialog[open]").contains(document.activeElement)'), true, 'Dialog contains focus')
      if (width === 390 || (width === 1440 && dark)) {
        const shot = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(`${shots}/versions-${width}-${dark ? 'dark' : 'light'}.png`, Buffer.from(shot.data, 'base64'))
      }
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
      await until('!document.querySelector("dialog[aria-labelledby=published-versions-title][open]")')
      await clickLabel('Options for Daily plan')
      await until('document.querySelector("[role=menu]:popover-open")')
      await until('document.activeElement.getAttribute("role") === "menuitem"')
      await click('Duplicate plan')
      await until('document.querySelector("dialog[aria-labelledby=duplicate-plan-title][open]")')
      assert.equal(await js('window.sortFixture.writes.length'), 0, 'Confirmation precedes mutation')
      assert.equal(await js('document.querySelector("dialog[aria-labelledby=duplicate-plan-title] input") === null'), true, 'No duplicate name field')
      assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'Copy confirmation stays within viewport')
      await click('Cancel')
      assert.equal(await js('document.querySelector("[aria-labelledby=plan-workspace-title] details") === null'), true, 'No mapping disclosure')
      assert.equal(await js('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("Lane LANE-1: open"))'), false, 'Operational lane controls removed')
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
      await until('!document.querySelector("dialog[open]")')
    }
    if (path === '/dispatch') assert.equal(await js('document.querySelector("main li input[type=checkbox]").disabled'), true, 'Held staging blocks selection')
    if (path === '/linehaul-dispatch') assert.equal(await js('document.body.innerText.includes("Departure blocked: Safety inspection")'), true, 'Existing trip shows blocking reason')
    if (width === 390 || (width === 1440 && dark)) { const shot = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(`${shots}/${path.slice(1)}-${width}-${dark ? 'dark' : 'light'}.png`, Buffer.from(shot.data, 'base64')) }
    console.log('Responsive / keyboard', path, width, dark ? 'dark' : 'light')
  }
  await navigate('/sort-plan'); await click('Edit active plan'); await click('Published versions (2)'); await js('window.sortFixture.failNext = true'); await click('Activate selected version'); await until('document.body.innerText.includes("Verify previous action")'); await click('Verify previous action'); await until('window.sortFixture.writes.length === 2'); assert.deepEqual(await js('window.sortFixture.writes[0]'), await js('window.sortFixture.writes[1]'), 'Exact plan retry identity')
  await navigate('/sort-plan'); await click('Edit active plan'); await click('Published versions (2)')
  await fill('dialog[aria-labelledby=published-versions-title] input[type=search]', 'No such version')
  await until('document.body.innerText.includes("No matching published versions")')
  await fill('dialog[aria-labelledby=published-versions-title] input[type=search]', 'Version 1')
  assert.equal(await js(`document.querySelectorAll('[aria-label="Published version list"] button').length`), 1, 'Published search is separate')
  await clickLabel('Close published versions')
  await clickLabel('Options for Daily plan'); await click('Duplicate plan')
  await js('window.sortFixture.failNext = true'); await click('Duplicate plan'); await until('document.body.innerText.includes("Verify previous copy")')
  assert.equal(await js(`document.querySelector('button[aria-label="Close duplicate confirmation"]').disabled`), true, 'Uncertain copy blocks dismissal')
  await click('Verify previous copy'); await until('document.body.innerText.includes("Daily plan (1) created.")')
  assert.deepEqual(await js('window.sortFixture.writes[0]'), await js('window.sortFixture.writes[1]'), 'Exact copy retry identity')
  assert.equal(await js('JSON.parse(window.sortFixture.writes[0].body).name === undefined'), true, 'Server allocates copy name')
  await js(`document.querySelector('dialog[aria-labelledby=plan-workspace-title] button[aria-label="Dismiss message"]').click()`)
  assert.equal(await js('document.body.innerText.includes("Daily plan (1) created.")'), false, 'X dismisses success')
  await clickLabel('Options for Daily plan'); await click('Duplicate plan'); await click('Duplicate plan')
  await until('document.body.innerText.includes("Daily plan (2) created.")')
  await until('document.activeElement.matches("#edit-plan-form input")')
  await until('!document.body.innerText.includes("Daily plan (2) created.")')
  await fill('dialog[aria-labelledby=plan-workspace-title] aside input[type=search]', 'No such plan')
  await until('document.body.innerText.includes("No matching plans")')
  console.log('Copy confirmation, numbering, exact retry, independent searches and timed/dismissible notices passed')
  await navigate('/sorting'); await click('Record inspection / release'); await fill('dialog[open] input', 'Inspection completed; safe to sort'); await js('window.sortFixture.failNext = true'); await click('Record release'); await until('document.body.innerText.includes("Verify previous release")'); await click('Verify previous release'); await until('window.sortFixture.writes.length === 2'); assert.deepEqual(await js('window.sortFixture.writes[0]'), await js('window.sortFixture.writes[1]'), 'Exact release retry identity')
  await navigate('/sorting'); await js("Object.defineProperty(navigator, 'onLine', {value:false,configurable:true}); window.dispatchEvent(new Event('offline'))"); await fill('input[placeholder="Tracking ID or waybill reference"]', 'WAY-1'); await js(`document.querySelector(${JSON.stringify('button[aria-label="Add manual sorting capture"]')}).click()`); await until('document.body.innerText.includes("Pending verification") && document.body.innerText.includes("WAY-1")'); assert.equal(await js('window.sortFixture.writes.length'), 0, 'Offline capture makes no routing claim')
  await cdp('Page.reload'); await until('window.sortFixture && document.body.innerText.includes("WAY-1")'); await until('document.body.innerText.includes("WAY-1: LANE-5 (sorted)")'); assert.equal(await js('window.sortFixture.writes.some(w => w.path.endsWith("/batches"))'), true, 'Reload/reconnect sync confirms API lane')
  await navigate('/sorting'); await until('document.body.innerText.includes("SESSION-1") && document.body.innerText.includes("DAMAGED-1") && !document.querySelector("button[aria-label=\\\"Refresh sorting\\\"]").disabled'); await js("window.sortFixture.mode = 'recovery'; window.sortFixture.exception.can_recover = true; window.sortFixture.exception.released_at = '2026-10-06T02:00:00Z'; document.querySelector('button[aria-label=\"Refresh sorting\"]').click()")
  await until('document.querySelector("section[aria-labelledby=exception-queue-title] input[type=checkbox]") && !document.querySelector("section[aria-labelledby=exception-queue-title] input[type=checkbox]").disabled')
  await js('document.querySelector("section[aria-labelledby=exception-queue-title] input[type=checkbox]").click()'); await click('Start recovery session (1)'); await until('window.sortFixture.writes.length === 1')
  assert.deepEqual(await js('JSON.parse(window.sortFixture.writes[0].body).recovery_shipment_ids'), ['damaged-1'], 'Recovery selection submits the selected parcel')
  for (const mode of ['loading', 'empty', 'error']) {
    await js(`sessionStorage.setItem('sort-mode', ${JSON.stringify(mode)})`); await navigate('/sorting')
    if (mode === 'loading') await until('document.body.innerText.includes("Loading exceptions")')
    if (mode === 'empty') await until('document.body.innerText.includes("No outstanding sorting exceptions")')
    if (mode === 'error') await until('document.body.innerText.includes("Sorting service temporarily unavailable")')
  }
  for (const mode of ['empty', 'error']) {
    await js(`sessionStorage.setItem('sort-mode', ${JSON.stringify(mode)})`); await navigate('/sort-plan')
    await until(mode === 'empty' ? 'document.body.innerText.includes("No plan is active for new scans")' : 'document.body.innerText.includes("Sorting service temporarily unavailable")')
  }
  await js("sessionStorage.removeItem('sort-mode')")
  assert.deepEqual(errors, [], 'No browser runtime exceptions')
  console.log('Sorting browser smoke passed: 24 responsive/theme states, keyboard/dialogs, exact retries, exception release, offline reload/reconnect and loading/empty/error.')
} catch (error) {
  console.error('Browser exceptions:', errors)
  console.error('Dialog/focus:', await js('JSON.stringify({dialogs:Array.from(document.querySelectorAll("dialog")).map(d=>({title:d.getAttribute("aria-labelledby"),open:d.open})),active:document.activeElement.outerHTML.slice(0,400)})'))
  console.error('Current view:', await js('document.body?.innerText.slice(-2200)'))
  console.error('Overflow:', await js('JSON.stringify({width:innerWidth, scroll:document.documentElement.scrollWidth, elements:Array.from(document.querySelectorAll("*")).filter(e=>e.getBoundingClientRect().right>innerWidth+2).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,sw:e.scrollWidth,cw:e.clientWidth})).slice(-15)})'))
  throw error
} finally {
  socket.close()
  await fetch(`http://127.0.0.1:19226/json/close/${target.id}`)
}
