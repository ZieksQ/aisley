// Real Chromium against the Seller production build. All API traffic is
// intercepted by the synthetic fixture installed before each document.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { captureResponsive, closeBrowser, openBrowser, artifacts, origin, sellerRoot } from './support.mjs'
import { installOperationsFixtures } from './fixtures.mjs'
import { reviewShippingProviders } from './shipping-providers.mjs'
import { reviewInventory } from './inventory.mjs'
import { reviewLowStockAlerts } from './low-stock-alerts.mjs'
import { reviewVouchers } from './vouchers.mjs'

const shouldServe = process.argv.includes('--serve')
const screenshotsOnly = process.argv.includes('--screenshots-only')
const screenshotGroup = process.argv.find((argument) => argument.startsWith('--screenshots-group='))?.split('=')[1] ?? 'all'
const feature = process.argv.find((argument) => argument.startsWith('--feature='))?.split('=')[1] ?? 'all'
const previewOutDir = process.env.SELLER_OPERATIONS_PREVIEW_OUTDIR
const previewArgs = [
  'preview', '--host', '127.0.0.1', '--port', new URL(origin).port || '15175', '--strictPort',
]
if (previewOutDir) previewArgs.push('--outDir', resolve(previewOutDir))
const preview = shouldServe
  ? spawn(process.execPath, [resolve(sellerRoot, 'node_modules/vite/bin/vite.js'), ...previewArgs], {
      cwd: sellerRoot,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
  : null
let previewDiagnostics = ''
preview?.stderr.on('data', (data) => { previewDiagnostics += data.toString() })

async function waitForPreview() {
  if (!preview) return
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) throw new Error(`Seller preview exited early: ${previewDiagnostics}`)
    try {
      const response = await fetch(origin)
      if (response.ok) return
    } catch { /* Vite is still starting. */ }
    await new Promise((done) => setTimeout(done, 200))
  }
  throw new Error(`Seller preview did not start at ${origin}: ${previewDiagnostics}`)
}

let browser
const blockedApiRequests = []
try {
  await mkdir(artifacts, { recursive: true })
  if (shouldServe) await waitForPreview()
  browser = await openBrowser()
  browser.on('Fetch.requestPaused', (request) => {
    blockedApiRequests.push({ method: request.request.method, url: request.request.url, resourceType: request.resourceType })
    void browser.cdp('Fetch.failRequest', { requestId: request.requestId, errorReason: 'BlockedByClient' })
      .catch((error) => console.error('Failed to stop an unscripted API request:', error))
  })
  const installScript = `(${installOperationsFixtures.toString()})(); if (!localStorage.getItem('aisley-seller-theme')) localStorage.setItem('aisley-seller-theme', 'light');`
  await browser.cdp('Page.addScriptToEvaluateOnNewDocument', { source: installScript })
  await browser.cdp('Network.enable')
  await browser.cdp('Network.setBlockedURLs', { urls: [
    `${origin}/api/*`, `${origin}/sanctum/*`,
    'http://127.0.0.1:8000/api/*', 'http://localhost:8000/api/*',
    'http://127.0.0.1:8000/sanctum/*', 'http://localhost:8000/sanctum/*',
  ] })
  await browser.cdp('Fetch.enable', { patterns: [
    { urlPattern: `${new URL(origin).origin}/api/*`, requestStage: 'Request' },
    { urlPattern: `${new URL(origin).origin}/sanctum/*`, requestStage: 'Request' },
    { urlPattern: 'http://127.0.0.1:8000/api/*', requestStage: 'Request' },
    { urlPattern: 'http://localhost:8000/api/*', requestStage: 'Request' },
    { urlPattern: 'http://127.0.0.1:8000/sanctum/*', requestStage: 'Request' },
    { urlPattern: 'http://localhost:8000/sanctum/*', requestStage: 'Request' },
  ] })
  await browser.viewport(1440, 960, false)
  await browser.navigate(`${origin}/shipping-providers`)
  await browser.until(`return location.origin === ${JSON.stringify(new URL(origin).origin)} && document.readyState === 'complete'`, 'authenticated operations route')
  await browser.waitText('Harbor Parcel Cooperative')
  const bootstrapRequests = await browser.requests()
  if (!bootstrapRequests.some((item) => item.path === '/api/v1/seller/auth/me')) {
    throw new Error(`Synthetic Seller authentication was not used: ${JSON.stringify(bootstrapRequests)}`)
  }

  const results = []
  if (screenshotsOnly) {
    assert.ok(['all', 'shipping', 'inventory', 'alerts', 'vouchers'].includes(screenshotGroup), `Unknown screenshot group: ${screenshotGroup}`)
    const id = {
      activeSku: '21000000-0000-4000-8000-000000000001',
      archivedSku: '21000000-0000-4000-8000-000000000004',
      activeAlert: '31000000-0000-4000-8000-000000000001',
      activeVoucher: '41000000-0000-4000-8000-000000000001',
    }
    const routes = [
      { group: 'shipping', route: '/shipping-providers', expected: 'Harbor Parcel Cooperative', prefix: 'shipping-list' },
      { group: 'inventory', route: '/inventory', expected: 'Cedar Storage Basket', prefix: 'inventory-list' },
      { group: 'inventory', route: `/inventory/${id.activeSku}`, expected: 'Cedar Storage Basket', prefix: 'inventory-detail' },
      { group: 'inventory', route: `/inventory/${id.archivedSku}`, expected: 'Archived product', prefix: 'inventory-archived-detail' },
      { group: 'alerts', route: '/low-stock-alerts', expected: 'Olive Oil Set', prefix: 'alerts-list' },
      { group: 'alerts', route: `/low-stock-alerts/${id.activeAlert}`, expected: 'Olive Oil Set', prefix: 'alert-detail' },
      { group: 'vouchers', route: '/vouchers', expected: 'Harvest weekend savings', prefix: 'vouchers-list' },
      { group: 'vouchers', route: '/vouchers/new', expected: 'Create voucher', prefix: 'voucher-editor' },
      { group: 'vouchers', route: `/vouchers/${id.activeVoucher}`, expected: 'Harvest weekend savings', settled: 'No versions yet.', prefix: 'voucher-detail' },
    ]
    for (const page of routes.filter((item) => screenshotGroup === 'all' || item.group === screenshotGroup)) {
      await captureResponsive(browser, page)
      results.push({ prefix: page.prefix, route: page.route })
    }
    if (screenshotGroup === 'all' || screenshotGroup === 'inventory') {
      await browser.viewport(320, 900, false)
      await browser.evaluate("localStorage.setItem('aisley-seller-theme', 'light')")
      await browser.navigate(`/inventory/${id.activeSku}`)
      await browser.waitText('Cedar Storage Basket')
      for (const [section, filename] of [
        ['adjust-stock', 'inventory-adjustment-320-light.png'],
        ['stock-threshold', 'inventory-threshold-320-light.png'],
      ]) {
        await browser.evaluate(`document.getElementById('${section}')?.scrollIntoView({ block: 'start' })`)
        await browser.assertNoHorizontalOverflow(`Inventory ${section} section at 320px light`)
        await browser.screenshot(filename)
      }
    }
    if (screenshotGroup === 'all' || screenshotGroup === 'vouchers') {
      await browser.viewport(320, 900, false)
      await browser.evaluate("localStorage.setItem('aisley-seller-theme', 'light')")
      await browser.navigate('/vouchers/new')
      await browser.waitText('Create voucher')
      for (const section of ['Benefit', 'Conditions', 'Schedule', 'Limits', 'Terms']) {
        await browser.clickText(section, 'document.querySelector(".voucher-editor-nav")')
        await browser.assertNoHorizontalOverflow(`Voucher editor ${section} section at 320px light`)
        await browser.screenshot(`voucher-editor-${section.toLowerCase()}-320-light.png`)
      }
    }
    if (screenshotGroup === 'all' || screenshotGroup === 'shipping') {
      for (const theme of ['light', 'dark']) {
        for (const width of [320, 390, 768, 1440]) {
          await browser.viewport(width, 850, false)
          await browser.evaluate(`localStorage.setItem('aisley-seller-theme', '${theme}')`)
          await browser.navigate('/shipping-providers')
          await browser.waitText('Harbor Parcel Cooperative')
          await browser.clickText('Add shipping provider')
          await browser.waitText('Add shipping provider')
          const bounds = await browser.evaluate("return (() => { const dialog = document.querySelector('dialog[aria-labelledby]'); const rect = dialog?.getBoundingClientRect(); return rect && { open: dialog.open, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: document.documentElement.clientWidth, viewportHeight: innerHeight } })()")
          assert.ok(bounds?.open, `Add-provider dialog opens at ${width}px ${theme}`)
          assert.ok(bounds.left >= 0 && bounds.right <= bounds.viewportWidth + 1 && bounds.top >= 0 && bounds.bottom <= bounds.viewportHeight + 1, `Add-provider dialog fits ${width}px ${theme}: ${JSON.stringify(bounds)}`)
          assert.equal(await browser.evaluate("return document.documentElement.classList.contains('dark')"), theme === 'dark', `Add-provider modal uses ${theme} theme at ${width}px`)
          await browser.assertNoHorizontalOverflow(`Shipping Add-provider modal ${width}px ${theme}`)
          await browser.screenshot(`shipping-add-modal-${width}-${theme}.png`)
          await browser.clickText('Done', 'document.querySelector("dialog")')
        }
      }
    }
  } else {
    const features = [
      ['shipping providers', reviewShippingProviders],
      ['inventory', reviewInventory],
      ['low-stock alerts', reviewLowStockAlerts],
      ['vouchers', reviewVouchers],
    ]
    assert.ok(['all', 'shipping', 'inventory', 'alerts', 'vouchers'].includes(feature), `Unknown feature: ${feature}`)
    for (const [name, run] of features.filter(([name]) => feature === 'all' || name.startsWith(feature === 'shipping' ? 'shipping' : feature === 'alerts' ? 'low-stock' : feature))) {
      const result = await run(browser)
      results.push({ name, ...result })
      console.log(`Seller ${name} browser review passed.`)
    }
  }
  assert.deepEqual(blockedApiRequests, [], 'No browser API request escaped the synthetic local fixture')
  assert.deepEqual(browser.errors, [], 'Chromium reported no uncaught runtime exception')
  console.log(JSON.stringify({ origin, artifacts, results, blockedApiRequests }, null, 2))
} catch (error) {
  console.error(error)
  if (browser) {
    try {
      await browser.screenshot('operations-failure.png')
      const page = await browser.evaluate("return { href: location.href, title: document.title, body: document.body?.innerText.slice(0, 1200) }")
      console.error('Failure screenshot:', resolve(artifacts, 'operations-failure.png'))
      console.error('Failure page:', JSON.stringify(page))
    } catch (captureError) {
      console.error('Could not capture failure page:', captureError)
    }
  }
  if (browser?.errors?.length) console.error('Chromium runtime exceptions:', JSON.stringify(browser.errors, null, 2))
  if (previewDiagnostics) console.error('Preview output:', previewDiagnostics)
  if (blockedApiRequests.length) console.error('Blocked outbound API requests:', JSON.stringify(blockedApiRequests, null, 2))
  process.exitCode = 1
} finally {
  if (browser) await closeBrowser(browser)
  if (preview) {
    preview.kill()
    await new Promise((done) => {
      if (preview.exitCode !== null || preview.signalCode !== null) return done()
      preview.once('exit', done)
      setTimeout(() => { preview.kill('SIGKILL'); done() }, 5000).unref()
    })
  }
  await rm(resolve(sellerRoot, '../../node_modules/.cache/o'), { recursive: true, force: true })
}
