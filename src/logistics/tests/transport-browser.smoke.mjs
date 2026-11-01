// Run from the repository root with an isolated Logistics preview and Chromium CDP.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { installTransportFixtures } from './transport-browser.fixtures.mjs'

const origin = process.env.LOGISTICS_UI_ORIGIN ?? 'http://127.0.0.1:5176'
const browser = process.env.LOGISTICS_UI_CDP ?? 'http://127.0.0.1:19349'
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
async function navigate(path) {
  console.log('Checking', path)
  const previous = await js('window.transportFixture?.navigation')
  await cdp('Page.navigate', { url: origin + path })
  await until(
    `window.transportFixture?.navigation !== ${JSON.stringify(previous)} && document.querySelector('.transport-workspace h1') && !document.querySelector('.portal-skeleton')`
  )
  await js(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  )
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Network.setBypassServiceWorker', { bypass: true })
await cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `(${installTransportFixtures.toString()})();`
})
const directory = 'src/logistics/node_modules/.cache/transport-browser'
await mkdir(directory, { recursive: true })
try {
  for (const width of [390, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false
    })
    for (const dark of [false, true]) {
      for (const path of [
        '/network',
        '/linehaul-dispatch',
        '/inbound-linehaul',
        '/inbound-linehaul?view=arriving',
        '/dispatch',
        '/delivery-confirmations',
        '/delivery-confirmations?view=history',
        '/delivery-confirmations/proof-1047?reference=ORD-1047'
      ]) {
        await navigate(path)
        await js(`document.documentElement.classList.toggle('dark', ${dark}); new Promise(resolve => setTimeout(resolve, 250))`)
        assert.equal(
          await js('document.documentElement.scrollWidth <= innerWidth + 1'),
          true,
          `No page overflow: ${path} ${width}/${dark}`
        )
        if (path === '/delivery-confirmations')
          assert.equal(
            await js('window.transportFixture.photos.length'),
            0,
            'List never fetches private proof photos'
          )
        if (width === 1440 || (width === 390 && !dark)) {
          const shot = await cdp('Page.captureScreenshot', { format: 'png' })
          await writeFile(
            `${directory}/${path.replaceAll(/[^a-z0-9]/gi, '_')}-${width}-${dark ? 'dark' : 'light'}.png`,
            Buffer.from(shot.data, 'base64')
          )
        }
      }
    }
  }
  await navigate('/linehaul')
  assert.equal(
    await js('location.pathname'),
    '/network',
    'Legacy Network link redirects'
  )
  assert.equal(
    await js('document.querySelectorAll("tbody tr").length'),
    2,
    'Both connected hubs visible independently of paginated directory'
  )
  assert.equal(
    await js('document.body.innerText.includes("Laguna Parcel Co.")'),
    false,
    'Unconnected directory hidden on main page'
  )
  await click('Request')
  await until('document.querySelector("dialog[open]")')
  assert.equal(
    await js(
      'document.activeElement === document.body || document.querySelector("dialog").contains(document.activeElement)'
    ),
    true
  )
  for (let i = 0; i < 9; i++) await key('Tab', 'Tab', 9)
  assert.equal(
    await js(
      'document.activeElement === document.body || document.querySelector("dialog").contains(document.activeElement)'
    ),
    true,
    'Request modal traps keyboard focus'
  )
  await key('Escape', 'Escape', 27)
  assert.equal(
    await js('document.activeElement.textContent.trim()'),
    'Request',
    'Request trigger regains focus'
  )
  await click('Request')
  await js(
    '[...document.querySelectorAll("dialog button")].find(b=>b.textContent.trim()==="Request").click()'
  )
  await until(
    'document.querySelector("dialog").innerText.includes("Request pending")'
  )
  assert.equal(
    await js('window.transportFixture.writes.at(-1).body.to_hub_id'),
    'delta'
  )
  await click('Withdraw request')
  await until('window.transportFixture.writes.at(-1).body.is_active === false')
  await click('Next')
  await until(
    'document.querySelector("dialog").innerText.includes("Rosa Freight")'
  )
  await key('Escape', 'Escape', 27)
  await click('Incoming requests (1)')
  await click('Accept')
  await until('document.querySelectorAll("tbody tr").length === 3')
  await key('Escape', 'Escape', 27)

  await navigate('/linehaul-dispatch')
  await js('document.querySelectorAll("input[type=checkbox]")[0].click()')
  await js('document.querySelector("#linehaul-truck").click()')
  await until('document.querySelector("dialog[open]")')
  await js(
    '[...document.querySelectorAll("dialog button")].find(b=>b.textContent.includes("NDR 4827")).click()'
  )
  await until('!document.querySelector("dialog[open]")')
  assert.equal(
    await js('document.querySelectorAll("input[type=checkbox]")[1].disabled'),
    true,
    'Truck capacity still gates selection'
  )

  await js('document.querySelector("#linehaul-driver").click()')
  await until('document.querySelector("dialog[open]")')
  await js('[...document.querySelectorAll("dialog button")].find(b=>b.textContent.includes("Rafael Mendoza")).click()')
  await click('Send request for 1 parcel')
  await until('window.transportFixture.writes.length > 0')
  assert.equal(await js('window.transportFixture.writes.at(-1).body.next_hub_id'), 'alpha')
  assert.equal(await js('window.transportFixture.writes.at(-1).body.shipment_ids.length'), 1)

  await navigate('/dispatch')
  await click('Select up to 15')
  await js('document.querySelector("#dispatch-courier").click()')
  await until('document.querySelector("dialog[open]")')
  await js('[...document.querySelectorAll("dialog button")].find(b=>b.textContent.includes("Rafael Mendoza")).click()')
  await click('Dispatch 2 parcels')
  await until('window.transportFixture.writes.length > 0')
  assert.equal(await js('window.transportFixture.writes.at(-1).body.courier_id'), 'driver-1')
  assert.equal(await js('window.transportFixture.writes.at(-1).body.shipment_ids.length'), 2)

  await navigate('/inbound-linehaul')
  await click('Reject')
  await fill('dialog textarea', 'Receiving bay closed for inspection.')
  await click('Reject transfer')
  await until('window.transportFixture.writes.length > 0')
  assert.equal(
    await js('window.transportFixture.writes.at(-1).body.expected_revision'),
    3
  )
  assert.equal(
    await js('window.transportFixture.writes.at(-1).body.accept'),
    false
  )

  await navigate('/delivery-confirmations?view=pending&search=ORD-1047&page=1')
  await js('document.querySelector("tbody tr td:nth-child(2)").click()')
  await until(
    'location.pathname.endsWith("proof-1047") && document.querySelector("img")'
  )
  await until(
    'Boolean(document.querySelector(".transport-review img"))'
  )
  assert.equal(
    await js(
      'document.querySelector(".transport-back").getAttribute("href").includes("search=ORD-1047")'
    ),
    true,
    'Back preserves list search'
  )
  assert.equal(
    await js(`${button('Approve delivery')}.disabled`),
    true,
    'COD needs explicit confirmation'
  )
  await js('document.querySelector("input[type=checkbox]").click()')
  await click('Approve delivery')
  await until('document.body.innerText.includes("Decision result uncertain")')
  await click('Retry same action')
  await until('document.body.innerText.includes("Delivery ORD-1047 approved")')
  assert.equal(
    await js(
      'window.transportFixture.writes[0].key === window.transportFixture.writes[1].key'
    ),
    true,
    'Uncertain retry preserves idempotency key'
  )
  await until('document.body.innerText.includes("Reviewed by")')

  await navigate('/delivery-confirmations/proof-missing?reference=ORD-1047')
  await until('document.body.innerText.includes("no longer in this view")')
  assert.equal(
    await js('window.transportFixture.photos.length'),
    0,
    'Unknown deep link never previews another proof'
  )
  for (const path of [
    '/network',
    '/inbound-linehaul',
    '/delivery-confirmations'
  ]) {
    await navigate(path)
    await js('window.transportFixture.mode="error"')
    await click('Refresh')
    await until('document.querySelector("[role=alert]")')
    await js('window.transportFixture.mode="empty"')
    await js(
      '[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Try again").click()'
    )
    await until('document.querySelector(".portal-state")')
  }
  assert.deepEqual(errors, [], 'No browser exceptions')
  console.log(
    'PASS: 48 responsive/theme route checks; network requests, modal focus, capacity, inbound rejection, confirmation routing, COD and idempotent retry, missing-proof safety, error and empty states.'
  )
} finally {
  socket.close()
}
