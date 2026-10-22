// Start couriermockup Vite on 5177 and Chromium CDP on 19227 with fake camera flags.
// All API/tile responses are synthetic; no account, database or provider is used.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const origin = process.env.LINEHAUL_BROWSER_ORIGIN ?? 'http://127.0.0.1:5177'
const cdp = process.env.LINEHAUL_BROWSER_CDP ?? 'http://127.0.0.1:19227'
const artifacts = 'node_modules/.cache/courier-parcel-browser'
await mkdir(artifacts, { recursive: true })
const target = await (await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
let nextId = 0
const pending = new Map()
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  const handler = pending.get(message.id)
  if (!handler) return
  pending.delete(message.id)
  if (message.error) handler.reject(new Error(message.error.message))
  else handler.resolve(message.result)
}
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text + ': ' + response.result.description)
  return response.result.value
}
async function until(expression) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await evaluate(`Boolean(${expression})`)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${expression}`)
}
async function click(label) {
  await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === ${JSON.stringify(label)}).click()`)
}
async function screenshot(name) {
  const { data } = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(`${artifacts}/${name}.png`, Buffer.from(data, 'base64'))
}

try {
 await command('Page.enable')
 await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
 await command('Page.navigate', { url: `${origin}/tests/final-mile-fixture.html` })
 await until(`document.body?.textContent.includes('Accept parcel')`)
 assert.equal(await evaluate(`document.body.textContent.includes('Accept all')`), false)
 await click('Accept parcel')
 await until(`document.body.textContent.includes('Request hub pickup confirmation')`)
 assert.equal(await evaluate(`window.parcelFixture.tasks[1].status`), 'delivery_assigned')
 await screenshot('accepted-mobile')
 await evaluate(`document.querySelectorAll('.task-row')[1].click()`)
 await until(`document.body.textContent.includes('Reject parcel')`)
 await evaluate(`{
  const input = document.getElementById('final-rejection');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Unavailable for this parcel');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  window.parcelFixture.failReject = true;
 }`)
 await until(`!Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Reject parcel').disabled`)
 await click('Reject parcel')
 await until(`document.body.textContent.includes('Synthetic connection lost')`)
 await click('Reject parcel')
 await until(`document.querySelectorAll('.task-row').length === 1 && !document.body.textContent.includes('PARCEL-two')`)
 const keys = await evaluate(`window.parcelFixture.requests.filter(r => r.path.endsWith('/reject')).map(r => r.key)`)
 assert.ok(keys[0] && keys[0] === keys[1])
 assert.equal(await evaluate(`window.parcelFixture.tasks[0].status`), 'delivery_accepted')
 // Move the synthetic server projection to the POD step, as Logistics would after custody validation.
 await evaluate(`window.parcelFixture.tasks[0].status = 'out_for_delivery'`)
 await click('Refresh task state')
 await until(`document.body.textContent.includes('Take parcel photo')`)
 await click('Take parcel photo')
 await until(`document.querySelector('video')?.videoWidth > 0`)
 await click('Capture photo')
 await until(`document.querySelector('img[alt="Selected delivery proof preview"]')`)
 await screenshot('photo-preview-mobile')
 await click('Retake photo')
 await until(`document.querySelector('video')?.videoWidth > 0`)
 await click('Capture photo')
 await until(`document.querySelector('img[alt="Selected delivery proof preview"]')`)
 assert.equal(await evaluate(`Array.from(document.querySelectorAll('#root button')).find(b => b.textContent.trim() === 'Delivery').disabled`), true)
 assert.equal(await evaluate(`window.parcelFixture.uploaded`), false)
 await evaluate(`document.querySelector('#root input[type="checkbox"]').click(); window.parcelFixture.failCompletion = true`)
 await click('Delivery')
 await until(`document.body.textContent.includes('Photo saved. Tap Delivery again')`)
 assert.equal(await evaluate(`window.parcelFixture.tasks[0].completion_status`), null)
 await click('Delivery')
 await until(`document.body.textContent.includes('Delivery submitted · awaiting Logistics confirmation.')`)
 assert.equal(await evaluate(`window.parcelFixture.tasks[0].status`), 'out_for_delivery')
 assert.deepEqual(await evaluate(`window.parcelFixture.completionBody`), { evidence_id: 'proof', expected_revision: 2, confirmed: true, cod_collected: true })
 const submissionRequests = await evaluate(`window.parcelFixture.requests.filter(r => r.method === 'POST' && r.path.endsWith('/completion'))`)
 assert.equal(submissionRequests.length, 2)
 assert.equal(submissionRequests[0].key, submissionRequests[1].key)
 assert.equal(await evaluate(`window.parcelFixture.requests.filter(r => r.path.endsWith('/proof-of-delivery')).length`), 1)
 const requests = await evaluate(`window.parcelFixture.requests`)
 assert.ok(requests.filter(r => !r.path.startsWith('/api/v1/logistics')).every(r => r.credentials === 'omit' && r.authorization === 'Bearer synthetic-test-token'))
 assert.ok(!requests.some(r => r.method === 'POST' && r.path.includes('/final-mile-batches/')))
 assert.ok(requests.some(r => r.multipart && r.key))
 await screenshot('pending-review-mobile')
 assert.equal(await evaluate(`document.documentElement.scrollWidth > innerWidth`), false)
 await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
 await screenshot('pending-review-desktop')
 await evaluate(`window.showLogistics()`)
 await until(`document.querySelector('#logistics-root [aria-label="POD review"]')?.textContent.includes('ORDER-one')`)
 await until(`document.querySelector('#logistics-root img')?.naturalWidth > 0`)
 assert.equal(await evaluate(`document.querySelector('#logistics-root').textContent.includes('₱120.00')`), true)
 const beforePoll = await evaluate(`window.parcelFixture.requests.filter(r => r.path === '/api/v1/logistics/delivery-confirmations').length`)
 await evaluate(`window.parcelFixture.intervals.find(item => item.delay === 30000).callback()`)
 await until(`window.parcelFixture.requests.filter(r => r.path === '/api/v1/logistics/delivery-confirmations').length > ${beforePoll}`)
 assert.equal(await evaluate(`window.parcelFixture.requests.filter(r => r.path.startsWith('/api/v1/logistics')).every(r => r.credentials === 'include' && r.authorization === null)`), true)
 await screenshot('logistics-pending-desktop')
 await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
 await screenshot('logistics-pending-mobile')
 assert.equal(await evaluate(`document.documentElement.scrollWidth > innerWidth`), false)
 await evaluate(`document.querySelector('#logistics-root input[type="checkbox"]').click()`)
 await click('Approve delivery')
 await until(`typeof window.parcelFixture.releaseReview === 'function'`)
 const beforeLockedFocus = await evaluate(`window.parcelFixture.requests.filter(r => r.path === '/api/v1/logistics/delivery-confirmations').length`)
 await evaluate(`window.dispatchEvent(new Event('focus'))`)
 await new Promise(resolve => setTimeout(resolve, 200))
 assert.equal(await evaluate(`window.parcelFixture.requests.filter(r => r.path === '/api/v1/logistics/delivery-confirmations').length`), beforeLockedFocus)
 await evaluate(`window.parcelFixture.releaseReview()`)
 await until(`document.querySelector('#logistics-root').textContent.includes('No deliveries are waiting for review.')`)

 // A committed intent whose response was lost reconciles without an extra submit.
 await command('Page.navigate', { url: `${origin}/tests/final-mile-fixture.html?delivery&lost-response` })
 await until(`document.body?.textContent.includes('Take parcel photo')`)
 await evaluate(`(async () => {
   const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
   const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
   const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'parcel.png', { type: 'image/png' }));
   const input = document.querySelector('#delivery-photo'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
   document.querySelector('#root input[type="checkbox"]').click();
 })()`)
 await until(`!Array.from(document.querySelectorAll('#root button')).find(b => b.textContent.trim() === 'Delivery').disabled`)
 await click('Delivery')
 await until(`document.body.textContent.includes('Delivery submitted · awaiting Logistics confirmation.')`)
 assert.equal(await evaluate(`window.parcelFixture.requests.filter(r => r.method === 'POST' && r.path.endsWith('/completion')).length`), 1)

 // A photo saved by the earlier two-step screen can still be submitted directly.
 await command('Page.navigate', { url: `${origin}/tests/final-mile-fixture.html?delivery&proof` })
 await until(`document.body?.textContent.includes('Take parcel photo')`)
 await evaluate(`document.querySelector('#root input[type="checkbox"]').click()`)
 await click('Delivery')
 await until(`document.body.textContent.includes('Delivery submitted · awaiting Logistics confirmation.')`)
 assert.equal(await evaluate(`window.parcelFixture.requests.some(r => r.path.endsWith('/proof-of-delivery'))`), false)
 console.log('Passed per-parcel decisions, single Delivery submission, COD gate, photo capture/retake, partial failure retry, lost-response reconciliation, saved-photo recovery, Logistics queue/photo visibility, focus/poll refresh and role transport checks.')

} finally {
 await command('Page.close').catch(() => {})
 socket.close()
}
