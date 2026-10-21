// Start couriermockup Vite on 5177 and installed Chromium with CDP on 19227.
// All API/tile responses are synthetic; no account, database or provider is used.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const origin = process.env.LINEHAUL_BROWSER_ORIGIN ?? 'http://127.0.0.1:5177'
const cdp = process.env.LINEHAUL_BROWSER_CDP ?? 'http://127.0.0.1:19227'
const artifacts = 'node_modules/.cache/linehaul-browser'
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
async function mode(value) {
  await evaluate(`window.linehaulFixture.mode = ${JSON.stringify(value)}`)
  await click('Reload route')
}
async function screenshot(name) {
  const { data } = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(`${artifacts}/${name}.png`, Buffer.from(data, 'base64'))
}

try {
  await command('Page.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
  await command('Page.navigate', { url: `${origin}/tests/linehaul-fixture.html` })
  await until(`document.body?.textContent.includes('65 km') && document.querySelectorAll('.maplibregl-marker').length === 2`)
  await until(`window.linehaulFixture.requests.some((request) => request.path.includes('/map-tiles/'))`)
  await new Promise((resolve) => setTimeout(resolve, 500))
  assert.equal(await evaluate(`document.body.textContent.includes('Map tiles could not load')`), false)
  assert.equal(await evaluate(`document.querySelector('.linehaul-jobs').textContent.includes('75 min')`), true)
  assert.equal(await evaluate(`document.querySelector('.maplibregl-canvas').width > 0`), true)
  assert.equal(await evaluate(`document.querySelector('.plain-link').href.includes('destination=14.2117,121.1653')`), true)
  await screenshot('desktop-ready')

  await evaluate(`document.querySelectorAll('.task-row')[1].click()`)
  await until(`document.querySelector('.linehaul-route h3')?.textContent.startsWith('Calamba') && document.querySelector('.plain-link')?.href.includes('destination=14.5995,120.9842')`)
  assert.equal(await evaluate(`document.querySelector('.task-detail').textContent.includes('Empty return')`), true)
  await click('Refresh transfers')
  await until(`document.querySelectorAll('.task-row')[1]?.getAttribute('aria-current') === 'true' && document.querySelector('.plain-link')`)

  await mode('missing')
  await until(`document.body.textContent.includes('One or both hubs have no confirmed map pin') && document.querySelectorAll('.maplibregl-marker').length === 1`)
  assert.equal(await evaluate(`document.querySelector('.route-summary') === null && document.querySelector('.plain-link') === null`), true)

  await mode('quota')
  await until(`document.body.textContent.includes('Dashed line joins the hubs directly') && document.querySelectorAll('.maplibregl-marker').length === 2`)
  assert.equal(await evaluate(`document.querySelector('.route-summary') === null`), true)
  await screenshot('quota-fallback')

  await mode('auth-error')
  await until(`document.querySelector('.route-manifest [role=alert]')?.textContent === 'Unauthenticated.'`)
  assert.equal(await evaluate(`document.querySelector('.route-map') === null && document.querySelector('.plain-link') === null`), true)
  await mode('ready')
  await until(`document.querySelectorAll('.maplibregl-marker').length === 2`)

  await command('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true })
  await new Promise((resolve) => setTimeout(resolve, 300))
  await screenshot('mobile-ready')
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true)
  await mode('tile-error')
  await until(`document.body.textContent.includes('Map tiles could not load')`)
  assert.equal(await evaluate(`document.querySelector('.plain-link') !== null && document.body.textContent.includes('Calamba, Laguna')`), true)

  await evaluate(`window.linehaulFixture.mode = 'list-error'`)
  await click('Refresh transfers')
  await until(`document.body.textContent.includes('Transfers temporarily unavailable.')`)
  assert.equal(await evaluate(`document.querySelector('.task-detail') === null`), true)
  await evaluate(`window.linehaulFixture.mode = 'empty'`)
  await click('Refresh transfers')
  await until(`document.body.textContent.includes('No linehaul transfer jobs assigned.')`)
  assert.equal(await evaluate(`window.linehaulFixture.requests.every((request) => request.credentials === 'omit' && request.authorization === 'Bearer synthetic-browser-token' && request.method === 'GET')`), true)
  assert.equal(await evaluate(`document.body.textContent.includes('synthetic-browser-token')`), false)
  console.log('PASS: road map, outbound/return selection, refresh, missing pins, quota, auth, tile failures, mobile width, list errors, empty results, bearer-only GETs.')
} finally {
  socket.close()
  await fetch(`${cdp}/json/close/${target.id}`).catch(() => {})
}
