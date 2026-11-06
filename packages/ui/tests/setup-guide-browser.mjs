// Controlled real-app Chromium checks; no live API calls or business writes.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { openBrowser, pause } from './account-settings/browser.mjs'

function installGuideFixture(role) {
  const native = window.fetch.bind(window)
  const at = '2026-11-06T12:00:00Z'
  const state = window.guideFixture = {
    visit: crypto.randomUUID(), actorId: sessionStorage.getItem('guide-actor') ?? role,
    autoShow: sessionStorage.getItem('guide-new') !== 'false',
    error: sessionStorage.getItem('guide-error') === 'true', denied: false, complete: false, calls: [],
  }
  window.fetch = async (input, options = {}) => {
    const path = new URL(input, location.origin).pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return native(input, options)
    state.calls.push({ path, method: options.method ?? 'GET' })
    const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
    const actor = { id: state.actorId, email: 'mara@example.test', role, status: 'active', profile: { first_name: 'Mara', last_name: 'Santos' },
      shop: { id: 'shop', name: 'Everyday supplies', status: 'active', is_on_vacation: false },
      organization: { id: 'organization', business_name: 'Southbound Logistics', hub: { id: 'hub', name: 'San Pedro hub' } } }
    if (path.endsWith('/auth/me')) return json({ [role]: actor })
    if (path.endsWith('/policy-consent/status')) return json({ data: { all_required_accepted: true, policies: [] } })
    if (path.endsWith('/setup-guide')) {
      if (state.denied) return json({ code: 'POLICY_CONSENT_REQUIRED', message: 'Consent required.' }, 403)
      if (state.error) return json({ message: 'Setup unavailable.' }, 503)
      return json({ version: 1, tenant_id: role === 'seller' ? 'shop' : 'organization', auto_show: state.autoShow,
        automatic: role === 'seller' ? { product: state.complete ? 'complete' : 'incomplete', shipping: state.complete ? 'complete' : 'incomplete' } : { rates: state.complete ? 'complete' : 'incomplete' }, generated_at: at })
    }
    if (path.endsWith('/dashboard/queue')) return json({ data: [], summary: { total: 0, pending_evidence: 0, pending_completion: 0, by_status: {} }, meta: { current_page: 1, last_page: 1, total: 0 }, freshness: { generated_at: at, state: 'authoritative' } })
    if (path.endsWith('/dashboard')) {
      if (role === 'logistics') return json({ hub: { id: 'hub', name: 'San Pedro hub', address: { barangay: 'Poblacion', city_municipality: 'San Pedro', province: 'Laguna', region: 'CALABARZON' } }, summary: null, orders: [], freshness: { generated_at: at, state: 'scaffold' } })
      const unavailable = { state: 'unavailable', reason: 'DOMAIN_NOT_IMPLEMENTED' }
      return json({ version: 1, code: null, shop: actor.shop, generated_at: at, period: { from: null, to: null, timezone: 'UTC' }, actions: [], sections: {
        catalog: { state: 'empty', metrics: { total: 0, active: 0, draft: 0, archived: 0, zero_stock_products: 0, zero_stock_skus: 0 }, stock_signal: 'catalog_quantity' },
        order_activity: { state: 'empty', metrics: { awaiting_approval: 0, processing: 0, ready_for_pickup: 0, delivered: 0 }, by_status: {}, daily_placed: [], timezone: 'UTC', from: '2026-10-23', to: '2026-11-05' },
        reviews: { state: 'empty', metrics: { total: 0, answered: 0, unanswered: 0 }, cohort: 'published_at' },
        financial: unavailable, orders: unavailable, inventory: unavailable, traffic: unavailable, notifications: unavailable,
      } })
    }
    return json({ data: [], unread_count: 0, meta: { total: 0, last_page: 1, unread_count: 0 } })
  }
}

const artifacts = 'node_modules/.cache/setup-guide'
mkdirSync(artifacts, { recursive: true })
const servers = []
let browser
let combinations = 0
async function start(role, port) {
  const proc = spawn(process.execPath, [`src/${role}/node_modules/vite/bin/vite.js`, 'preview', `src/${role}`, '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] })
  servers.push(proc)
  let output = ''
  proc.stderr.on('data', chunk => { output += chunk })
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) return } catch {}
    await pause(100)
  }
  throw new Error(`Server failed: ${output}`)
}
try {
  await Promise.all([start('seller', 15371), start('logistics', 15372)])
  browser = await openBrowser()
  for (const [role, port] of [['seller', 15371], ['logistics', 15372]]) {
    const page = await browser.page()
    const js = expression => page.evaluate(expression)
    const until = async expression => {
      for (let i = 0; i < 100; i++) { if (await js(`Boolean(${expression})`)) return; await pause(80) }
      throw new Error(`${role}: ${expression}\n${await js('document.body.innerText')}`)
    }
    const reload = async () => {
      const previous = await js('window.guideFixture.visit')
      await page.cdp('Page.reload')
      await until(`window.guideFixture?.visit && window.guideFixture.visit !== ${JSON.stringify(previous)}`)
    }
    await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installGuideFixture.toString()})('${role}')` })
    await page.cdp('Page.navigate', { url: `http://127.0.0.1:${port}/dashboard` })
    await until('document.querySelector(".setup-guide progress")')
    const click = async label => {
      await js(`[...document.querySelectorAll('.setup-guide button')].find(el => el.textContent.trim() === ${JSON.stringify(label)}).click()`)
      await pause(60)
    }
    for (const mode of ['light', 'dark']) {
      const themeKey = role === 'logistics' ? 'logistics-theme' : 'aisley-seller-theme'
      await js(`localStorage.setItem('${themeKey}','${mode}'); window.dispatchEvent(new StorageEvent('storage',{key:'${themeKey}'}))`)
      await until(`document.documentElement.classList.contains('dark') === ${mode === 'dark'}`)
      for (const width of [1440, 768, 390]) {
        await page.viewport(width)
        for (let index = 0; index < 6; index++) {
          await js(`document.querySelectorAll('.setup-guide-task')[${index}].click()`)
          assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true)
          // Detail and footer must never overlap at narrow desktop/tablet widths.
          assert.equal(await js(`(()=>{const a=document.querySelector('.setup-guide-detail').getBoundingClientRect();const b=document.querySelector('.setup-guide-footer').getBoundingClientRect();return a.bottom<=b.top})()`), true)
          assert.equal(await js('document.querySelectorAll(".setup-guide-detail").length'), 1)
          combinations++
        }
        const { data } = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
        writeFileSync(`${artifacts}/${role}-${mode}-${width}.png`, Buffer.from(data, 'base64'))
        if (width === 1440) {
          await js('document.querySelectorAll(".setup-guide-task")[0].click()')
          writeFileSync(`${artifacts}/${role}-${mode}.html`, await js(`(()=>{const root=document.documentElement.cloneNode(true);root.querySelectorAll('script').forEach(el=>el.remove());const base=document.createElement('base');base.href=location.origin;root.querySelector('head').prepend(base);return '<!doctype html>'+root.outerHTML})()`))
        }
      }
    }
    const paths = new Set()
    for (let index = 0; index < 6; index++) {
      await js(`document.querySelectorAll('.setup-guide-task')[${index}].click()`)
      const links = await js('[...document.querySelectorAll(".setup-guide-links a")].map(el => el.getAttribute("href"))')
      links.forEach(path => paths.add(path))
      assert.equal(await js('document.querySelector("progress").value'), 0, 'Opening lessons must not complete them')
    }
    // Mark a lesson, reload, hide/reopen, and reverse completion.
    await js('document.querySelectorAll(".setup-guide-task")[0].click()')
    await pause(50)
    await js('document.querySelector(".setup-guide-check input").click()')
    await until('document.querySelector("progress").value === 1')
    await reload()
    await until('document.querySelector("progress")?.value === 1')
    await click('Hide setup guide')
    await until('!document.querySelector("progress")')
    assert.equal(await js('document.activeElement.textContent.trim()'), 'Show setup guide')
    await reload()
    await until('document.querySelector(".setup-guide") && !document.querySelector("progress")')
    await click('Show setup guide')
    assert.equal(await js('document.activeElement.textContent'), 'Get started')
    await js('document.querySelector(".setup-guide-check input").click()')
    await until('document.querySelector("progress").value === 0')
    // Simulate business setup, then independently fail guide refresh.
    await js('window.guideFixture.complete = true')
    await click('Refresh setup checks')
    const automatic = role === 'seller' ? 2 : 1
    await until(`document.querySelector('progress').value === ${automatic}`)
    await js('window.guideFixture.error = true')
    await click('Refresh setup checks')
    await until('document.body.innerText.includes("Showing the last loaded progress")')
    assert.equal(await js('document.querySelector("progress").value'), automatic)
    await js('window.guideFixture.error = false')
    await click('Retry setup guide')
    await until('!document.body.innerText.includes("Showing the last loaded progress")')
    for (let index = 0; index < 6; index++) {
      await js(`document.querySelectorAll('.setup-guide-task')[${index}].click()`)
      await pause(50)
      await js("document.querySelector('.setup-guide-check input')?.click()")
    }
    await until('document.querySelector("progress").value === 6')
    assert.equal(await js('document.querySelector("progress").max'), 6)
    await until('document.body.innerText.includes("You’ve completed the guide")')
    await reload()
    await until('document.querySelector(".setup-guide") && !document.querySelector("progress")')
    // An existing different account defaults to opt-in and gets no previous lessons.
    await js(`sessionStorage.setItem('guide-actor','other-${role}');sessionStorage.setItem('guide-new','false')`)
    await reload()
    await until('document.querySelector(".setup-guide") && !document.querySelector("progress")')
    await click('Show setup guide')
    assert.equal(await js('document.querySelector("progress").value'), 0)
    // Blocked local storage retains in-memory interactions.
    await js('window.guideSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error("Storage blocked") }; document.querySelector(".setup-guide-check input").click()')
    await until('document.querySelector("progress").value === 1 && document.body.innerText.includes("saved for this visit")')
    await js('Storage.prototype.setItem = window.guideSetItem')
    // Native keyboard focus and reduced motion do not hide controls.
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await js('document.querySelector(".setup-guide-task").focus()')
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    assert.equal(await js('document.activeElement.classList.contains("setup-guide-task")'), true)
    assert.equal(await js('window.guideFixture.calls.some(call => call.method !== "GET")'), false)
    // Every guide target must be an implemented destination in its owning app.
    const routes = readFileSync(`src/${role}/src/App.tsx`, 'utf8')
    for (const path of paths) assert.ok(routes.includes(`path="${path}"`), `Missing ${role} route: ${path}`)
    // Initial failure offers Retry without removing the operational dashboard.
    await js("sessionStorage.setItem('guide-error','true')")
    await reload()
    await until('document.body.innerText.includes("The setup guide could not be loaded")')
    assert.equal(await js('!!document.querySelector(".dashboard-metric-grid")'), true)
    await js('window.guideFixture.error = false')
    await js('[...document.querySelectorAll("button")].find(el=>el.textContent==="Retry setup guide").click()')
    await until('document.querySelector(".setup-guide")')
    // Corrupt preferences fall back safely to the account’s opt-in state.
    await js(`sessionStorage.removeItem('guide-error');localStorage.setItem('aisley:setup-guide:${role}:other-${role}:${role === 'seller' ? 'shop' : 'organization'}:v1','{bad')`)
    await reload()
    await until('document.querySelector(".setup-guide") && !document.querySelector("progress")')
    await click('Show setup guide')
    assert.equal(await js('document.querySelector("progress").value'), 0)
    await page.close()
  }
  assert.deepEqual(browser.errors, [])
  if (process.env.GUIDE_INSPECT === '1') {
    for (const role of ['seller', 'logistics']) for (const mode of ['light', 'dark']) {
      const proc = spawn(process.execPath, [`${process.env.TASTE_SKILL_DIR ?? `${homedir()}/.agents/skills/design-taste-frontend`}/scripts/inspect.mjs`, `${artifacts}/${role}-${mode}.html`, '--app', '--allow', role === 'logistics' ? 'icon-chips,tiny-text' : 'icon-chips', '--out', `${artifacts}/inspect-${role}-${mode}`], { stdio: 'inherit' })
      const code = await new Promise(resolve => proc.once('exit', resolve))
      assert.equal(code, 0, `Taste inspection failed for ${role}/${mode}`)
    }
  }
  console.log(`Passed ${combinations} task/theme/viewport combinations plus persistence, completion, failure, navigation and isolation checks.`)
} finally {
  await browser?.close()
  servers.forEach(proc => proc.kill())
}
