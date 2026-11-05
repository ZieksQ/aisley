// Run from the repo root against the Logistics production preview and isolated Chromium CDP.
// These controlled API fixtures verify UI behavior; Laravel and PostgreSQL checks run separately.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { installPodFixtures } from './pod-browser.fixtures.mjs'
const origin = process.env.PARCEL_ORIGIN ?? 'http://127.0.0.1:15176'
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
  const at = '2026-11-05T01:00:00Z'
  const records = Array.from({ length: 12 }, (_, i) => ({
    shipment_id: `shipment-${i + 1}`, revision: 3, status: 'out_for_delivery', last_activity_at: at,
    parcel: { id: `parcel-${i + 1}`, reference: `PARCEL-${i + 1}`, order_id: `order-${i + 1}`, order_reference: `ORDER-${i + 1}`, waybill_reference: `WAY-${i + 1}`, tracking_id: `AWB-${i + 1}`, item_count: 2 },
    allowed_transitions: ['delivered', 'in_transit'], tasks: [{
      task_id: `task-${i + 1}`, revision: 4, leg: 'final_mile', status: 'out_for_delivery', courier_id: 'courier-1', courier: { name: 'Parcel Courier' },
      accepted_at: at, picked_up_at: at, evidence_status: 'awaiting_validation', completion_status: 'awaiting_validation',
      evidence: [{ id: `proof-${i + 1}`, purpose: 'delivery_proof', type: 'photo', status: 'awaiting_validation', safe_reference: `POD-${i + 1}`, submitted_at: at }],
      completion_intents: [{ id: `intent-${i + 1}`, evidence_id: `proof-${i + 1}`, status: 'awaiting_validation', confirmed_at: at, expected_revision: 4 }],
    }],
  }))
  window.parcelFixture = { navigation: crypto.randomUUID(), records, reads: [], writes: [], mode: 'normal', queueDelay: 0, recordDelay: '', offline: false }
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !window.parcelFixture.offline })
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  window.confirm = () => true
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin), path = parsed.pathname, f = window.parcelFixture
    if (path.endsWith('/chat-notifications')) return json({ data: [], meta: { unread_count: 0 } })
    if (path.endsWith('/dashboard/queue')) {
      f.reads.push(parsed.search)
      const mode = f.mode, delay = f.queueDelay
      let rows = mode === 'empty' ? [] : records.filter(r => (!parsed.searchParams.get('search') || r.parcel.tracking_id.includes(parsed.searchParams.get('search'))) && (!parsed.searchParams.get('status') || r.status === parsed.searchParams.get('status')))
      const page = Number(parsed.searchParams.get('page') ?? 1)
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      if (mode === 'queue-error') return json({ message: 'Parcel queue unavailable.' }, 403)
      return json({ data: rows.slice((page - 1) * 10, page * 10), meta: { current_page: page, per_page: 10, last_page: Math.max(1, Math.ceil(rows.length / 10)), total: rows.length }, summary: { total: rows.length, pending_evidence: rows.length, pending_completion: rows.length, by_status: { out_for_delivery: rows.length } }, freshness: { generated_at: at, state: 'authoritative' } })
    }
    if (path.includes('/update-status/records/')) {
      const reference = decodeURIComponent(path.split('/').at(-1))
      f.reads.push(reference)
      const record = records.find(r => [r.parcel.tracking_id, r.parcel.waybill_reference, r.parcel.order_reference, r.shipment_id].includes(reference))
      if (reference === f.recordDelay) await new Promise(resolve => setTimeout(resolve, 900))
      if (f.mode === 'record-error') return json({ message: 'Parcel not available to this hub.' }, 404)
      return record ? json({ data: record }) : json({ message: 'Parcel not found.' }, 404)
    }
    if (path.endsWith('/update-status/transitions')) {
      f.writes.push({ body: options.body, key: new Headers(options.headers).get('Idempotency-Key') })
      if (f.mode === 'uncertain' && f.writes.length === 1) return json({ message: 'Update result unavailable.' }, 503)
      const record = records.find(r => r.parcel.tracking_id === JSON.parse(options.body).reference)
      return json({ data: { ...record, revision: 4, allowed_transitions: [] } })
    }
    return original(url, options)
  }
}
const shots = 'src/api/storage/framework/testing/parcel-search-shots'
await mkdir(shots, { recursive: true })
await cdp('Page.enable'); await cdp('Runtime.enable')
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installPodFixtures.toString()})(); (${fixtures.toString()})();` })
const findButton = (text) => `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)} && b.getClientRects().length)`
async function click(text) { await until(`${findButton(text)} && !${findButton(text)}.disabled`); await js(`${findButton(text)}.click()`) }
async function clickLabel(label) {
  await js(`document.querySelector(${JSON.stringify(`button[aria-label="${label}"]`)}).click()`)
}
async function navigate(path) {
  const previous = await js('window.parcelFixture?.navigation')
  await cdp('Page.navigate', { url: origin + path })
  await until(`window.parcelFixture && window.parcelFixture.navigation !== ${JSON.stringify(previous)} && document.querySelector('main h2')`)
}
async function fill(selector, value) {
  await js(`(() => { const input=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(input.tagName === 'SELECT' ? HTMLSelectElement.prototype : input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); })()`)
}

const tasteFindings = []
async function inspectTaste(name, width) {
  if (!process.env.TASTE_SKILL_DIR || width === 320) return
  const folder = process.env.TASTE_SKILL_DIR
  const { probe, app } = await import(pathToFileURL(`${folder}/scripts/lib/probe.mjs`))
  const { judge, judgeApp, APP_SKIP } = await import(pathToFileURL(`${folder}/scripts/lib/rules.mjs`))
  const metrics = await js(`(${probe.toString()})()`)
  const appMetrics = await js(`(${app.toString()})()`)
  const findings = [...judge(metrics, {width}).filter(f => !APP_SKIP.has(f.id) && !['no-title', 'small-title'].includes(f.id)), ...judgeApp(appMetrics, metrics, {width})]
  tasteFindings.push({name, findings})
  await writeFile(`${shots}/taste-measurements.json`, JSON.stringify(tasteFindings, null, 2))
}
async function lookup(value) { await fill('#parcel-reference', value); await click('Look up') }
async function waitRecord(reference) { await until(`document.querySelector('.parcel-record')?.innerText.includes(${JSON.stringify('Tracking ID ' + reference)})`) }
async function shot(name) { const image = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(`${shots}/${name}.png`, Buffer.from(image.data, 'base64')) }
try {
  for (const width of [320, 390, 768, 1440]) for (const dark of [false, true]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await navigate('/operations'); await until('document.querySelectorAll(".parcel-result").length === 10')
    await js(`document.documentElement.classList.toggle('dark', ${dark})`); await new Promise(resolve => setTimeout(resolve, 400))
    assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, `Initial overflow ${width}/${dark}`)
    assert.equal(await js('getComputedStyle(document.querySelector(".parcel-back")).display === "none"'), width >= 1024, 'Back control only on mobile')
    await shot(`results-${width}-${dark ? 'dark' : 'light'}`); await inspectTaste(`results-${width}-${dark}`, width)
    await lookup('AWB-1'); await waitRecord('AWB-1')
    assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, `Detail overflow ${width}/${dark}`)
    assert.equal(await js(`${findButton('Validate delivery')}.disabled`), true, 'Proof viewing required')
    assert.equal(await js(`document.querySelector('.parcel-workspace').firstElementChild.classList.contains('parcel-detail')`), width < 1024, 'Mobile DOM and visual reading order agree')
    await shot(`detail-${width}-${dark ? 'dark' : 'light'}`); await inspectTaste(`detail-${width}-${dark}`, width)
    if (width < 1024) { await click('Back to results'); assert.equal(await js('document.activeElement.id'), 'parcel-results') }
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    assert.equal(await js('document.activeElement !== document.body'), true, 'Keyboard focus')
  }
  await navigate('/operations'); await until('document.querySelectorAll(".parcel-result").length === 10')
  await click('Next'); await until('document.querySelectorAll(".parcel-result").length === 2')
  assert.equal(await js('new URLSearchParams(location.search).get("page")'), '2')
  await fill('.parcel-filters input', 'AWB-1'); await click('Apply filters'); await until('document.querySelectorAll(".parcel-result").length === 4')
  assert.equal(await js('new URLSearchParams(location.search).has("page")'), false, 'Filtering resets page')
  await click('Reset filters'); await until('document.querySelectorAll(".parcel-result").length === 10')
  await js('history.back()'); await until('document.querySelector(".parcel-filters input").value === "AWB-1"')
  await js('history.forward()'); await until('document.querySelector(".parcel-filters input").value === ""')
  await lookup('AISLEY:WB:1:AWB-2'); await waitRecord('AWB-2'); await until('document.body.innerText.includes("Barcode decoded locally")')
  await click('Review photo POD'); await until('document.querySelector(".parcel-record img")'); await until(`!${findButton('Validate delivery')}.disabled`)
  await fill('#transition-reason', 'First parcel draft')
  await js('window.parcelFixture.recordDelay = "AWB-1"')
  await lookup('AWB-1')
  await js('document.querySelectorAll(".parcel-result")[2].click()'); await waitRecord('AWB-3')
  await new Promise(resolve => setTimeout(resolve, 1100))
  assert.equal(await js('document.querySelector(".parcel-record").innerText.includes("Tracking ID AWB-3")'), true, 'Superseded response discarded')
  assert.equal(await js('document.querySelector("#transition-reason").value'), '', 'Draft cleared between parcels')
  assert.equal(await js(`${findButton('Validate delivery')}.disabled`), true, 'Proof review cannot carry over to another parcel')
  await lookup('UNKNOWN'); await until('document.body.innerText.includes("Parcel not found")')
  const reads = await js('window.parcelFixture.reads.length'); await new Promise(resolve => setTimeout(resolve, 500))
  assert.equal(await js('window.parcelFixture.reads.length'), reads, 'Failed reference does not retry in a loop')
  assert.equal(await js('document.querySelector(".parcel-record") === null'), true, 'Failed lookup cannot show previous parcel')
  await lookup('AWB-4'); await waitRecord('AWB-4')
  await js('window.parcelFixture.offline = true; window.dispatchEvent(new Event("offline"))')
  await click('Refresh details'); await until('document.body.innerText.includes("Cached parcel details")')
  assert.equal(await js(`${findButton('Record in transit')}.disabled`), true, 'Offline cache is read only')
  await clickLabel('Refresh parcel queue'); await until('document.querySelector(".parcel-results").innerText.includes("Cached parcel results")')
  await js('window.parcelFixture.offline = false; window.dispatchEvent(new Event("online"))')
  await click('Refresh details'); await waitRecord('AWB-4'); await until(`!${findButton('Record in transit')}.disabled`)
  await js('window.parcelFixture.mode = "uncertain"')
  await click('Record in transit'); await until('document.body.innerText.includes("Verify previous update")')
  assert.equal(await js('document.querySelector("#parcel-reference").disabled'), true, 'Uncertain update blocks switching parcel')
  await click('Verify previous update'); await until('document.body.innerText.includes("Custody update confirmed")')
  assert.deepEqual(await js('window.parcelFixture.writes[0]'), await js('window.parcelFixture.writes[1]'), 'Exact uncertain retry identity')
  await js('window.parcelFixture.mode = "queue-error"'); await clickLabel('Refresh parcel queue'); await until('document.body.innerText.includes("Parcel queue unavailable")')
  assert.equal(await js('document.querySelector(".parcel-results").innerText.includes("No parcels match")'), false, 'Failed read is not empty results')
  await js('window.parcelFixture.mode = "empty"'); await clickLabel('Refresh parcel queue'); await until('document.body.innerText.includes("No parcels match")')
  await js('window.parcelFixture.mode = "normal"; window.parcelFixture.queueDelay = 700'); await clickLabel('Refresh parcel queue'); await until('document.querySelector(".parcel-results [aria-busy=true]")')
  await until('document.querySelectorAll(".parcel-result").length === 10')
  assert.deepEqual(errors, [], 'No runtime exceptions')
  console.log('Parcel search passed: 16 responsive/theme/layout states; lookup, QR decode, filters/reset/history, server paging, races, draft clearing, errors, offline cache, proof gating, exact mutation retries.')
} catch (error) {
  console.error('Current view:', await js('document.body.innerText'))
  console.error('Runtime errors:', errors)
  throw error
} finally {
  socket.close(); await fetch(`http://127.0.0.1:19226/json/close/${target.id}`)
}
