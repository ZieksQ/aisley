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

  await evaluate(`window.linehaulFixture.mode = 'ready'`)
  await click('Refresh transfers')
  await until(`Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === 'Depart')`)
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Depart').disabled`), true)
  await evaluate(`window.linehaulFixture.actionMode = 'lost-response'; document.querySelector('[aria-label="Courier trip actions"] input').click()`)
  await click('Depart')
  await until(`document.querySelector('[aria-label="Courier trip actions"] [role=alert]')?.textContent.includes('Retry the same confirmation')`)
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === 'Arrived at hub')`), false)
  await click('Retry departure')
  await until(`Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === 'Arrived at hub')`)
  assert.equal(await evaluate(`JSON.stringify(window.linehaulFixture.requests.filter((request) => request.method === 'POST')[0].body) === JSON.stringify(window.linehaulFixture.requests.filter((request) => request.method === 'POST')[1].body)`), true)
  assert.equal(await evaluate(`document.querySelector('.task-facts').textContent.includes('in transfer')`), true)
  await screenshot('mobile-departed-actions')

  await evaluate(`window.linehaulFixture.actionMode = 'slow'; document.querySelector('[aria-label="Courier trip actions"] input').click()`)
  await click('Arrived at hub')
  await until(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Refresh transfers')?.disabled`)
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.task-row')).every((button) => button.disabled)`), true)
  await until(`document.querySelector('[aria-label="Courier trip actions"]').textContent.includes('Arrival reported at')`)
  assert.equal(await evaluate(`document.querySelector('.task-facts').textContent.includes('in transfer')`), true)
  assert.equal(await evaluate(`document.querySelector('[aria-label="Courier trip actions"] input') === null`), true)

  await evaluate(`document.querySelectorAll('.task-row')[1].click(); window.linehaulFixture.actionMode = 'conflict'`)
  await until(`document.querySelector('[aria-label="Courier trip actions"] input') !== null`)
  await evaluate(`document.querySelector('[aria-label="Courier trip actions"] input').click()`)
  await click('Arrived at hub')
  await until(`document.querySelector('[aria-label="Courier trip actions"] [role=alert]')?.textContent.includes('Refresh transfers before trying again')`)
  assert.equal(await evaluate(`document.querySelector('[aria-label="Courier trip actions"] input').disabled`), true)
  await evaluate(`window.linehaulFixture.actionMode = 'ready'`)
  await click('Refresh transfers')
  await until(`document.querySelector('[aria-label="Courier trip actions"] input')?.disabled === false`)
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true)

  await evaluate(`Object.assign(window.linehaulFixture.trips[0], { status: 'scheduled', courier_can_depart: false, courier_can_report_arrival: false, released_for_departure_at: null, courier_arrived_at: null })`)
  await click('Refresh transfers')
  await until(`document.querySelectorAll('.task-row').length === 2`)
  await evaluate(`document.querySelectorAll('.task-row')[0].click()`)
  await until(`document.body.textContent.includes('Waiting for origin Logistics to release')`)
  assert.equal(await evaluate(`document.querySelector('[aria-label="Courier trip actions"] input') === null`), true)
  assert.equal(await evaluate(`window.linehaulFixture.requests.every((request) => request.credentials === 'omit' && request.authorization === 'Bearer synthetic-browser-token')`), true)
  assert.equal(await evaluate(`window.linehaulFixture.requests.filter((request) => request.method === 'POST').every((request) => request.body.confirmation === true && Object.keys(request.body).sort().join(',') === 'confirmation,expected_revision')`), true)
  if (process.env.LINEHAUL_LOGISTICS_ORIGIN) {
    await command('Page.navigate', { url: `${process.env.LINEHAUL_LOGISTICS_ORIGIN}/tests/linehaul-release-fixture.html` })
    await until(`document.body?.textContent.includes('Release to driver')`)
    await click('Release to driver')
    assert.equal(await evaluate(`window.releaseFixture.requests.filter((request) => request.method === 'POST').length`), 0)
    for (const dark of [false, true]) {
      await evaluate(`document.documentElement.classList.toggle('dark', ${dark})`)
      for (const width of [1280, 375]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 })
        await new Promise((resolve) => setTimeout(resolve, 150))
        assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true)
        await screenshot(`logistics-release-${dark ? 'dark' : 'light'}-${width}`)
      }
    }
    await evaluate(`window.releaseFixture.confirmed = true; window.releaseFixture.fail = true`)
    await click('Release to driver')
    await until(`document.body.textContent.includes('The trip changed. Refresh before releasing it.')`)
    await evaluate(`window.releaseFixture.fail = false`)
    await click('Release to driver')
    await until(`document.body.textContent.includes('Truck released to the driver. Waiting for actual departure.')`)
    assert.equal(await evaluate(`window.releaseFixture.trip.status === 'scheduled' && window.releaseFixture.trip.can_depart`), true)
    assert.equal(await evaluate(`window.releaseFixture.requests.filter((request) => request.method === 'POST').every((request) => request.credentials === 'include' && request.body.expected_revision === 1 && request.body.confirmation === true)`), true)
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === 'Release to driver')`), false)
  }
  console.log('PASS: route regressions, confirmed departure/arrival, lost-response replay, stale/conflict recovery, busy/selection lock, release gating, mobile overflow and bearer-only transport.')
} finally {
  socket.close()
  await fetch(`${cdp}/json/close/${target.id}`).catch(() => {})
}
