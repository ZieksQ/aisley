// Synthetic notification filtering and support deep-link regression.
// Run from the repository root after `pnpm --dir src/logistics build`.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const appRoot = resolve(repoRoot, 'src/logistics')
const artifacts = resolve(repoRoot, 'node_modules/.cache/logistics-notifications')
await mkdir(artifacts, { recursive: true })
const driverPath = resolve(artifacts, 'browser-driver.mjs')
const driverSource = (await readFile(resolve(repoRoot, 'packages/ui/tests/chat-browser-driver.mjs'), 'utf8'))
  .replace('node_modules/.cache/messages-ui', 'node_modules/.cache/logistics-notifications/browser')
  .replace('.next/mu', '.tmp/ln')
  .replace('pending.set(id, { resolve: yes, reject: no, timer });', 'pending.set(id, { resolve: yes, reject: no, timer, method });')
  .replace('new Error(JSON.stringify(message.error))', 'new Error(`${request.method}: ${JSON.stringify(message.error)}`)')
await writeFile(driverPath, driverSource)
const { openChatBrowser } = await import(pathToFileURL(driverPath))

const retryRoleFixtures = [
  {
    role: 'seller',
    label: 'Try again',
    className: 'ml-2 inline-flex min-h-11 min-w-11 items-center justify-center align-middle font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-focus)]',
  },
  {
    role: 'admin',
    label: 'Retry',
    className: 'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-focus)]',
  },
  {
    role: 'logistics',
    label: 'Try again',
    className: 'mt-2 inline-flex min-h-11 min-w-11 items-center justify-center font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-focus)]',
  },
]
const retrySources = await Promise.all([
  readFile(resolve(repoRoot, 'src/seller/src/pages/NotificationsPage.tsx'), 'utf8'),
  readFile(resolve(repoRoot, 'src/admin/src/pages/NotificationsPage.tsx'), 'utf8'),
  readFile(resolve(repoRoot, 'src/logistics/src/components/PickupUi.tsx'), 'utf8'),
])
retryRoleFixtures.forEach((fixture, index) => {
  assert.ok(retrySources[index].includes(`className="${fixture.className}"`), `${fixture.role} retry uses the measured fixture classes`)
})

const port = process.env.LOGISTICS_NOTIFICATIONS_PORT ?? '15188'
const origin = process.env.LOGISTICS_NOTIFICATIONS_ORIGIN ?? `http://127.0.0.1:${port}`
const preview = process.argv.includes('--serve')
  ? spawn(process.execPath, [resolve(appRoot, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', port, '--strictPort'], { cwd: appRoot, stdio: ['ignore', 'ignore', 'pipe'] })
  : null

if (preview) {
  let ready = false
  const deadline = Date.now() + 20000
  while (!ready && Date.now() < deadline) {
    try { ready = (await fetch(origin)).ok } catch { await new Promise((done) => setTimeout(done, 200)) }
  }
  if (!ready) { preview.kill(); throw new Error(`Logistics preview did not start on ${origin}`) }
}

const browser = await openChatBrowser()
const { cdp, evaluate, until, screenshot } = browser
const ticketId = 'b7e14ff6-3f11-4d9d-b17e-dc68359d1901'
const runFixture = () => {
  if (sessionStorage.getItem('logistics-notifications-theme-bootstrap') !== 'done') {
    localStorage.setItem('logistics-theme', 'light')
    sessionStorage.setItem('logistics-notifications-theme-bootstrap', 'done')
  }
  const original = window.fetch.bind(window)
  const ticketId = 'b7e14ff6-3f11-4d9d-b17e-dc68359d1901'
  const createdAt = '2026-10-08T01:00:00Z'
  const categories = [
    { key: 'pickups', label: 'Pickups' },
    { key: 'couriers', label: 'Couriers' },
    { key: 'deliveries', label: 'Deliveries' },
    { key: 'linehaul', label: 'Linehaul' },
    { key: 'finance', label: 'Finance' },
    { key: 'support', label: 'Support' },
    { key: 'other', label: 'Other' },
  ]
  const notifications = [
    { id: 'note-support', type: 'support-ticket.requester-replied', title: 'Ticket reply needs review', summary: 'A customer replied about a delivery issue.', category: 'support', category_label: 'Support', read_at: null, created_at: createdAt, resource_type: 'support_ticket', resource_id: ticketId, destination: null },
    { id: 'note-pickup', type: 'logistics-pickup.created', title: 'Pickup ready to schedule', summary: 'A Seller requested a parcel pickup.', category: 'pickups', category_label: 'Pickups', read_at: null, created_at: createdAt, resource_type: 'pickup', resource_id: 'pickup-1', destination: null },
    { id: 'note-pickup-read', type: 'logistics-pickup.updated', title: 'Pickup completed', summary: 'The Seller marked the pickup complete.', category: 'pickups', category_label: 'Pickups', read_at: createdAt, created_at: createdAt, resource_type: 'pickup', resource_id: 'pickup-2', destination: null },
  ]
  const ticket = { id: ticketId, reference: 'SUP-BROWSER-1', subject: 'Notification deep link delivery issue', category: 'delivery', status: 'open', revision: 1, requester_role: 'customer', requester_name: 'Browser fixture', assignee_name: null, assignee_id: null, unread_count: 1, last_activity_at: createdAt, created_at: createdAt, resolved_at: null }
  const state = window.notificationFixture = { requests: [], writes: [], notifications, failNextListRequest: false }
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  window.fetch = async (input, options = {}) => {
    const parsed = new URL(input, location.origin)
    const path = parsed.pathname
    const method = options.method ?? 'GET'

    if (path === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    if (path === '/api/v1/logistics/auth/me') return json({ logistics: { id: 'browser-logistics', role: 'logistics', status: 'active', email: 'notifications@example.test', profile: { first_name: 'Notification', last_name: 'Reviewer' }, organization: { id: 'org-1', business_name: 'Browser Logistics', hub: { id: 'hub-1', name: 'Main Hub' } } } })
    if (path === '/api/v1/policy-consent/status') return json({ data: { all_required_accepted: true, policies: [] } })
    if (path === '/api/v1/logistics/notifications/unread-count') return json({ data: { unread_count: state.notifications.filter((item) => !item.read_at).length } })
    if (path === '/api/v1/logistics/notifications' && method === 'GET') {
      const status = parsed.searchParams.get('status') ?? 'all'
      const category = parsed.searchParams.get('category')
      const page = Number(parsed.searchParams.get('page') ?? '1')
      state.requests.push({ status, category, page })
      if (state.failNextListRequest) {
        state.failNextListRequest = false
        return json({ message: 'The notification fixture failed once.' }, 503)
      }
      let rows = state.notifications.filter((item) => status === 'all' || (status === 'unread' ? !item.read_at : Boolean(item.read_at)))
      if (category && category !== 'all') rows = rows.filter((item) => item.category === category)
      const perPage = Number(parsed.searchParams.get('per_page') ?? '20')
      const lastPage = Math.max(1, Math.ceil(rows.length / perPage))
      const data = rows.slice((page - 1) * perPage, page * perPage)
      return json({ data, meta: { current_page: page, last_page: lastPage, per_page: perPage, total: rows.length, categories } })
    }
    if (path === `/api/v1/logistics/notifications/note-support/read` && method === 'POST') {
      state.writes.push({ path })
      const item = state.notifications.find(({ id }) => id === 'note-support')
      item.read_at = createdAt
      return json({ data: item })
    }
    if (path === '/api/v1/logistics/support-tickets' && method === 'GET') return json({ items: [ticket], next_cursor: null })
    if (path === `/api/v1/logistics/support-tickets/${ticketId}` && method === 'GET') return json({ data: ticket, events: [{ id: 'ticket-event', sequence: 1, type: 'reply', actor_role: 'customer', is_mine: false, body: 'Please check the delivery handoff.', from_status: null, to_status: null, assignment_changed: false, created_at: createdAt }], next_cursor: null })
    if (path === `/api/v1/logistics/support-tickets/${ticketId}/read` && method === 'POST') return json({ data: ticket })
    if (path.startsWith('/api/')) return json({ message: `Unexpected fixture request: ${method} ${path}` }, 404)
    return original(input, options)
  }
}

await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Network.setBypassServiceWorker', { bypass: true })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${runFixture.toString()})();` })

const desktopLightPath = resolve(artifacts, 'logistics-notifications-desktop-light.png')
const mobileLightPath = resolve(artifacts, 'logistics-notifications-mobile-light.png')
const desktopDarkPath = resolve(artifacts, 'logistics-notifications-desktop-dark.png')
const mobileDarkPath = resolve(artifacts, 'logistics-notifications-mobile-dark.png')

async function assertPortalTheme(theme) {
  const actual = await evaluate(`(() => {
    const shell = document.querySelector('.portal-shell')
    const toolbar = document.querySelector('.portal-toolbar')
    return {
      isDark: document.documentElement.classList.contains('dark'),
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      shellSurface: getComputedStyle(shell).backgroundColor,
      toolbarSurface: getComputedStyle(toolbar).backgroundColor,
    }
  })()`)
  const expected = theme === 'dark'
    ? { isDark: true, colorScheme: 'dark', shellSurface: 'rgb(15, 23, 42)', toolbarSurface: 'rgb(30, 41, 59)' }
    : { isDark: false, colorScheme: 'light', shellSurface: 'rgb(248, 250, 252)', toolbarSurface: 'rgb(255, 255, 255)' }
  assert.deepEqual(actual, expected, `${theme} theme resolves to the expected portal surfaces`)
}

async function tabToNextControl() {
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
}

async function assertRoleRetryTargets(theme) {
  await evaluate(`(() => {
    const root = document.createElement('div')
    root.id = 'notification-retry-role-fixtures'
    root.style.cssText = 'position:fixed;left:-2000px;top:0;z-index:-1;'
    const fixtures = ${JSON.stringify(retryRoleFixtures)}
    for (const fixture of fixtures) {
      const shell = document.createElement('div')
      shell.className = 'portal-shell'
      shell.dataset.role = fixture.role
      shell.style.cssText = 'width:300px;min-height:0;height:auto;'
      const before = document.createElement('button')
      before.type = 'button'
      before.textContent = 'Previous control'
      const alert = document.createElement('div')
      alert.setAttribute('role', 'alert')
      const action = document.createElement('button')
      action.dataset.retryTarget = fixture.role
      action.className = fixture.className
      action.textContent = fixture.label
      alert.append(action)
      shell.append(before, alert)
      root.append(shell)
    }
    document.body.append(root)
  })()`)

  const expectedFocusColor = theme === 'dark'
    ? { seller: 'rgb(196, 181, 253)', admin: 'rgb(196, 181, 253)', logistics: 'rgb(147, 197, 253)' }
    : { seller: 'rgb(109, 40, 217)', admin: 'rgb(109, 40, 217)', logistics: 'rgb(37, 99, 235)' }

  for (const fixture of retryRoleFixtures) {
    await evaluate(`document.querySelector('#notification-retry-role-fixtures [data-role="${fixture.role}"] > button').focus()`)
    await tabToNextControl()
    const actual = await evaluate(`(() => {
      const button = document.querySelector('[data-retry-target="${fixture.role}"]')
      const rect = button.getBoundingClientRect()
      const style = getComputedStyle(button)
      return {
        width: rect.width,
        height: rect.height,
        keyboardFocused: document.activeElement === button && button.matches(':focus-visible'),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineOffset: style.outlineOffset,
        outlineColor: style.outlineColor,
      }
    })()`)
    assert.ok(actual.width >= 44 && actual.height >= 44, `${fixture.role} retry target is at least 44x44px: ${JSON.stringify(actual)}`)
    assert.equal(actual.keyboardFocused, true, `${fixture.role} retry receives keyboard-visible focus`)
    assert.deepEqual(
      { outlineStyle: actual.outlineStyle, outlineWidth: actual.outlineWidth, outlineOffset: actual.outlineOffset, outlineColor: actual.outlineColor },
      { outlineStyle: 'solid', outlineWidth: '2px', outlineOffset: '2px', outlineColor: expectedFocusColor[fixture.role] },
      `${fixture.role} retry has the role's 2px focus outline in ${theme} mode`,
    )
  }
  await evaluate(`document.querySelector('#notification-retry-role-fixtures')?.remove()`)
}

try {
  await browser.viewport(1440, 900, false)
  await browser.navigate(`${origin}/notifications?status=unread&category=pickups&page=2`)
  await until('Boolean(window.notificationFixture && document.querySelector(\'[aria-label="Notification category"]\'))', 'notification filters mounted')
  await until('document.body.innerText.includes("No unread notifications in Pickups yet.")', 'page 2 empty fixture')
  await assertPortalTheme('light')

  const click = async (label, group) => {
    const result = await evaluate(`(() => { const scope=document.querySelector(${JSON.stringify(`[aria-label="${group}"]`)}); const button=[...(scope?.querySelectorAll('button')||[])].find(node=>node.textContent.trim()===${JSON.stringify(label)}); if(!button)return false;button.click();return true })()`)
    assert.equal(result, true, `${group} has ${label} button`)
  }
  await click('Support', 'Notification category')
  await until('location.search.includes("category=support") && !location.search.includes("page=")', 'category selection resets page')
  await until('document.body.innerText.includes("Ticket reply needs review")', 'support result loaded')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Notification category"] button[aria-pressed="true"]')?.textContent.trim()`), 'Support')
  assert.equal(await evaluate(`document.querySelector('[aria-label="Notification status"] button[aria-pressed="true"]')?.textContent.trim()`), 'Unread')
  assert.equal(await evaluate(`notificationFixture.requests.at(-1)?.page`), 1, 'category filter starts from page one')
  await assertRoleRetryTargets('light')
  await screenshot(desktopLightPath)

  await evaluate('notificationFixture.failNextListRequest = true')
  await click('Read', 'Notification status')
  await until('location.search.includes("status=read") && location.search.includes("category=support")', 'status selection preserves category')
  await until('document.querySelector("main section [role=alert] button")?.textContent.trim() === "Try again" && document.body.innerText.includes("The notification fixture failed once.")', 'failed list request exposes retry')
  assert.deepEqual(await evaluate('notificationFixture.requests.at(-1)'), { status: 'read', category: 'support', page: 1 })

  const retryTargetAvailable = await evaluate(`(() => {
    const retry = document.querySelector('main section [role="alert"] button')
    const controls = [...document.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    const index = controls.indexOf(retry)
    if (index <= 0) return false
    controls[index - 1].focus()
    return true
  })()`)
  assert.equal(retryTargetAvailable, true, 'error retry can be reached from the prior keyboard control')
  await tabToNextControl()
  const retryMetrics = await evaluate(`(() => {
    const retry = document.querySelector('main section [role="alert"] button')
    const rect = retry.getBoundingClientRect()
    const style = getComputedStyle(retry)
    return {
      width: rect.width,
      height: rect.height,
      keyboardFocused: document.activeElement === retry && retry.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      outlineColor: style.outlineColor,
    }
  })()`)
  assert.ok(retryMetrics.width >= 44 && retryMetrics.height >= 44, `Logistics notification retry is at least 44x44px: ${JSON.stringify(retryMetrics)}`)
  assert.equal(retryMetrics.keyboardFocused, true, 'Logistics notification retry receives keyboard-visible focus')
  assert.deepEqual(
    { outlineStyle: retryMetrics.outlineStyle, outlineWidth: retryMetrics.outlineWidth, outlineOffset: retryMetrics.outlineOffset, outlineColor: retryMetrics.outlineColor },
    { outlineStyle: 'solid', outlineWidth: '2px', outlineOffset: '2px', outlineColor: 'rgb(37, 99, 235)' },
    'Logistics notification retry has the blue 2px focus outline in light mode',
  )
  await screenshot(resolve(artifacts, 'logistics-notifications-error-desktop-light.png'))
  await evaluate(`document.querySelector('main section [role="alert"] button').click()`)
  await until('!document.querySelector("main section [role=alert] button") && document.body.innerText.includes("No read notifications in Support yet.")', 'retry recovers to the combined-filter empty state')
  assert.deepEqual(await evaluate('notificationFixture.requests.at(-1)'), { status: 'read', category: 'support', page: 1 }, 'retry repeats the current filters')

  await click('Unread', 'Notification status')
  await until('location.search.includes("status=unread") && location.search.includes("category=support")', 'restore unread support filter')
  await until('document.body.innerText.includes("Ticket reply needs review")', 'support result restored')

  await browser.viewport(390, 844, true)
  const mobile = await evaluate(`(() => {const group=document.querySelector('[aria-label="Notification category"]');const buttons=[...group.querySelectorAll('button')];return {pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,buttonHeights:buttons.map(button=>button.getBoundingClientRect().height),scroller:group.scrollWidth>group.clientWidth}})()`)
  assert.ok(mobile.pageWidth <= mobile.viewport, `mobile page has no horizontal overflow: ${JSON.stringify(mobile)}`)
  assert.ok(mobile.buttonHeights.every((height) => height >= 44), `filter buttons meet 44px target: ${JSON.stringify(mobile)}`)
  await screenshot(mobileLightPath)

  await browser.navigate(`${origin}/settings/appearance`)
  await until('Boolean(document.querySelector("#logistics-theme"))', 'Appearance theme control mounted')
  assert.deepEqual(await evaluate(`(() => {
    const theme = document.querySelector('#logistics-theme')
    theme.value = 'dark'
    theme.dispatchEvent(new Event('change', { bubbles: true }))
    return { selected: theme.value, stored: localStorage.getItem('logistics-theme') }
  })()`), { selected: 'dark', stored: 'dark' }, 'Appearance control persists the dark preference')
  await until('document.documentElement.classList.contains("dark") && document.documentElement.style.colorScheme === "dark"', 'Appearance provider applies dark theme')
  await assertPortalTheme('dark')

  await browser.navigate(`${origin}/notifications?status=unread&category=support`)
  await until('Boolean(window.notificationFixture && document.querySelector(\'[aria-label="Notification category"]\'))', 'notification filters restored after theme change')
  await until('document.body.innerText.includes("Ticket reply needs review")', 'support notification restored in dark theme')
  await assertPortalTheme('dark')
  await assertRoleRetryTargets('dark')
  await browser.viewport(1440, 900, false)
  await screenshot(desktopDarkPath)
  await browser.viewport(390, 844, true)
  const darkMobile = await evaluate(`(() => ({pageWidth:document.documentElement.scrollWidth,viewport:innerWidth}))()`)
  assert.ok(darkMobile.pageWidth <= darkMobile.viewport, `dark mobile page has no horizontal overflow: ${JSON.stringify(darkMobile)}`)
  await screenshot(mobileDarkPath)

  const [desktopLight, mobileLight, desktopDark, mobileDark] = await Promise.all([
    readFile(desktopLightPath),
    readFile(mobileLightPath),
    readFile(desktopDarkPath),
    readFile(mobileDarkPath),
  ])
  assert.notDeepEqual(desktopLight, mobileLight, 'desktop and phone screenshots have different viewport captures')
  assert.notDeepEqual(mobileLight, mobileDark, 'light and dark phone screenshots have different rendered palettes')
  assert.notDeepEqual(desktopLight, desktopDark, 'light and dark desktop screenshots have different rendered palettes')

  const opened = await evaluate(`(() => { const link=[...document.querySelectorAll('a')].find(node=>node.innerText.includes('Ticket reply needs review')); if(!link)return null;const href=link.getAttribute('href');link.click();return href })()`)
  assert.equal(opened, `/support-tickets?ticket=${ticketId}`, 'notification links to exact ticket UUID')
  await until(`location.pathname==='/support-tickets' && location.search.includes(${JSON.stringify(ticketId)})`, 'support ticket URL selected')
  await until(`document.body.innerText.includes('Notification deep link delivery issue')`, 'deep-linked ticket detail loaded')
  assert.equal(await evaluate('notificationFixture.writes.some((write)=>write.path.endsWith("/notifications/note-support/read"))'), true, 'notification click preserves mark-as-read behavior')
  await screenshot(resolve(artifacts, 'logistics-notification-ticket-deeplink.png'))

  assert.deepEqual(browser.errors, [], `browser runtime errors: ${JSON.stringify(browser.errors)}`)
  console.log(`Notification browser checks passed; screenshots: ${artifacts}`)
} finally {
  browser.close()
  preview?.kill()
}
