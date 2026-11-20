// Run from the repository root with an isolated Logistics preview and Chromium CDP.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { installRatesFleetFixtures } from './rates-fleet-browser.fixtures.mjs'
import { checkRateRuleModal } from './rate-rule-modal.checks.mjs'

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
async function navigate(path, reload = false) {
  console.log('Checking', path)
  if (!reload && await js('Boolean(window.ratesFleetFixture && document.querySelector(".portal-shell"))')) {
    await js(`window.ratesFleetFixture.mode = 'normal'; history.pushState(null, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate'))`)
    await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  } else await cdp('Page.navigate', { url: origin + path })
  const pathname = path.split('?')[0]
  const heading = pathname === '/shipping-rates' ? 'Shipping rates' : pathname.endsWith('/card-1') ? 'Rate card · Version 3' : pathname.endsWith('/card-2') ? 'Rate card · Version 2' : pathname.includes('/rate-cards/') ? 'Rate card version' : pathname === '/vehicles' ? 'Vehicles' : pathname.startsWith('/couriers/') ? 'Courier vehicle' : pathname === '/courier-applications' ? 'Courier applications' : pathname.startsWith('/courier-applications/') ? 'Rafael Mendoza' : 'Company fleet'
  await until(`document.querySelector('.portal-page-heading')?.textContent.trim() === ${JSON.stringify(heading)} && !document.querySelector('.portal-skeleton')`)
  if (pathname === '/shipping-rates') {
    const view = new URL(path, origin).searchParams.get('view') ?? 'tariff'
    await until(`document.getElementById('shipping-rates-tab-' + ${JSON.stringify(view)})?.getAttribute('aria-selected') === 'true'`)
  }
  await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Network.setBypassServiceWorker', { bypass: true })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installRatesFleetFixtures.toString()})();` })
const directory = 'src/logistics/node_modules/.cache/rates-fleet-browser'
await mkdir(directory, { recursive: true })
try {
  const routes = ['/shipping-rates', '/shipping-rates?view=coverage', '/shipping-rates?view=rate-cards', '/shipping-rates/rate-cards/card-1', '/shipping-rates/rate-cards/card-2', '/courier-applications', '/courier-applications/application-1', '/vehicles', '/couriers/courier-1/vehicle', '/fleet']
  for (const width of [320, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    for (const dark of [false, true]) {
      for (const route of routes) {
        await navigate(route)
        await js(`document.documentElement.classList.toggle('dark', ${dark}); new Promise(resolve => setTimeout(resolve, 250))`)
        assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, `${route} overflow at ${width}/${dark}`)
        assert.equal(await js("getComputedStyle(document.querySelector('.portal-page')).fontFamily.includes('Geist')"), true)
        if (width === 1440 || (width === 320 && !dark)) {
          const shot = await cdp('Page.captureScreenshot', { format: 'png' })
          await writeFile(`${directory}/${route.replaceAll(/[^a-z0-9]/gi, '_')}-${width}-${dark ? 'dark' : 'light'}.png`, Buffer.from(shot.data, 'base64'))
        }
      }
    }
  }
  await navigate('/shipping-rates?view=rate-cards')
  await js(`document.querySelector('a[href="/shipping-rates/rate-cards/card-1"]').click()`)
  await until(`document.body.innerText.includes('Weight extras and parcel limits')`)
  assert.equal(await js('location.pathname'), '/shipping-rates/rate-cards/card-1')
  assert.equal(await js("document.body.innerText.includes('Legacy Product Category')"), true)
  await js(`document.querySelector('a[href="/shipping-rates?view=rate-cards"]').click()`)
  await until(`document.querySelector('[role=tab][aria-selected=true]')?.textContent.trim() === 'Rate cards'`)
  await js("document.querySelector('[role=tab][aria-selected=true]').focus()")
  await key('ArrowLeft', 'ArrowLeft', 37)
  await until(`location.search.includes('coverage')`)
  assert.equal(await js("document.activeElement.textContent.trim()"), 'Service coverage')
  await navigate('/shipping-rates/rate-cards/unknown', true)
  await until(`document.body.innerText.includes('Rate card unavailable')`)
  await navigate('/shipping-rates?view=rate-cards')
  await click('Create rate card')
  await fill('#service-base-first_mile', '35')
  await js("document.querySelector('#rate-card-effective').click()")
  await until(`document.querySelector('.logistics-rate-calendar.open')`)
  assert.equal(await js("getComputedStyle(document.querySelector('.logistics-rate-calendar .flatpickr-day.selected')).backgroundColor"), 'rgb(37, 99, 235)')
  await key('Escape', 'Escape', 27)
  await click('Add rate rule')
  await until(`document.querySelector('dialog[open] #rate-rule-shop-category')`)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 700, deviceScaleFactor: 1, mobile: false })
  assert.equal(await js("document.querySelector('dialog').getBoundingClientRect().width <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1"), true, 'Rate-rule modal stays within a narrow viewport')
  assert.equal(await js("document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth + 1"), true, 'Rate-rule modal has no horizontal scroll')
  await js(`document.querySelector('button[aria-label^="Service leg help"]').focus()`)
  assert.equal(await js("(() => { const bounds = document.getElementById('rate-rule-service-help').getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight })()"), true, 'Keyboard help stays visible inside the viewport')
  await writeFile(`${directory}/rate-rule-modal-320.png`, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  assert.equal(await js("getComputedStyle(document.querySelector('dialog')).getPropertyValue('--brand-primary').trim()"), '#2563eb', 'Rule modal inherits Logistics theme')
  await key('Escape', 'Escape', 27)
  await until(`!document.querySelector('dialog[open]')`)
  await click('Add rate rule')
  await until("document.querySelector('dialog[open]')")
  await checkRateRuleModal({ cdp, js, until, click, fill, key, directory })
  await js("window.ratesFleetFixture.mode = 'error'")
  await click('Refresh')
  await until(`document.querySelector('[role=alert]')`)
  assert.equal(await js("document.querySelector('#service-base-first_mile')?.value"), '35', 'Failed refresh preserves unsaved rate-card input')
  await js("window.ratesFleetFixture.mode = 'normal'")
  await click('Try again')
  await until(`!document.querySelector('[role=alert]')`)
  await click('Cancel')
  await until(`document.querySelector('dialog[open]')`)
  await click('Discard changes')
  await until(`document.body.innerText.includes('Rate card versions')`)
  await navigate('/vehicles?search=Rafael&page=2')
  await until(`document.querySelector('.portal-page a[href^="/couriers/courier-1/vehicle"]')`)
  await js(`document.querySelector('.portal-page a[href^="/couriers/courier-1/vehicle"]').click()`)
  await until(`document.body.innerText.includes('Vehicle details')`)
  assert.equal(await js(`document.querySelector('.portal-page a[href^="/vehicles"]').search`), '?search=Rafael&page=2')
  await navigate('/courier-applications?search=Rafael&page=2')
  await until(`document.querySelector('.portal-page a[href^="/courier-applications/application-1"]')`)
  await js(`document.querySelector('.portal-page a[href^="/courier-applications/application-1"]').click()`)
  await until(`document.body.innerText.includes('Applicant details')`)
  assert.equal(await js(`document.querySelector('.portal-page a[href^="/courier-applications?"]').search`), '?search=Rafael&page=2')
  await navigate('/fleet')
  await click('Register truck')
  await until(`document.querySelector('dialog[open] input')`)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 700, deviceScaleFactor: 1, mobile: false })
  assert.equal(await js("document.querySelector('dialog').getBoundingClientRect().width <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1"), true, 'Truck form stays within a narrow viewport')
  await writeFile(`${directory}/truck-form-320.png`, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await fill('dialog input', 'NCR 7812')
  await click('Cancel')
  await until(`document.body.innerText.includes('Discard your unsaved truck details?')`)
  await click('Keep editing')
  await js("window.ratesFleetFixture.mode = 'validation'")
  await js("document.querySelector('dialog form').requestSubmit()")
  await until(`document.body.innerText.includes('This plate is already registered.')`)
  assert.equal(await js("document.querySelector('dialog input').value"), 'NCR 7812')
  await js("window.ratesFleetFixture.mode = 'normal'; document.querySelector('dialog form').requestSubmit()")
  await until(`!document.querySelector('dialog[open]') && document.body.innerText.includes('NCR 7812')`)
  assert.equal(await js("window.ratesFleetFixture.writes.at(-1).body.max_parcels"), 100)
  await js("(() => { const control = [...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Edit')); control.focus(); control.click() })()")
  await until(`document.querySelector('dialog[open]')`)
  await fill('dialog input', 'NDR 4828')
  await js("document.querySelector('dialog form').requestSubmit()")
  await until(`!document.querySelector('dialog[open]') && document.body.innerText.includes('NDR 4828')`)
  assert.equal(await js("window.ratesFleetFixture.writes.at(-1).body.expected_revision"), 4)
  assert.equal(await js("document.activeElement.textContent.trim().startsWith('Edit')"), true, 'Edit dialog restores focus after save')
  await js("(() => { const control = [...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('Deactivate')); control.focus(); control.click() })()")
  await until(`document.querySelector('dialog[open]')`)
  await key('Escape', 'Escape', 27)
  await until(`!document.querySelector('dialog[open]')`)
  assert.equal(await js("document.activeElement.textContent.trim().startsWith('Deactivate')"), true)
  await js("document.querySelector('tbody input[type=checkbox]').click()")
  await until(`window.ratesFleetFixture.writes.at(-1)?.path.includes('/drivers/')`)
  assert.equal(await js("window.ratesFleetFixture.writes.at(-1).body.expected_revision"), 3)
  for (const route of ['/fleet', '/vehicles', '/courier-applications', '/shipping-rates?view=rate-cards']) {
    await navigate(route)
    await js("window.ratesFleetFixture.mode = 'error'")
    await click('Refresh')
    await until(`document.querySelector('[role=alert]')`)
    assert.equal(await js("document.body.innerText.includes('No company trucks registered') || document.body.innerText.includes('No pending applications') || document.body.innerText.includes('No rate cards yet')"), false, 'Failure is not empty')
    await js("window.ratesFleetFixture.mode = 'empty'")
    await click(route === '/fleet' ? 'Refresh fleet' : 'Try again')
    const emptyTitle = route === '/fleet' ? 'No company trucks registered' : route === '/vehicles' ? 'No approved Courier vehicles yet' : route === '/courier-applications' ? 'No pending applications' : 'No rate cards yet'
    await until(`!document.querySelector('.portal-skeleton') && !document.querySelector('[role=alert]') && document.body.innerText.includes(${JSON.stringify(emptyTitle)})`)
  }
  assert.deepEqual(errors, [])
  await writeFile(`${directory}/verification.json`, JSON.stringify({ viewportThemeRoutes: 60, rateRuleModalStates: 12, errors, checks: ['rate-rule layout, tooltips, action states, add/edit and validation', 'deep links', 'legacy rules', 'future-effective state', 'unknown version', 'tabs keyboard', 'list back filters', 'truck create/edit and validation preservation', 'revision payloads', 'discard confirmation', 'Escape and focus restoration', 'driver capability', 'error/empty recovery'] }, null, 2))
  console.log('Rates/fleet browser checks passed: 60 viewport/theme/route combinations, 12 rate-rule modal states and workflow/state checks.')
} finally {
  await cdp('Page.close').catch(() => undefined)
  socket.close()
}
