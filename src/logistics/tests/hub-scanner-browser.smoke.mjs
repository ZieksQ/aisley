// Run from the repository root. Uses isolated Chromium, synthetic API responses and real raster camera frames.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const out = resolve(root, 'node_modules/.cache/logistics-redesign/screenshots')
mkdirSync(out, { recursive: true })
const temp = resolve(root, '.tmp')
mkdirSync(temp, { recursive: true })
const profile = resolve(root, 'node_modules/.cache/logistics-redesign/camera-profile')
rmSync(profile, { recursive: true, force: true })
const browser = spawn(process.env.CHROMIUM_BINARY ?? '/opt/brave.com/brave/brave', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-breakpad',
  '--disable-crash-reporter', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
  `--crash-dumps-dir=${out}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], env: { ...process.env, TMPDIR: temp } })
let id = 0, buffer = '', diagnostics = ''
const browserErrors = []
const pending = new Map()
browser.stderr.on('data', (data) => { diagnostics += data })
for (const pipe of [browser.stdio[3], browser.stdio[4]]) pipe.on('error', (error) => { diagnostics += `${error.message}\n` })
browser.on('error', (error) => { diagnostics += `${error.message}\n` })
browser.on('exit', (code, signal) => { for (const r of pending.values()) { clearTimeout(r.timer); r.reject(Error(`Browser exited ${code}/${signal}: ${diagnostics.slice(-1500)}`)) } })
browser.stdio[4].on('data', (data) => {
  buffer += data
  let end
  while ((end = buffer.indexOf('\0')) !== -1) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1)
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.id && pending.has(message.id)) { const r = pending.get(message.id); pending.delete(message.id); clearTimeout(r.timer); if (message.error) r.reject(Error(JSON.stringify(message.error))); else r.resolve(message.result) }
  }
})
function send(method, params = {}, sessionId) {
  return new Promise((yes, no) => { const next = ++id; const timer = setTimeout(() => { pending.delete(next); no(Error(`${method} timed out: ${diagnostics.slice(-1000)}`)) }, 20000); pending.set(next, { resolve: yes, reject: no, timer }); browser.stdio[3].write(JSON.stringify({ id: next, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0') })
}
function installFixtures() {
  const original = window.fetch.bind(window)
  const at = '2026-10-23T01:00:00Z'
  const lane = {
    id: 'lane-1', code: 'LANE-01', name: 'Local delivery', type: 'standard',
    is_active: true, position: 1, revision: 2, operational_state: 'open',
    blocking_reason: null, label_url: null, label_payload: '',
  }
  const context = { organization_id: 'org-1', hub_id: 'hub-1', hub_name: 'Cebu Main Hub' }
  const user = {
    id: 'logistics-1', email: 'ops@example.test', role: 'logistics', status: 'active',
    profile: { first_name: 'Avery', last_name: 'Reyes' },
    organization: { id: 'org-1', business_name: 'Cebu Distribution', hub: { id: 'hub-1', name: 'Cebu Main Hub' } },
  }
  const plan = { id: 'plan-1', name: 'Cebu daily sort' }
  const references = ['AWB-QR123456', 'AWB-BAR123456', 'AWB-RAW123456']
  const session = {
    id: 'camera-session', reference: 'SCAN-SESSION', status: 'open',
    opened_at: at, expected_count: references.length, revision: 1,
    counts: { pending: references.length, sorted: 0, exception: 0 },
    items: references.map((reference) => ({
      id: reference, shipment_id: reference, reference, tracking_id: reference,
      order_reference: 'ORDER-' + reference, status: 'pending',
      expected_revision: 1, shipment_revision: 1, lane_id: null,
      sorting_assignment: null, destination: { postal_code: '6000' }, route: null,
      automatic_routing: { lane, reason: 'matched', postal_code: '6000' },
    })),
  }
  const json = (data) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  window.reviewFixture = { writes: [] }
  window.fetch = async (url, options = {}) => {
    const path = new URL(url, location.origin).pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url, options)
    if (path.endsWith('/csrf-cookie')) return new Response(null, { status: 204 })
    if (options.method && options.method !== 'GET') {
      window.reviewFixture.writes.push({ path, method: options.method })
      return json({ data: {} })
    }
    if (path.endsWith('/auth/me')) return json({ logistics: user })
    if (path.endsWith('/policy-consent/status')) return json({ data: { all_required_accepted: true, policies: [] } })
    if (path.endsWith('/chat-notifications')) return json({ data: [], meta: { unread_count: 0 } })
    if (path.endsWith('/notifications/unread-count')) return json({ data: { unread_count: 0 } })
    if (path.endsWith('/sorting/exceptions')) return json({ data: [], total: 0, current_page: 1, last_page: 1 })
    if (path.endsWith('/sorting')) return json({ data: {
      context, session, lanes: [lane], waiting_received: 0, session_limit: 100,
      automatic_sorting: { enabled: true, active_plan: plan, exception_lane: null },
    } })
    return json({ data: [], meta: { unread_count: 0 } })
  }
}

const require = createRequire(resolve(root, 'src/logistics/package.json'))
const { QRCodeWriter, BarcodeFormat } = require('@zxing/library')
function qrSvg(payload) {
  const qr = new QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, 41, 41, new Map())
  let cells = ''
  for (let y = 0; y < qr.getHeight(); y++) for (let x = 0; x < qr.getWidth(); x++) if (qr.get(x,y)) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="white"/><g transform="translate(156 76) scale(8)">${cells}</g></svg>`
}
const php = String.raw`require 'src/api/vendor/autoload.php'; echo (new Picqer\Barcode\BarcodeGeneratorSVG)->getBarcode($argv[1], Picqer\Barcode\BarcodeGeneratorSVG::TYPE_CODE_128, 2, 96);`
const barSvg = execFileSync('php', ['-r', php, 'AWB-BAR123456'], { encoding: 'utf8' })
const frames = { qr: qrSvg('AISLEY:WB:1:AWB-QR123456'), raw: qrSvg('AWB-RAW123456'), barcode: barSvg }
function installCamera(frames) {
  let image = new Image()
  window.showScanFrame = async (name) => { image = new Image(); image.src = 'data:image/svg+xml;base64,' + btoa(frames[name]); await image.decode() }
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 720
    const ctx = canvas.getContext('2d')
    const draw = () => { ctx.fillStyle='white'; ctx.fillRect(0,0,960,720); if (image.complete && image.naturalWidth) ctx.drawImage(image, (960-image.naturalWidth)/2, (720-image.naturalHeight)/2) }
    draw()
    const stream = canvas.captureStream(10)
    const timer = setInterval(draw,100)
    const track = stream.getVideoTracks()[0], stop = track.stop.bind(track)
    track.stop = () => { clearInterval(timer); stop() }
    window.testScanStream = stream
    return stream
  }
}
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const cdp = (method, params = {}) => send(method, params, sessionId)
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  async function until(expression) {
    for(let i=0;i<150;i++) { if(await evaluate(`Boolean(${expression})`)) return; await new Promise(r=>setTimeout(r,100)) }
    throw Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`)
  }
  async function key(key,code,windowsVirtualKeyCode) { await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode}); await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode}) }
  await cdp('Page.enable'); await cdp('Runtime.enable')
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installFixtures.toString()})(); (${installCamera.toString()})(${JSON.stringify(frames)});` })
  console.log('Browser and synthetic camera fixtures ready')
  for(const path of ['/receive-at-hub','/sorting']) {
    await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:560,deviceScaleFactor:1,mobile:true})
    await cdp('Page.navigate',{url:(process.env.HUB_ORIGIN ?? 'http://127.0.0.1:15176')+path})
    console.log('Opening', path)
    await until(`document.querySelector('button[aria-label="Full screen scanner"]')`)
    await evaluate(`Object.defineProperty(navigator,'onLine',{value:false,configurable:true}); window.dispatchEvent(new Event('offline')); document.querySelector('button[aria-label="Full screen scanner"]').click()`)
    await until('document.querySelector(".portal-scanner-expanded")')
    assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Exit full screen scanner')
    const refs={qr:'AWB-QR123456',barcode:'AWB-BAR123456',raw:'AWB-RAW123456'}
    await evaluate(`window.showScanFrame('qr'); Array.from(document.querySelectorAll('.portal-scanner-expanded button')).find(b=>b.textContent.trim()==='Start camera').click()`)
    for(const [name,reference] of Object.entries(refs)) {
      await evaluate(`window.showScanFrame(${JSON.stringify(name)})`)
      await until(`document.querySelector('.portal-scanner-feedback')?.innerText.includes(${JSON.stringify(reference)}) && document.querySelector('.portal-scanner-feedback')?.innerText.includes('Pending verification') && !document.querySelector('.portal-scanner-error')`)
      assert.equal(await evaluate('window.testScanStream.active'),true,'camera stays mounted and active in fullscreen')
      const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
      writeFileSync(resolve(out, `camera-${path.slice(1)}-${name}.png`), Buffer.from(screenshot.data, 'base64'))
      console.log(path,name,'captured with fullscreen notification')
    }
    assert.equal(await evaluate('window.reviewFixture.writes.length'),0,'offline scan cannot commit custody')
    await evaluate(`Array.from(document.querySelectorAll('.portal-scanner-expanded button')).find(b=>b.textContent.trim()==='Stop camera').click()`)
    await until('window.testScanStream.getVideoTracks().every(t=>t.readyState === "ended")')
    await key('Escape','Escape',27)
    await until('!document.querySelector(".portal-scanner-expanded")')
    assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Full screen scanner')
    assert.equal(await evaluate('document.body.style.overflow'),'')
    console.log(path,'Escape, focus restore and stopped media tracks passed')
  }
  assert.deepEqual(browserErrors, [], 'No runtime errors')
  console.log('Real browser camera frames: Code 128, waybill QR and tracking-only QR pass on both full-screen scanners.')
} finally { browser.kill() }
