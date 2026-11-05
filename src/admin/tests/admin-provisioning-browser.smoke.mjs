// Synthetic HTTP contracts in real Chromium; no live accounts or mail are changed.
// Run from repository root with Admin Vite on 15175 and ChromeDriver on 19515.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const artifacts = resolve('node_modules/.cache/admin-provisioning-browser')
await mkdir(artifacts, { recursive: true })
const origin = process.env.ADMIN_PROVISIONING_ORIGIN ?? 'http://127.0.0.1:15175'
const driver = process.env.ADMIN_PROVISIONING_DRIVER ?? 'http://127.0.0.1:19515'
async function command(method, path, body) {
  const response = await fetch(`${driver}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const payload = await response.json()
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`)
  return payload.value
}
function fixture() {
  const original = window.fetch.bind(window)
  const mode = localStorage.getItem('admin-provisioning-mode') ?? 'manager'
  const catalog = ['admin-accounts.view', 'admin-accounts.create', 'admin-accounts.update', 'admin-accounts.suspend', 'admin-accounts.restore', 'admin-accounts.archive', 'finance.view', 'finance.manage', 'support-tickets.view'].map((slug) => ({ slug, name: slug === 'finance.manage' ? 'Manage finance' : slug === 'finance.view' ? 'View finance' : slug, description: `Allows ${slug}.` }))
  const admin = { id: 'manager', email: 'manager@example.com', role: 'admin', status: 'active', profile: { first_name: 'Platform', last_name: 'Administrator', profile_photo_url: null }, permissions: catalog.map((p) => p.slug), roles: [], is_super_admin: true, is_initial_admin: true, setup_required: mode === 'pending' || mode === 'email-only', password_change_required: mode === 'pending', email_verification_required: mode === 'pending' || mode === 'email-only' }
  const roles = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Finance viewer', permissions: ['finance.view'], revision: 1, member_count: 0 }]
  const accounts = [{ id: '22222222-2222-4222-8222-222222222222', email: 'existing@example.com', status: 'active', profile: { first_name: 'Existing', middle_name: null, last_name: 'Admin', contact_number: null }, is_super_admin: false, is_initial_admin: false, archived_at: null, setup_required: false, permissions: ['finance.view'], direct_permissions: [], roles: [roles[0]], revision: 0 }]
  const state = window.adminFixture = { admin, catalog, roles, accounts, writes: [], requests: [], readError: false, empty: false, codeFailure: false, consent: true, sessionLost: false }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin), path = parsed.pathname, method = options.method ?? 'GET'
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url, options)
    state.requests.push(path)
    const body = options.body ? JSON.parse(options.body) : {}
    if (method !== 'GET') state.writes.push({ path, method, body })
    if (path === '/sanctum/csrf-cookie') return json({})
    if (path.endsWith('/auth/me')) return state.sessionLost ? json({ message: 'Session expired.' }, 401) : json({ admin })
    if (path.endsWith('/auth/logout')) { state.sessionLost = true; return json({}) }
    if (path === '/api/v1/policy-consent/status') return json({ data: { all_required_accepted: state.consent, policies: [] } })
    if (path.endsWith('/auth/setup/code')) return json({ data: { challenge_id: '33333333-3333-4333-8333-333333333333', masked_email: 'm***@example.com', expires_at: new Date(Date.now() + 600000).toISOString(), resend_available_at: new Date(Date.now() + 60000).toISOString() } })
    if (path.endsWith('/auth/setup/complete')) {
      if (state.codeFailure) return json({ message: 'The verification code is incorrect.', errors: { verification_code: ['The verification code is incorrect.'] } }, 422)
      admin.setup_required = false; admin.password_change_required = false; admin.email_verification_required = false
      return json({ admin })
    }
    if (path === '/api/v1/admin/permissions') return json({ data: catalog })
    if (path === '/api/v1/admin/admin-roles' && method === 'GET') return json({ data: roles })
    if (path.startsWith('/api/v1/admin/admin-roles') && method !== 'GET') {
      const role = { id: '44444444-4444-4444-8444-444444444444', ...body, member_count: 0, revision: 1 }
      roles.push(role); return json({ data: role }, 201)
    }
    if (path === '/api/v1/admin/admin-accounts' && method === 'GET') {
      if (state.readError) return json({ message: 'Synthetic read failure. Try again.' }, 500)
      const rows = state.empty ? [] : accounts
      return json({ data: rows, meta: { current_page: 1, last_page: 1, total: rows.length } })
    }
    if (path === '/api/v1/admin/admin-accounts' && method === 'POST') {
      const account = { id: '55555555-5555-4555-8555-555555555555', email: body.email, profile: { first_name: body.first_name, middle_name: body.middle_name, last_name: body.last_name, contact_number: body.contact_number }, roles: roles.filter((r) => body.role_ids.includes(r.id)), permissions: [...new Set([...body.permissions, ...roles.filter((r) => body.role_ids.includes(r.id)).flatMap((r) => r.permissions)])], direct_permissions: body.permissions, is_super_admin: body.is_super_admin, is_initial_admin: false, archived_at: null, setup_required: true, status: 'active', revision: 0 }
      accounts.push(account); return json({ data: account }, 201)
    }
    if (path.startsWith('/api/v1/admin/admin-accounts/')) {
      const parts = path.split('/'), account = accounts.find((a) => a.id === parts[5])
      if (!account) return json({ message: 'Account not found.' }, 404)
      if (method === 'PATCH') { account.profile.first_name = body.first_name; account.revision++; return json({ data: account }) }
      if (method === 'POST') { const action = parts[6]; account.status = action === 'restore' ? 'active' : action === 'suspend' ? 'suspended' : 'deactivated'; account.archived_at = action === 'archive' ? new Date().toISOString() : null; account.revision++ }
      return json({ data: account })
    }
    if (path === '/api/v1/admin/dashboard') return json({ data: { registrations: null, support_tickets: null, seller_compliance: null, generated_at: new Date().toISOString() } })
    return json({ data: [], items: [] })
  }
}
const session = await command('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'chrome', 'goog:chromeOptions': { args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900', `--user-data-dir=${artifacts}/profile-${Date.now()}`] } } } })
const path = `/session/${session.sessionId}`
const js = (script, args = []) => command('POST', `${path}/execute/sync`, { script, args })
const cdp = (cmd, params = {}) => command('POST', `${path}/goog/cdp/execute`, { cmd, params })
const go = (route) => command('POST', `${path}/url`, { url: `${origin}${route}` })
async function until(script, label) {
  const end = Date.now() + 15000
  while (Date.now() < end) { if (await js(script)) return; await new Promise((done) => setTimeout(done, 100)) }
  throw new Error(`Timed out: ${label}`)
}
async function button(label) {
  const selector = await js(`return [...document.querySelectorAll('button')].findIndex(b => b.textContent.trim() === arguments[0])`, [label])
  assert.notEqual(selector, -1, `Missing button ${label}`)
  await js(`document.querySelectorAll('[data-browser-target]').forEach(e=>e.removeAttribute('data-browser-target')); document.querySelectorAll('button')[arguments[0]].setAttribute('data-browser-target','active')`, [selector])
  const element = await command('POST', `${path}/element`, { using: 'css selector', value: 'button[data-browser-target="active"]' })
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {})
}
async function fill(label, value) {
  const id = await js(`return [...document.querySelectorAll('label')].find(l => l.textContent.replace('*','').trim() === arguments[0])?.htmlFor`, [label])
  assert.ok(id, `Missing label ${label}`)
  const element = await command('POST', `${path}/element`, { using: 'css selector', value: `[id="${id}"]` })
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/clear`, {})
  await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: value })
}
let captures = 0
try {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixture.toString()})();` })
  await go('/admin-accounts')
  await until('return document.body.innerText.includes("existing@example.com")', 'account list')
  for (const route of ['/admin-accounts', '/admin-accounts/new', '/admin-roles']) {
    await go(route)
    await until('return !document.body.innerText.includes("Loading ") && !!document.querySelector("h1")', route)
    for (const theme of ['light', 'dark']) for (const width of [320, 390, 768, 1440]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 })
      await js('document.documentElement.classList.toggle("dark", arguments[0] === "dark")', [theme])
      await new Promise((done) => setTimeout(done, 250))
      assert.equal(await js('return document.documentElement.scrollWidth <= innerWidth + 2'), true, `${route} ${theme} overflow at ${width}`)
      if ([390, 1440].includes(width)) await writeFile(`${artifacts}/${route.split('/').filter(Boolean).join('-')}-${theme}-${width}.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'))
      captures++
    }
  }
  await go('/admin-roles'); await until('return document.body.innerText.includes("Finance viewer")', 'roles')
  await button('Create role'); await fill('Role name', 'Finance operator')
  await js(`const label = [...document.querySelectorAll('label')].find(l => l.textContent.includes('Manage finance')); label.querySelector('input').click()`)
  assert.equal(await js(`return [...document.querySelectorAll('label')].find(l => l.textContent.includes('View finance')).querySelector('input').checked`), true)
  await fill('Your current password', 'Manager123'); await button('Save role')
  await until('return document.body.innerText.includes("Role saved.")', 'role saved')
  assert.deepEqual(await js('return adminFixture.writes.at(-1).body.permissions'), ['finance.manage', 'finance.view'])
  await go('/admin-accounts/new'); await until('return !!document.querySelector("form") && document.body.innerText.includes("Temporary password")', 'creation form')
  for (const [label, value] of [['First name', 'New'], ['Middle name (optional)', 'River'], ['Last name', 'Admin'], ['Email address', 'new@example.com'], ['Temporary password', 'Temporary123'], ['Confirm temporary password', 'Temporary123'], ['Your current password', 'Manager123']]) await fill(label, value)
  await js(`document.querySelector('a[href="/admin-accounts"]').click()`)
  await until('return !!document.querySelector("dialog[open]")', 'unsaved confirmation')
  await button('Cancel')
  assert.equal(await js('return location.pathname'), '/admin-accounts/new')
  await js(`const label=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Finance viewer'); label.querySelector('input').click()`)
  assert.equal(await js(`return [...document.querySelectorAll('label')].find(l=>l.textContent.includes('View finance')).textContent.includes('from role')`), true)
  await button('Create Admin account')
  await until('return location.pathname.includes("55555555") && document.body.innerText.includes("Setup pending")', 'created account detail')
  await button('Suspend account'); await until('return !!document.querySelector("dialog[open]")', 'suspend confirmation')
  assert.equal(await js('return Boolean(document.querySelector("dialog[open]")?.contains(document.activeElement))'), true, 'Dialog should contain keyboard focus')
  await command('POST', `${path}/actions`, { actions: [{ type: 'key', id: 'keyboard', actions: [{ type: 'keyDown', value: '\uE00C' }, { type: 'keyUp', value: '\uE00C' }] }] })
  await until('return !document.querySelector("dialog[open]")', 'Escape dismisses confirmation')
  assert.equal(await js('return document.activeElement.textContent.trim()'), 'Suspend account', 'Dialog restores focus')
  await button('Suspend account')
  await fill('Your current password', 'Manager123'); await button('Confirm account change')
  await until('return document.body.innerText.includes("Suspended") && !document.querySelector("dialog[open]")', 'suspension')
  await button('Restore account'); await fill('Your current password', 'Manager123'); await button('Confirm account change')
  await until('return document.body.innerText.includes("Active") && !document.querySelector("dialog[open]")', 'restoration')
  await fill('First name', 'Edited'); await fill('Your current password', 'Manager123'); await button('Save changes')
  await until('return document.body.innerText.includes("Admin account updated.")', 'edited account')
  await js('adminFixture.admin.permissions=[]; window.dispatchEvent(new Event("admin:authorization-changed"))')
  await until('return document.body.innerText.includes("Access restricted")', 'live permission revocation')
  assert.equal(await js('return !!document.querySelector("form")'), false)
  await go('/admin-accounts')
  await until('return document.body.innerText.includes("existing@example.com")', 'reload normal fixture')
  await js('adminFixture.readError=true; document.querySelector("form").requestSubmit()')
  await until('return document.body.innerText.includes("Synthetic read failure")', 'read error')
  await js('adminFixture.readError=false; adminFixture.empty=true'); await button('Try again')
  await until('return document.body.innerText.includes("No Admin accounts match")', 'empty state')
  await js('localStorage.setItem("admin-provisioning-mode","pending")'); await go('/admin-accounts')
  await until('return location.pathname==="/setup" && document.body.innerText.includes("Set up your account")', 'first-login gate')
  assert.equal(await js('return adminFixture.requests.includes("/api/v1/admin/admin-accounts")'), false)
  assert.equal(await js('return !!document.querySelector(".portal-navigation")'), false)
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: width < 1024 })
    await js('document.documentElement.classList.toggle("dark",arguments[0]==="dark")',[theme])
    await new Promise((done) => setTimeout(done, 250))
    assert.equal(await js('return document.documentElement.scrollWidth<=innerWidth+2'),true,`setup ${theme} overflow ${width}`)
    assert.equal(await js('return [...document.querySelectorAll("input")].every(input=>parseFloat(getComputedStyle(input).borderTopWidth)>=1)'),true,'Setup inputs need visible control boundaries')
    if ([390,1440].includes(width)) await writeFile(`${artifacts}/setup-${theme}-${width}.png`,Buffer.from(await command('GET',`${path}/screenshot`),'base64'))
    captures++
  }
  for (const [label,value] of [['Temporary password','Temporary123'],['New password','Replacement456'],['Confirm new password','Replacement456']]) await fill(label,value)
  await button('Send verification code'); await until('return !!document.querySelector("input[autocomplete=one-time-code]")','OTP form')
  assert.equal(await js(`return [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Resend in')).disabled`),true)
  await js('adminFixture.codeFailure=true'); await fill('Verification code','000000'); await button('Verify and continue')
  await until('return document.body.innerText.includes("The verification code is incorrect.")','OTP error recovery')
  await js('adminFixture.codeFailure=false'); await fill('Verification code','123456'); await button('Verify and continue')
  await until('return location.pathname==="/dashboard"','completed setup')
  assert.equal(await js('return adminFixture.admin.setup_required'),false)
  await js('localStorage.setItem("admin-provisioning-mode","email-only")'); await go('/setup')
  await until('return document.body.innerText.includes("Verify your email")','email-only setup')
  assert.equal(await js('return !!document.querySelector("input[autocomplete=new-password]")'),false)
  await fill('Current password','Manager123'); await button('Send verification code')
  await until('return !!document.querySelector("input[autocomplete=one-time-code]")','email-only OTP')
  await fill('Verification code','123456'); await js('adminFixture.consent=false'); await button('Verify and continue')
  await until('return location.pathname==="/policy-consent"','policy consent follows email verification')
  assert.equal(await js('return adminFixture.requests.includes("/api/v1/admin/dashboard")'),false)
  console.log(`Admin provisioning Chromium passed: ${captures} viewport/theme checks; role dependencies, inherited grants, creation, editing, suspend/restore, drafts, live revocation, read recovery, setup gating, OTP cooldown/error/completion.`)
} finally { await command('DELETE', path) }
