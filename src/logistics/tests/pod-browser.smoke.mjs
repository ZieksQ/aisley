// Run from the repository root with an isolated fixture API, Logistics Vite server, and headless Chromium CDP.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { installPodFixtures } from './pod-browser.fixtures.mjs'
const origin = process.env.POD_ORIGIN ?? 'http://127.0.0.1:15176'
const api = process.env.POD_API ?? 'http://127.0.0.1:15800'
const targets = await (await fetch('http://127.0.0.1:19226/json')).json()
const socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let serial = 0
const pending = new Map()
const exceptions = []
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.method === 'Page.javascriptDialogOpening') void cdp('Page.handleJavaScriptDialog', { accept: true })
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
  if (!message.id) return
  const entry = pending.get(message.id)
  if (!entry) return
  pending.delete(message.id)
  clearTimeout(entry.timer)
  if (message.error) entry.reject(message.error)
  else entry.resolve(message.result)
})
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
  })
}
async function js(expression) {
  const response = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
  return response.result.value
}
async function until(expression) {
  for (let i = 0; i < 160; i++) {
    if (await js(`Boolean(document.body) && Boolean(${expression})`)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${expression}; ${await js('document.body?.innerText')}`)
}
const button = (text) => `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)})`
async function click(text) { console.log('Click', text); await until(`(${button(text)}) && !${button(text)}.disabled`); assert.equal(await js(`Boolean(${button(text)} && !${button(text)}.disabled)`), true, `Enabled button ${text}`); await js(`${button(text)}.click()`) }
async function navigate(path) {
  const previous = await js('window.podNavigation')
  await cdp('Page.navigate', { url: origin + path + '?pod-smoke=' + crypto.randomUUID() })
  await until(`window.podNavigation && window.podNavigation !== ${JSON.stringify(previous)} && document.querySelector('main h2') && location.pathname === ${JSON.stringify(path)}`)
}
async function apiRead(path) {
  return js(`fetch(${JSON.stringify(api + path)}, {credentials:'include',headers:{Accept:'application/json'}}).then(async r => ({status:r.status,body:await r.json()}))`)
}
await cdp('Page.enable'); await cdp('Runtime.enable')
await cdp('Network.setCacheDisabled', { cacheDisabled: true })
await cdp('Network.setBypassServiceWorker', { bypass: true })
const navigationScript = await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.podNavigation=crypto.randomUUID()' })
const directory = 'src/api/storage/framework/testing/pod-browser-shots'
await mkdir(directory, { recursive: true })
async function screenshot(name) {
  const shot = await cdp('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${directory}/${name}.png`, Buffer.from(shot.data, 'base64'))
}
async function responsive(path, ready, openView) {
  for (const width of process.env.POD_SKIP_RESPONSIVE ? [1440] : [390, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    for (const theme of process.env.POD_SKIP_RESPONSIVE ? ['light'] : ['light', 'dark']) {
      console.log('Checking', path, openView ?? '', width, theme); await navigate(path)
      if (openView) await click(openView)
      await until(ready)
      await js(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`)
      const activeView = 'document.querySelector("main nav button[aria-current=page]")'
      if (await js(`Boolean(${activeView})`)) assert.notEqual(await js(`getComputedStyle(${activeView}).borderBottomColor`), 'rgba(0, 0, 0, 0)', `${path} current view is visible`)
      assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, `${path} overflow ${width}/${theme}`)
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      assert.equal(await js('document.activeElement !== document.body'), true, `${path} keyboard focus`)
      if (width === 390 || (width === 1440 && theme === 'dark')) await screenshot(`${path.split('/').at(-1)}-${openView?.toLowerCase().replaceAll(' ', '-') ?? 'main'}-${width}-${theme}`)
    }
  }
}
try {
 if (!process.env.POD_MOCK_ONLY) {
  await cdp('Page.navigate', { url: 'about:blank' })
  await cdp('Network.clearBrowserCookies')
  await cdp('Page.navigate', { url: origin + '/login' })
  await until('document.body.innerText.includes("Sign in")')
  const login = await js(`(async () => {
    await fetch(${JSON.stringify(api + '/sanctum/csrf-cookie')}, {credentials:'include',headers:{Accept:'application/json'}});
    const xsrf = decodeURIComponent(document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='))?.split('=').slice(1).join('=') ?? '');
    const r = await fetch(${JSON.stringify(api + '/api/v1/logistics/auth/login')}, {method:'POST',credentials:'include',headers:{Accept:'application/json','Content-Type':'application/json','X-XSRF-TOKEN':xsrf},body:JSON.stringify({email:'pod-logistics@example.test',password:'Pod-test-password-123!',remember:false})});
    return {status:r.status, ok:r.ok};
  })()`)
  assert.equal(login.status, 200, 'Real Logistics session login')
  assert.equal((await apiRead('/api/v1/logistics/auth/me')).status, 200, 'Authenticated session is usable')
  await responsive('/delivery-confirmations', 'document.querySelector("img[alt^=\\\"Delivery proof\\\"]")')
  assert.equal(await js(`${button('Approve delivery')}.disabled`), true, 'COD approval requires acknowledgment')
  await js('document.querySelector("button[aria-label=\\\"Enlarge proof photo\\\"]").click()')
  assert.equal(await js('document.querySelector("dialog").open'), true)
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await until('!document.querySelector("dialog").open')
  const fixture = JSON.parse(await readFile('src/api/storage/framework/testing/pod-browser.json', 'utf8'))
  await js(`(() => { const input=document.querySelector('#correction-reason'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Show the parcel at the destination.'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`)
  await click('Request correction')
  await until('document.body.innerText.includes("Correction requested for")')
  await click('History'); await until('document.body.innerText.includes("Show the parcel at the destination.")')
  // Courier requests use only its scoped bearer token, without the Logistics session cookies.
  const loginResponse = await fetch(api + '/api/v1/courier/auth/login', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'pod-courier@example.test', password: 'Pod-test-password-123!', device_name: 'pod-browser-test' }) })
  assert.equal(loginResponse.status, 200)
  const token = (await loginResponse.json()).token
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  const completion = await (await fetch(api + `/api/v1/courier/tasks/${fixture.task_id}/completion`, { headers })).json()
  assert.equal(completion.data.completion_status, 'rejected')
  assert.equal(completion.data.rejection_reason, 'Show the parcel at the destination.')
  const photo = await fetch(api + `/api/v1/courier/delivery-proofs/${fixture.proof_id}/photo`, { headers })
  assert.equal(photo.status, 200)
  const form = new FormData(); form.set('photo', new Blob([await photo.arrayBuffer()], { type: 'image/jpeg' }), 'new-proof.jpg'); form.set('expected_revision', String(completion.data.revision))
  const uploaded = await fetch(api + `/api/v1/courier/tasks/${fixture.task_id}/proof-of-delivery`, { method: 'POST', headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, body: form })
  assert.equal(uploaded.status, 202)
  const proofId = (await uploaded.json()).data.proof_id
  const submitted = await fetch(api + `/api/v1/courier/tasks/${fixture.task_id}/completion`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ expected_revision: completion.data.revision, evidence_id: proofId, confirmed: true, cod_collected: true }) })
  assert.equal(submitted.status, 202)
  await navigate('/delivery-confirmations'); await until('document.querySelector("img[alt^=\\\"Delivery proof\\\"]")')
  await js('document.querySelector("section[aria-label=\\\"POD review\\\"] input[type=checkbox]").click()')
  await click('Approve delivery'); await until('document.body.innerText.includes("approved.")')
  const confirmed = await (await fetch(api + `/api/v1/courier/tasks/${fixture.task_id}/completion`, { headers })).json()
  assert.equal(confirmed.data.task_status, 'delivered')
  const cash = await apiRead('/api/v1/logistics/finance/courier-cash')
  assert.equal(cash.status, 200); assert.equal(cash.body.balances[0].outstanding_cents, 10000)
  await responsive('/finance/courier-cash', 'document.querySelector("table")')
  await js('document.querySelector("table input[type=checkbox]").click()')
  await click('Record cash received'); await until('document.body.innerText.includes("Cash receipt recorded.")')
  const receipts = await apiRead('/api/v1/logistics/finance/courier-cash/receipts')
  assert.equal(receipts.body.data.length, 1); assert.equal(receipts.body.data[0].total_cents, 10000)
  assert.equal(receipts.body.data[0].simulation_credit, 'credited')
  const invoices = await apiRead('/api/v1/logistics/finance/invoices')
  assert.equal(invoices.body.data[0].status, 'outstanding', 'Courier cash receipt does not clear platform invoice')
  await responsive('/finance/courier-cash', 'document.body.innerText.includes("Cash received")', 'Receipt history')
  await responsive('/delivery-confirmations', 'document.body.innerText.includes("Reviewed by")', 'History')
  await responsive('/delivery-confirmations', 'document.body.innerText.includes("Prepaid deliveries")', 'Approval settings')
  await responsive('/finance/billing', 'document.querySelector("section[aria-label=\\\"Current payment method\\\"]")')
  const billing = await apiRead('/api/v1/logistics/finance/billing')
  assert.match(billing.body.data.masked_identifier, /^••••\d{4}$/u)
  assert.equal('balance_cents' in billing.body.data, false)
  await navigate('/delivery-confirmations'); await click('Approval settings')
  await until('document.querySelector("section[aria-label=\\\"Approval settings\\\"] input")')
  await js('document.querySelector("section[aria-label=\\\"Approval settings\\\"] input").click()')
  await click('Save settings'); await until('document.body.innerText.includes("Approval settings saved.")')
  const settings = await apiRead('/api/v1/logistics/delivery-approval-settings')
  assert.equal(settings.body.data.mode, 'automatic')
  console.log('Connected POD correction/resubmission/approval, Courier bearer reads, COD cash receipt, invoice separation, masked Billing, settings, and responsive theme/keyboard checks passed.')
 }
 if (!process.env.POD_LIVE_ONLY) {
 const fixtureScript = await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installPodFixtures.toString()})()` })
 try {
  await navigate('/delivery-confirmations')
  await until('document.querySelector("section[aria-label=\\\"Delivery review queue\\\"] button")')
  await js('document.querySelectorAll("section[aria-label=\\\"Delivery review queue\\\"] button")[1].click()')
  await until('document.querySelector("img[alt=\\\"Delivery proof for POD-2\\\"]")?.naturalWidth === 17')
  await new Promise((resolve) => setTimeout(resolve, 2200))
  assert.equal(await js('document.querySelector("img[alt=\\\"Delivery proof for POD-2\\\"]").naturalWidth'), 17, 'Late photo cannot replace the selected proof')
  await js('window.podFixture.mode="photo-error";document.querySelectorAll("section[aria-label=\\\"Delivery review queue\\\"] button")[0].click()')
  await until('document.body.innerText.includes("Private photo unavailable.")')
  assert.equal(await js(`${button('Approve delivery')}.disabled`), true)
  await js('window.podFixture.mode="normal"')
  await click('Try again'); await until('document.querySelector("img")?.naturalWidth === 13')
  await js(`(() => {const input=document.querySelector('#correction-reason');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Show the parcel clearly.');input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  await click('Request correction'); await until('document.body.innerText.includes("The decision result is uncertain.")')
  assert.equal(await js(`${button('History')}.disabled`), true)
  await click('Retry same action'); await until('document.body.innerText.includes("Correction requested for POD-1.")')
  assert.deepEqual(await js('window.podFixture.writes[0]'), await js('window.podFixture.writes[1]'), 'POD retry preserves reason, revision, and key')
  await click('History'); await until('document.body.innerText.includes("Show the parcel clearly.")')
  await click('Pending')
  await js('window.podFixture.mode="loading"'); await click('Refresh'); await until('document.body.innerText.includes("Loading delivery reviews")')
  await js('window.podFixture.mode="empty"')
  await until('document.body.innerText.includes("No deliveries are waiting for review.")')
  await js('window.podFixture.mode="error"'); await click('Refresh'); await until('document.body.innerText.includes("Service temporarily unavailable.")')
  await js('window.podFixture.mode="normal"'); await click('Try again'); await until('document.body.innerText.includes("POD-2")')
  await click('Approval settings'); await until('document.querySelector("#correction-reason") === null && document.body.innerText.includes("Prepaid deliveries")')
  for (const width of [390, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    for (const theme of ['light', 'dark']) {
      await js(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`)
      assert.equal(await js('document.documentElement.scrollWidth <= innerWidth + 1'), true, `Settings overflow ${width}/${theme}`)
    }
  }
  await navigate('/finance/courier-cash'); await until('document.querySelector("table input")')
  await js('document.querySelector("table input").click()'); await click('Record cash received')
  await until('document.body.innerText.includes("The receipt result is uncertain.")')
  assert.equal(await js(`${button('Receipt history')}.disabled`), true)
  await js('window.podFixture.collected=true'); await click('Refresh'); await until('document.body.innerText.includes("No unremitted COD cash")')
  assert.equal(await js('document.body.innerText.includes("1 Orders selected")'), true, 'Original selection remains visible after uncertain receipt refresh')
  await click('Retry same receipt'); await until('document.body.innerText.includes("Cash receipt recorded.")')
  assert.deepEqual(await js('window.podFixture.writes[0]'), await js('window.podFixture.writes[1]'), 'Cash retry preserves selection and receipt key')
  await click('Receipt history'); await until('document.body.innerText.includes("View receipt and Orders")')
  await js('document.querySelector("details summary").click()')
  assert.equal(await js('document.querySelector("details").open'), true)
  await js('window.podFixture.mode="error"'); await click('Refresh'); await until('document.body.innerText.includes("Service temporarily unavailable.")')
  await js('window.podFixture.mode="empty"'); await click('Try again'); await until('document.body.innerText.includes("No Courier cash receipts yet.")')
  await navigate('/finance/billing'); await until('document.body.innerText.includes("••••1234")')
  assert.equal(await js('document.body.innerText.includes("balance")'), false)
  await js('sessionStorage.setItem("pod-mode","error")')
  await navigate('/finance/billing'); await until('document.body.innerText.includes("Service temporarily unavailable.")')
  await js('sessionStorage.removeItem("pod-mode");window.podFixture.mode="normal"'); await click('Try again'); await until('document.body.innerText.includes("••••1234")')
  await js('sessionStorage.setItem("pod-mode","loading")')
  await navigate('/finance/billing'); await until('document.body.innerText.includes("Loading payment method")')
  await js('sessionStorage.removeItem("pod-mode");window.podFixture.mode="normal"'); await until('document.body.innerText.includes("••••1234")')
  await responsive('/delivery-confirmations', 'document.querySelector("img")')
  await responsive('/delivery-confirmations', 'document.body.innerText.includes("No delivery review history yet.")', 'History')
  await responsive('/delivery-confirmations', 'document.body.innerText.includes("Prepaid deliveries")', 'Approval settings')
  await responsive('/finance/courier-cash', 'document.querySelector("table")')
  await responsive('/finance/courier-cash', 'document.body.innerText.includes("View receipt and Orders")', 'Receipt history')
  await responsive('/finance/billing', 'document.body.innerText.includes("••••1234")')
  console.log('Controlled browser checks passed: delayed private photos, photo retry, POD correction retry, cash retry/selection retention, loading/empty/error reads, receipt details, and responsive settings.')
 } finally { await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixtureScript.identifier }) }
 }
 assert.deepEqual(exceptions, [])
} finally { await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: navigationScript.identifier }); socket.close() }
