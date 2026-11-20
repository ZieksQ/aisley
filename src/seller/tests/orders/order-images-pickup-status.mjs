import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { openBrowser, closeBrowser, origin, artifacts, sellerRoot } from '../operations/support.mjs'
import { installOperationsFixtures } from '../operations/fixtures.mjs'
import { installOrderFixtures } from './fixtures.mjs'

const preview = process.argv.includes('--serve') ? spawn(process.execPath, [
  resolve(sellerRoot, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1',
  '--port', new URL(origin).port, '--strictPort',
], { cwd: sellerRoot, stdio: ['ignore', 'ignore', 'pipe'] }) : null
let browser
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
  await browser.navigate('/orders/monitoring')
  await browser.waitText('ASL-20261015-4100')
  const pickupRows = "document.querySelectorAll('section[aria-labelledby=pickup-requests-title] tbody tr')"
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1440]) {
      await browser.viewport(width, 960, false)
      await browser.evaluate(`localStorage.setItem('aisley-seller-theme', '${theme}')`)
      await browser.navigate('/orders/monitoring')
      await browser.waitText('ASL-20261015-4100')
      await browser.until("return document.querySelector('tbody .portal-product-thumbnail img')?.naturalWidth > 0", 'first product image loads')
      assert.equal(await browser.evaluate("return document.querySelector('tbody .portal-product-thumbnail img').alt"), 'Cedar storage basket')
      assert.ok(await browser.evaluate("return document.querySelectorAll('tbody .portal-product-thumbnail [aria-label=\"No product image\"]').length > 0"))
      await browser.assertNoHorizontalOverflow(`Order images ${width}px ${theme}`)
      assert.ok(await browser.evaluate("return [...document.querySelectorAll('tbody tr')].every(row => row.getBoundingClientRect().height <= 72)"), 'compact rows')
      await browser.screenshot(`order-images-${width}-${theme}.png`)
      // An unavailable image uses the same fallback as a missing image.
      await browser.evaluate("document.querySelector('tbody .portal-product-thumbnail img').dispatchEvent(new Event('error'))")
      await browser.until("return Boolean(document.querySelector('tbody tr .portal-product-thumbnail [aria-label=\"No product image\"]'))", 'broken image fallback')

      await browser.navigate('/orders/pickup')
      await browser.waitText('View parcels')
      const rows = await browser.evaluate(`return [...${pickupRows}].map(row => row.innerText)`)
      assert.ok(rows[0].includes('Request') && !rows[0].includes('Scheduled'))
      assert.ok(rows[1].includes('Scheduled'))
      assert.ok(rows[3].includes('Partially picked up'))
      assert.ok(rows[4].includes('Picked up') && rows[4].includes('2026'))
      await browser.evaluate("document.getElementById('pickup-requests-title').scrollIntoView({ block: 'start' })")
      await browser.assertNoHorizontalOverflow(`Pickup statuses ${width}px ${theme}`)
      await browser.screenshot(`pickup-status-${width}-${theme}.png`)
      await browser.evaluate("window.orderFixture.pickups[0].collection_status = 'picked_up'; document.dispatchEvent(new Event('visibilitychange'))")
      await browser.until(`return ${pickupRows}[0]?.innerText.includes('Picked up')`, 'pickup collection updates after refetch')
      await browser.clickText('View parcels')
      await browser.waitText('Orders in this pickup')
      await browser.until("return document.querySelector('[aria-label=\"Pickup request summary\"]')?.innerText.includes('Picked up')", 'detail uses collection status')
    }
  }
  assert.deepEqual(browser.errors, [])
  console.log('Order thumbnails, missing/broken image fallback, pickup collection status, refetch and detail passed in 8 responsive/theme states.')
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
