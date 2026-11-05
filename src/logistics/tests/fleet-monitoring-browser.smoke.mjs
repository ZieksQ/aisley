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
async function key(value, code = value, keyCode = 0) {
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: value,
    code,
    windowsVirtualKeyCode: keyCode
  })
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: value,
    code,
    windowsVirtualKeyCode: keyCode
  })
}
async function fill(selector, value) {
  await js(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); })()`
  )
}

await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Network.setBypassServiceWorker', { bypass: true })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: fixtureSource })
const directory = 'src/logistics/node_modules/.cache/fleet-monitoring-browser'
await mkdir(directory, { recursive: true })
let checks = 0
async function check(value, message) { assert.equal(await js(value), true, message); checks++ }
async function navigate(path, full = false) {
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
      for (const route of ['/fleet-monitoring', '/fleet-monitoring/truck-1', '/fleet-monitoring/truck-2']) {
        await navigate(route)
        await js(`document.documentElement.classList.toggle('dark', ${dark}); new Promise(resolve => setTimeout(resolve, 100))`)
        await check('document.documentElement.scrollWidth <= innerWidth + 1', `${route} overflow at ${width}/${dark}`)
        await check("getComputedStyle(document.querySelector('.portal-page')).fontFamily.includes('Geist')", 'Existing typeface')
        if (width < 1440) await check("document.querySelector('.portal-table-region').scrollWidth > document.querySelector('.portal-table-region').clientWidth", 'Wide tables scroll within their region')
        if (route.endsWith('truck-2')) await check("document.body.innerText.includes('In transit: San Pedro hub → Davao hub') && document.body.innerText.includes('Driver reported arrival') && document.body.innerText.includes('Not recorded')", 'Reported arrival is distinct')
        if (width === 320 || width === 1440) {
          const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
          await writeFile(`${directory}/${route.replaceAll('/', '_')}-${width}-${dark ? 'dark' : 'light'}.png`, Buffer.from(shot.data, 'base64'))
        }
      }
    }
  }
  await navigate('/fleet-monitoring')
  await fill('input[name=search]', 'Rafael')
  await fill('select[name=availability]', 'reserved')
  await js("document.querySelector('input[name=overdue]').click()")
  await click('Apply filters')
  await until("location.search.includes('overdue=1') && document.querySelectorAll('tbody tr').length === 4")
  await check("document.body.innerText.includes('Departure overdue · approval pending')", 'Approval pending overdue label')
  await js("document.querySelector('tbody a').click()")
  await until("location.pathname.includes('/truck-1') && document.body.innerText.includes('Truck overview')")
  await click('Next')
  await until("location.search.includes('history_page=2') && document.querySelectorAll('tbody tr').length === 3")
  await js("document.querySelector('summary').click()")
  await check("document.querySelector('details').open", 'History timeline expands')
  await js("[...document.querySelectorAll('a')].find(a=>a.textContent==='Back to fleet monitoring').click()")
  await until("location.pathname === '/fleet-monitoring' && document.querySelectorAll('tbody tr').length === 4")
  await check("document.querySelector('input[name=search]').value === 'Rafael' && !location.search.includes('history_page')", 'Filters preserved across details and Back')
  await click('Clear filters')
  await until("document.querySelectorAll('tbody tr').length === 20")
  await click('Next')
  await until("location.search.includes('page=2') && document.querySelectorAll('tbody tr').length === 3")
  await js("window.monitoringFixture.mode='error'")
  await click('Refresh')
  await until("document.body.innerText.includes('Displayed data is outdated')")
  await check("document.querySelectorAll('tbody tr').length === 3", 'Failed refresh retains clearly stale rows')
  await js("window.monitoringFixture.mode='normal'")
  await click('Retry')
  await until("!document.body.innerText.includes('Displayed data is outdated')")
  await js("window.monitoringFixture.mode='empty'; window.monitoringFixture.interval()")
  await until("document.body.innerText.includes('No matching trucks')")
  checks++
  await navigate('/fleet-monitoring/unknown')
  await until("document.body.innerText.includes('Truck unavailable')")
  await check("!document.body.innerText.includes('NDR 4828')", 'Missing truck hides old detail')
  await navigate('/fleet-monitoring/truck-7')
  await check("document.body.innerText.includes('Empty return') && document.body.innerText.includes('0 / 250')", 'Empty return shown honestly')
  await js("window.monitoringFixture.mode='empty'")
  await click('Refresh')
  await until("document.body.innerText.includes('No recorded trips')")
  checks++
  await navigate('/fleet-monitoring/truck-0')
  await check("document.body.innerText.includes('No active trip')", 'Idle truck state')
  await navigate('/fleet-monitoring/truck-1')
  await js("window.monitoringFixture.mode='error'")
  await click('Refresh')
  await until("document.body.innerText.includes('Displayed data is outdated')")
  await check("document.body.innerText.includes('Rafael Mendoza')", 'Detail refresh retains stale snapshot')
  await js("window.monitoringFixture.mode='normal'")
  await click('Retry')
  await until("!document.body.innerText.includes('Displayed data is outdated')")
  await navigate('/fleet-monitoring')
  await js("window.monitoringFixture.mode='delay'")
  await click('Refresh')
  await until('window.monitoringFixture.pending.length === 1')
  await js("history.pushState(null,'','/fleet-monitoring/truck-0'); dispatchEvent(new PopStateEvent('popstate'))")
  await until('window.monitoringFixture.pending.length === 3')
  await check("!document.querySelector('tbody tr') && Boolean(document.querySelector('.portal-skeleton'))", 'Loading another resource hides old rows')
  await js("window.monitoringFixture.pending.splice(0).forEach(resolve=>resolve()); window.monitoringFixture.mode='normal'")
  await until("document.body.innerText.includes('Truck overview')")
  await check("document.querySelector('.portal-page-heading').textContent === 'NDR 4827'", 'Obsolete list response ignored')
  await navigate('/fleet-monitoring')
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await check("document.activeElement !== document.body", 'Keyboard focus reaches a control')
  await js("document.documentElement.classList.remove('dark')")
  const snapshot = await js("document.documentElement.outerHTML")
  await writeFile(`${directory}/snapshot.html`, '<!doctype html>\n' + snapshot.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/(href|src)="\/assets\//g, `$1="${origin}/assets/`))
  await js("window.monitoringFixture.mode='error'; history.pushState(null, '', '/fleet-monitoring?search=initial-failure'); dispatchEvent(new PopStateEvent('popstate'))")
  await until("document.body.innerText.includes('Fleet monitoring unavailable')")
  await check("!document.querySelector('tbody tr') && !document.body.innerText.includes('No matching trucks')", 'Initial failure is distinct from empty results')
  await js("window.monitoringFixture.mode='normal'")
  await click('Retry')
  await until("document.body.innerText.includes('No matching trucks')")
  await navigate('/fleet-monitoring')
  const beforeHidden = await js('window.monitoringFixture.reads.length')
  await js("Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); window.monitoringFixture.interval()")
  assert.equal(await js('window.monitoringFixture.reads.length'), beforeHidden)
  checks++
  await js("Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange'))")
  await until(`window.monitoringFixture.reads.length > ${beforeHidden}`)
  checks++
  await js("window.monitoringFixture.mode='forbidden'")
  await click('Refresh')
  await until("location.pathname === '/policy-consent'")
  await check("!document.body.innerText.includes('NDR 4827')", 'Consent loss clears fleet data')
  await navigate('/fleet-monitoring', true)
  await js("window.monitoringFixture.mode='unauthorized'")
  await click('Refresh')
  await until("location.pathname === '/login'")
  await check("!document.body.innerText.includes('NDR 4827')", 'Session expiry clears private fleet data')
  await navigate('/fleet-monitoring?availability=reserved&overdue=1', true)
  await check("document.querySelectorAll('tbody tr').length === 4 && document.querySelector('select[name=availability]').value === 'reserved' && document.querySelector('input[name=overdue]').checked", 'Deep links restore filter state')
  await js("window.monitoringFixture.mode='delay'")
  await click('Refresh')
  await until('window.monitoringFixture.pending.length === 1')
  await click('Sign out')
  await until("location.pathname === '/login'")
  await js("window.monitoringFixture.pending.splice(0).forEach(resolve=>resolve())")
  await check("!document.body.innerText.includes('NDR 4827') && !document.querySelector('tbody')", 'Late monitoring response after logout is ignored')
  assert.deepEqual(errors, [])
  const result = { checks, responsiveCombinations: 18, runtimeErrors: errors }
  await writeFile(`${directory}/verification.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally {
  socket.close()
  await fetch(`${browser}/json/close/${target.id}`)
}
