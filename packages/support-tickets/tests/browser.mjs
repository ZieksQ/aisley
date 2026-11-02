import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const origin = 'http://127.0.0.1:15188'
const target = await (await fetch('http://127.0.0.1:19348/json/new?about:blank', { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let serial = 0
const pending = new Map()
const errors = []
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  if (message.method === 'Page.javascriptDialogOpening') void cdp('Page.handleJavaScriptDialog', { accept: false })
  const call = pending.get(message.id)
  if (call) { pending.delete(message.id); clearTimeout(call.timer); if (message.error) call.reject(message.error); else call.resolve(message.result) }
})
function cdp(method, params = {}) { return new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => reject(new Error(method)), 20000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })) }) }
async function js(expression) { const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
async function until(expression) { for (let i = 0; i < 100; i++) { if (await js(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)) } throw new Error(`Timeout: ${expression}: ${await js('document.body.innerText')} ${errors}`) }
async function click(text) { await js(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`); await new Promise(resolve => setTimeout(resolve, 100)) }
async function fill(selector, value) { await js(`(() => {const n = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(n, ${JSON.stringify(value)}); n.dispatchEvent(new Event('input', {bubbles:true}));})()`); await new Promise(resolve => setTimeout(resolve, 100)) }
const shots = 'node_modules/.cache/support-tickets'
await mkdir(shots, { recursive: true })
try {
  await cdp('Page.enable'); await cdp('Runtime.enable')
  for (const role of ['customer', 'seller', 'logistics', 'admin']) {
    for (const theme of role === 'customer' ? ['light'] : ['light', 'dark']) {
      for (const width of [320, 390, 768, 1440, 1800]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
        await cdp('Page.navigate', { url: `${origin}/support-fixture?role=${role}` })
        await until('!!document.querySelector(".support-ticket-list-item, .admin-ticket-detail")')
        await js(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`)
        if (role !== 'admin') { await js('document.querySelector(".support-ticket-list-item").click()'); await until('!!document.querySelector("#ticket-reply")') }
        await until('!!document.querySelector(".ticket-bubble")')
        await new Promise(resolve => setTimeout(resolve, 150))
        const metrics = await js(`(() => {const h = document.querySelector('.ticket-history'); const f = document.querySelector('#ticket-reply, #admin-ticket-reply'); const r = f.getBoundingClientRect(); return {width:innerWidth,page:document.documentElement.scrollWidth,scroll:h.scrollHeight > h.clientHeight, composer:r.bottom <= innerHeight,plain:document.querySelector('.ticket-bubble p').textContent.includes('<script>')};})()`)
        assert.ok(metrics.page <= width + 1, `${role} ${width} overflow ${JSON.stringify(metrics)}`)
        assert.ok(metrics.scroll, `${role} history scrolls`)
        assert.ok(metrics.composer, `${role} composer visible ${width}`)
        assert.ok(metrics.plain, 'Ticket text is rendered safely')
        const shot = await cdp('Page.captureScreenshot', { format: 'png' })
        await writeFile(`${shots}/${role}-${theme}-${width}.png`, Buffer.from(shot.data, 'base64'))
      }
    }
  }
  await cdp('Page.navigate', { url: `${origin}/support-fixture?role=seller` })
  await until('!!document.querySelector(".support-ticket-list-item")')
  await js('document.querySelector(".support-ticket-list-item").click()'); await until('!!document.querySelector("#ticket-reply")')
  await fill('#ticket-reply', 'Preserve this reply')
  await js('document.querySelectorAll(".support-ticket-list-item")[1].click()')
  assert.equal(await js('document.querySelector("#ticket-reply").value'), 'Preserve this reply')
  await click('Send reply'); await until('document.body.innerText.includes("Retry reply")')
  assert.equal(await js('document.querySelector("#ticket-reply").disabled'), true)
  await click('Retry reply'); await until('window.attempts?.length === 2 && document.querySelector("#ticket-reply").value === ""')
  assert.deepEqual(await js('window.attempts[0]'), await js('window.attempts[1]'), 'Uncertain retry preserves key, body and revision')
  await js(`document.querySelector('.ticket-history').scrollTop = 100`)
  const before = await js('document.querySelector(".ticket-history").scrollTop')
  await click('Older history')
  await until('document.body.innerText.includes("October 29, 2026")')
  assert.ok(await js('document.querySelector(".ticket-history").scrollTop') > before, 'Older history preserves reading position')
  await js(`document.querySelector('.ticket-history').scrollTop = 100; window.fixture.detail.events.push({...window.fixture.detail.events[0], id:'new-event', sequence:100, created_at:'2026-10-31T10:00:00Z'}); window.dispatchEvent(new Event('focus'))`)
  await until('!!document.querySelector(".ticket-history-latest")')
  assert.ok(await js('document.querySelector(".ticket-history").scrollTop < document.querySelector(".ticket-history").scrollHeight - document.querySelector(".ticket-history").clientHeight - 72'), 'New activity does not pull the reader down')
  await click('New activity · Latest')
  await until('!document.querySelector(".ticket-history-latest")')
  await cdp('Page.navigate', { url: `${origin}/support-fixture?role=admin&readonly` })
  await until('document.body.innerText.includes("view-only")')
  assert.equal(await js('!!document.querySelector("#admin-ticket-reply, .admin-ticket-management")'), false)
  assert.deepEqual(errors, [])
  console.log('PASS: four role variants; responsive light/dark, plain text, composer visibility, draft guard, exact retry and history anchoring.')
} finally { await fetch(`http://127.0.0.1:19348/json/close/${target.id}`); socket.close() }
