import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { openBrowser, closeBrowser, origin, artifacts, sellerRoot } from '../operations/support.mjs'
import { installOperationsFixtures } from '../operations/fixtures.mjs'
import { installOrderFixtures } from './fixtures.mjs'
import { verifyPickingSheet } from './picking-sheet.mjs'

const preview = process.argv.includes('--serve') ? spawn(process.execPath, [
  resolve(sellerRoot, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1',
  '--port', new URL(origin).port, '--strictPort',
], { cwd: sellerRoot, stdio: ['ignore', 'ignore', 'pipe'] }) : null
let browser
const evidence = []
try {
  if (preview) {
    const deadline = Date.now() + 20000
    while (true) {
      try { if ((await fetch(origin)).ok) break } catch { /* Wait for the owned preview. */ }
      if (Date.now() > deadline) throw new Error('Seller preview did not start')
      await new Promise((done) => setTimeout(done, 150))
    }
  }
  await mkdir(artifacts, { recursive: true })
  browser = await openBrowser()
  await browser.cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${installOperationsFixtures.toString()})(); (${installOrderFixtures.toString()})();`,
  })
  await browser.cdp('Network.enable')
  await browser.cdp('Network.setBlockedURLs', { urls: ['*://*/api/*', '*://*/sanctum/*'] })
  await browser.viewport(1440, 960, false)
  await browser.navigate('/orders/monitoring')
  await browser.waitText('ASL-20261015-4100')
  await verifyPickingSheet(browser)
  await browser.setField('Search orders', 'Cedar')
  await browser.clickText('Search')
  await browser.until("return location.search.includes('search=Cedar') && document.body.innerText.includes('13 orders')", 'paginated monitoring search')
  await browser.clickText('Sort')
  await browser.until("return document.querySelector('dialog')?.open", 'sort modal')
  await browser.evaluate("document.querySelector('input[value=oldest]').click()")
  await browser.clickText('Apply sort')
  await browser.until("return location.search.includes('sort=oldest') && !document.querySelector('dialog')", 'sort applies and closes')
  assert.equal(await browser.evaluate("return document.activeElement?.textContent.trim()"), 'Sort')
  await browser.clickText('Clear search')
  await browser.waitText('25 orders')
  await browser.clickText('Next')
  await browser.until("return location.search.includes('page=2')", 'monitoring pagination')
  await browser.setField('Search orders', '4100')
  await browser.clickText('Search')
  await browser.until("return !location.search.includes('page=2') && document.body.innerText.includes('1 order')", 'search resets pagination')
  await browser.clickText('View order')
  await browser.waitText('Purchased items')
  await browser.clickText('Approve order')
  await browser.clickText('Confirm approval')
  await browser.until("return location.pathname === '/orders/approval' && document.body.innerText.includes('was approved')", 'approval returns to queue')
  assert.equal(await browser.evaluate("return document.querySelector('tbody')?.innerText.includes('ASL-20261015-4100')"), false)
  await browser.clickText('Review order')
  await browser.waitText('Purchased items')
  await browser.clickText('Reject')
  await browser.clickText('Confirm rejection')
  await browser.until("return location.pathname === '/orders/approval' && document.body.innerText.includes('was rejected')", 'rejection returns to queue')

  await browser.navigate('/orders/pickup')
  await browser.waitText('View parcels')
  await browser.clickText('Change address')
  await browser.until("return document.querySelector('dialog')?.open", 'pickup address modal')
  await browser.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await browser.until("return !document.querySelector('dialog')", 'address modal Escape dismissal')
  const requestRows = await browser.evaluate("return [...document.querySelectorAll('section[aria-labelledby=pickup-requests-title] tbody tr')].map(row => row.innerText)")
  assert.ok(requestRows[0].includes('Request') && !requestRows[0].includes('Scheduled'))
  assert.ok(requestRows[1].includes('Scheduled') && requestRows[1].includes('2026'))
  assert.ok(requestRows[2].includes('Request') && !requestRows[2].includes('Scheduled'))
  assert.equal(await browser.evaluate("return document.querySelector('section[aria-labelledby=pickup-requests-title] tbody th a')"), null)
  await browser.clickText('Next', 'document.querySelector("section[aria-labelledby=pickup-requests-title]")')
  await browser.until("return location.search.includes('pickup_page=2')", 'pickup pagination')
  await browser.clickText('Sort')
  await browser.evaluate("document.querySelector('input[value=requested_asc]').click()")
  await browser.clickText('Apply sort')
  await browser.until("return location.search.includes('pickup_sort=requested_asc') && !location.search.includes('pickup_page') && !document.querySelector('dialog') && document.querySelector('section[aria-labelledby=pickup-requests-title]')?.getAttribute('aria-busy') === 'false'", 'pickup sorting settles and resets page')
  await browser.clickText('View parcels')
  await browser.waitText('Orders in this pickup')
  await browser.evaluate(`window.open = () => ({ addEventListener: () => {}, location: {}, close: () => {} })`)
  await browser.clickText('Print all waybills')
  await browser.until("return window.orderFixture.requests.some(item => item.path.endsWith('waybills.pdf') && item.query.includes('disposition=inline'))", 'bulk inline PDF action')
  await browser.clickName('Print WB-4222')
  await browser.until("return window.orderFixture.requests.some(item => item.path.includes('/orders/') && item.path.endsWith('/waybill') && item.query.includes('disposition=inline'))", 'individual PDF action')
  console.log('Order search, sorting, decisions, pickup actions, and PDF reads passed.')

  const routes = [
    ['monitoring', '/orders/monitoring', 'ASL-20261015-4100'],
    ['approval', '/orders/approval', 'Review order'],
    ['detail', '/orders/90000000-0000-4000-8000-000000000001', 'Purchased items'],
    ['preparation', '/orders/90000000-0000-4000-8000-000000000022/prepare', 'Ready to pack'],
    ['pickup', '/orders/pickup', 'View parcels'],
    ['parcels', '/orders/pickup/80000000-0000-4000-8000-000000000001', 'Orders in this pickup'],
  ]
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 390, 768, 1440]) {
      await browser.viewport(width, 960, false)
      for (const [name, path, ready] of routes) {
        await browser.evaluate(`localStorage.setItem('aisley-seller-theme', '${theme}')`)
        await browser.navigate(path)
        await browser.waitText(ready)
        await browser.assertNoHorizontalOverflow(`${name} ${width}px ${theme}`)
        const style = await browser.evaluate(`(() => {
          const surface = document.querySelector('.order-surface, .dashboard-stat-card');
          const rows = [...document.querySelectorAll('.portal-table tbody tr')];
          const probe = document.createElement('span');
          probe.style.color = 'var(--portal-surface)'; surface.append(probe);
          const expected = getComputedStyle(probe).color; probe.remove();
          return { surface: getComputedStyle(surface).backgroundColor, expected,
            row: Math.max(0, ...rows.map(row => row.getBoundingClientRect().height)),
            actionTargets: [...document.querySelectorAll('tbody .portal-button')].every(action => {
              const rect = action.getBoundingClientRect(); return rect.height >= 44 && rect.width >= 44;
            }) };
        })()`)
        assert.equal(style.surface, style.expected, `${name} uses its portal surface token`)
        assert.ok(style.actionTargets, `${name} preserves 44px action targets`)
        if (style.row) assert.ok(style.row <= 72, `${name} uses compact rows: ${style.row}px`)
        assert.equal(await browser.evaluate("return document.documentElement.classList.contains('dark')"), theme === 'dark')
        await browser.screenshot(`orders-${name}-${width}-${theme}.png`)
        if (width === 1440 && ['monitoring', 'approval', 'pickup'].includes(name)) {
          const action = await browser.evaluate("return (() => { const link = document.querySelector('tbody a.portal-button'); link.scrollIntoView({ block: 'center' }); const rect = link.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } })()")
          await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...action })
          assert.equal(await browser.evaluate("return getComputedStyle(document.querySelector('tbody a.portal-button')).textDecorationLine"), 'none')
        }
        if (name === 'pickup') {
          await browser.evaluate("document.getElementById('pickup-requests-title').scrollIntoView({ block: 'start' })")
          await browser.screenshot(`orders-pickup-requests-${width}-${theme}.png`)
        }
        evidence.push({ name, width, theme, ...style })
      }
      console.log(`Order pages verified at ${width}px in ${theme} mode.`)
    }
  }
  await browser.navigate('/orders/monitoring')
  await browser.waitText('ASL-20261015-4100')
  await browser.evaluate("window.orderFixture.mode = 'error'")
  await browser.clickText('Refresh')
  await browser.waitText('Order service unavailable. Try again.')
  await browser.evaluate("window.orderFixture.mode = 'normal'")
  await browser.clickText('Try again')
  await browser.waitText('ASL-20261015-4100')
  await browser.setField('Search orders', 'no-such-order')
  await browser.clickText('Search')
  await browser.waitText('No orders match')
  await browser.evaluate("window.orderFixture.mode = 'loading'")
  await browser.setField('Search orders', 'Cedar')
  await browser.clickText('Search')
  await browser.until("return Boolean(document.querySelector('[aria-label=\"Loading orders\"]'))", 'search loading state')
  await browser.waitText('13 orders')
  assert.deepEqual(browser.errors, [])
  await writeFile(resolve(artifacts, 'orders-evidence.json'), JSON.stringify(evidence, null, 2))
  console.log(`Seller order interactions and ${evidence.length} responsive theme checks passed. Artifacts: ${artifacts}`)
} catch (error) {
  if (browser) await browser.screenshot('orders-failure.png').catch(() => undefined)
  throw error
} finally {
  if (browser) await closeBrowser(browser)
  if (preview) {
    preview.kill()
    await new Promise((done) => {
      if (preview.exitCode !== null || preview.signalCode !== null) return done()
      preview.once('exit', done)
      setTimeout(() => { preview.kill('SIGKILL'); done() }, 3000).unref()
    })
  }
}
