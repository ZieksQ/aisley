// Run from the repository root against a production preview and isolated Chromium CDP.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fixtureSource } from './fleet-monitoring-browser.fixtures.mjs'
const origin = process.env.LOGISTICS_UI_ORIGIN ?? 'http://127.0.0.1:5187'
const browser = process.env.LOGISTICS_UI_CDP ?? 'http://127.0.0.1:19359'
const target = await (
  await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })
).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) =>
  socket.addEventListener('open', resolve, { once: true })
)
const pending = new Map()
const errors = []
let serial = 0
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data)
  if (data.method === 'Runtime.exceptionThrown')
    errors.push(
      data.params.exceptionDetails.exception?.description ??
        data.params.exceptionDetails.text
    )
  if (data.method === 'Page.javascriptDialogOpening')
    void cdp('Page.handleJavaScriptDialog', { accept: true })
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
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP timeout: ${method}`))
    }, 20000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function js(expression) {
  const data = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })
  if (data.exceptionDetails)
    throw new Error(JSON.stringify(data.exceptionDetails))
  return data.result.value
}
async function until(expression) {
  for (let count = 0; count < 400; count++) {
    if (await js(`Boolean(document.body && (${expression}))`)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Timed out: ${expression}\n${await js('JSON.stringify({text:document.body?.innerText,url:location.href,ready:document.readyState})')}\n${errors.join('\n')}`
  )
}
const button = (label) =>
  `[...document.querySelectorAll('button')].find(b=>b.textContent.trim() === ${JSON.stringify(label)})`
async function click(label) {
  await until(`${button(label)} && !${button(label)}.disabled`)
  await js(`${button(label)}.focus(); ${button(label)}.click()`)
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Network.setBypassServiceWorker', { bypass: true })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: fixtureSource })
const directory = 'src/logistics/node_modules/.cache/fleet-transfers-browser'
await mkdir(directory, { recursive: true })
let checks = 0
async function check(value, message) { assert.equal(await js(value), true, message); checks++ }
async function navigate(path, full = false) {
  await cdp('Page.bringToFront')
  if (!full && await js('Boolean(window.monitoringFixture && document.querySelector(".portal-shell"))')) {
    await js(`window.monitoringFixture.mode = 'normal'; history.pushState(null, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate'))`)
  } else await cdp('Page.navigate', { url: origin + path })
  await until(`document.querySelector('.portal-page-heading') && !document.querySelector('.portal-skeleton')`)
  await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
}
try {
  for (const width of [320, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    for (const dark of [false, true]) {
      for (const route of ['/fleet-monitoring', '/fleet-monitoring/truck-2', '/fleet-monitoring/truck-2/history', '/fleet-monitoring/truck-2/history/trip-2']) {
        await navigate(route)
        await js(`document.documentElement.classList.toggle('dark', ${dark}); new Promise(resolve => setTimeout(resolve, 100))`)
        await check('document.documentElement.scrollWidth <= innerWidth + 1', `${route} overflow at ${width}/${dark}`)
        if (route.endsWith('trip-2')) {
          await check("document.body.innerText.includes('Outbound Logistics · Sending') && document.body.innerText.includes('Inbound Logistics · Receiving')", 'Sending and receiving organizations labelled')
          await check("document.body.innerText.includes('Laguna Logistics') && document.body.innerText.includes('Davao Logistics')", 'Organization identities retained')
          await check("document.body.innerText.includes('Manifested hub route') && document.body.innerText.includes('road travelled')", 'Past transfer route map explained')
          await check("document.body.innerText.includes('Driver reported arrival') && document.body.innerText.includes('Not recorded')", 'Reported and confirmed arrival remain distinct')
        }
        if (width === 320 || width === 1440) {
          const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
          await writeFile(`${directory}/${route.replaceAll('/', '_')}-${width}-${dark ? 'dark' : 'light'}.png`, Buffer.from(shot.data, 'base64'))
        }
      }
    }
  }
  await navigate('/fleet-monitoring/truck-2/history/trip-2')
  await until("document.querySelectorAll('.assignment-pin-hub').length === 2")
  await check("document.querySelectorAll('.leaflet-overlay-pane path').length === 1", 'Past transfer map connects manifested hubs')
  await check("document.querySelector('.leaflet-tooltip-pane').innerText.includes('Outbound: San Pedro hub') && document.querySelector('.leaflet-tooltip-pane').innerText.includes('Inbound: Davao hub')", 'Map hub roles labelled')
  await navigate('/fleet-monitoring')
  await until("document.querySelector('.assignment-location-label')")
  await check("document.querySelector('.assignment-location-label').innerText.includes('NDR 4828') && document.querySelector('.assignment-location-label').innerText.includes('Last confirmed')", 'Truck marker names its plate and confirmed location')
  await check("!document.querySelector('.leaflet-overlay-pane path')", 'Current map has no manifested route connection')
  await js("document.querySelector('[aria-label=\"Active courier assignments\"] li:nth-child(2) button').click()")
  await until("document.body.innerText.includes('Current position unavailable')")
  await check("document.body.innerText.includes('Outbound Logistics') && document.body.innerText.includes('Inbound Logistics')", 'Current assignment identifies sending and receiving Logistics')
  const snapshot = await js('document.documentElement.outerHTML')
  await writeFile(`${directory}/snapshot.html`, '<!doctype html>\n' + snapshot.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/(href|src)="\/assets\//g, `$1="${origin}/assets/`))
  await navigate('/fleet-monitoring/truck-2?stage=linehaul&search=Rafael')
  await check("!document.querySelector('table') && document.body.innerText.includes('Scheduled departure:')", 'Current schedule retained and history moved')
  await js("[...document.querySelectorAll('a')].find(a=>a.textContent==='Past transfers').click()")
  await until("document.querySelector('table')")
  await check("location.search.includes('stage=linehaul') && location.search.includes('search=Rafael')", 'Fleet filters preserved through history')
  await check("document.querySelectorAll('tbody tr').length === 20 && !document.querySelector('tbody').innerText.includes('Awaiting approval')", 'Past transfers exclude active work')
  await js("[...document.querySelectorAll('a')].find(a=>a.textContent.includes('View transfer')).click()")
  await until("document.body.innerText.includes('Recorded events')")
  await check("location.pathname.includes('/history/trip-')", 'View action navigates to transfer page')
  await js("[...document.querySelectorAll('a')].find(a=>a.textContent==='Back to past transfers').click()")
  await until("document.querySelector('table')")
  await click('Next')
  await until("location.search.includes('history_page=2') && document.querySelectorAll('tbody tr').length === 2")
  await check("window.monitoringFixture.reads.some(url=>url.includes('past=1&page=2'))", 'History pagination requests terminal trips')
  await js("[...document.querySelectorAll('a')].find(a=>a.textContent.includes('View transfer')).click()")
  await until("document.body.innerText.includes('Recorded events')")
  await js("[...document.querySelectorAll('a')].find(a=>a.textContent==='Back to past transfers').click()")
  await until("document.querySelector('table')")
  await check("location.search.includes('history_page=2')", 'Back preserves history page')
  await navigate('/fleet-monitoring/truck-2/history/trip-2')
  await js("window.monitoringFixture.mode='error'")
  await click('Refresh')
  await until("document.body.innerText.includes('Monitoring connection interrupted.')")
  await check("document.body.innerText.includes('Recorded events')", 'Refresh failure keeps existing details')
  await js("window.monitoringFixture.mode='normal'")
  await click('Refresh')
  await until("!document.body.innerText.includes('Monitoring connection interrupted.')")
  await navigate('/fleet-monitoring/truck-2/history/unknown')
  await until("document.body.innerText.includes('Transfer unavailable')")
  await check("!document.body.innerText.includes('Recorded events')", 'Missing transfer clears old details')
  await navigate('/fleet-monitoring/truck-2/history')
  await js("window.monitoringFixture.mode='empty'")
  await click('Refresh')
  await until("document.body.innerText.includes('No past transfers')")
  await check("!document.querySelector('tbody')", 'Empty history explicit')
  await navigate('/fleet-monitoring')
  await check("document.body.innerText.includes('Last confirmed: San Pedro hub')", 'Active truck confirmed location visible')
  await check("document.body.innerText.includes('Truck icons mark last confirmed hubs')", 'Current-map icon semantics explicit')
  await check("!document.body.innerText.includes('Manifested hub route')", 'Manifested route only on past detail')
  await navigate('/fleet-monitoring/truck-2/history/trip-2')
  await js("window.monitoringFixture.mode='unauthorized'")
  await click('Refresh')
  await until("location.pathname === '/login'")
  await check("!document.body.innerText.includes('Rafael Mendoza') && !document.body.innerText.includes('Recorded events')", 'Session loss clears private history')
  assert.deepEqual(errors, [], 'No runtime exceptions')
  await writeFile(`${directory}/verification.json`, JSON.stringify({ checks, errors }, null, 2))
  console.log(JSON.stringify({ checks, errors, directory }))
} finally {
  socket.close()
  await fetch(`${browser}/json/close/${target.id}`)
}
