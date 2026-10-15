import assert from 'node:assert/strict'
import { captureResponsive } from './support.mjs'

const endpoint = '/api/v1/seller/low-stock-alerts'
const ids = {
  active: '31000000-0000-4000-8000-000000000001',
  resolved: '31000000-0000-4000-8000-000000000002',
  archived: '31000000-0000-4000-8000-000000000003',
  activeSku: '21000000-0000-4000-8000-000000000002',
}

export async function reviewLowStockAlerts(browser) {
  await browser.cdp('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Manila' })
  await browser.setNextModes({ alerts: 'loading' })
  await browser.navigate('/low-stock-alerts')
  await browser.waitForStatus('Loading alerts…')
  assert.equal(await browser.evaluate("return [...document.querySelectorAll('button')].find(item => item.getAttribute('aria-label') === 'Refresh alerts')?.disabled"), true, 'Refresh is disabled while alert history loads')
  await browser.waitText('Olive Oil Set')
  await browser.waitForRequest((item) => item.path === endpoint && item.method === 'GET', 'initial alert history')
  const region = await browser.evaluate("return Boolean(document.querySelector('[role=region][aria-label=\"Low-stock alert history\"]'))")
  assert.ok(region, 'Alert history is in a named, keyboard-focusable table region')
  assert.equal(await browser.evaluate("return document.querySelector('[role=region][aria-label=\"Low-stock alert history\"]')?.getAttribute('tabindex')"), '0')
  assert.match(await browser.evaluate("return document.querySelector('caption')?.innerText ?? ''"), /Asia\/Manila/)
  await browser.viewport(320, 760, false)
  const scrollRegion = await browser.evaluate("return (() => { const region = document.querySelector('[role=region][aria-label=\"Low-stock alert history\"]'); return region && { client: region.clientWidth, content: region.scrollWidth } })()")
  assert.ok(scrollRegion && scrollRegion.content > scrollRegion.client, `Alert table remains navigable in a local horizontal scroller at 320px: ${JSON.stringify(scrollRegion)}`)
  await browser.assertNoHorizontalOverflow('Low-stock alert table at 320px')

  // Let the earlier query respond after the later one to exercise stale-read
  // protection in the page rather than only checking for an AbortController.
  await browser.setMode('alerts', 'delay-search')
  await browser.setField('Search product or SKU', 'Blue')
  await browser.clickText('Search')
  await browser.waitForRequest((item) => item.path === endpoint && new URLSearchParams(item.query).get('search') === 'Blue', 'delayed earlier alert search')
  await browser.setField('Search product or SKU', 'Olive')
  await browser.clickText('Search')
  await browser.waitText('Olive Oil Set')
  await new Promise((done) => setTimeout(done, 750))
  await browser.until("return !document.querySelector('tbody')?.innerText.includes('Blue Glaze Mug')", 'stale alert read does not replace current search')
  assert.equal(await browser.evaluate("return document.querySelector('tbody')?.innerText.includes('Blue Glaze Mug') ?? false"), false, 'Only the newest alert search is visible')

  await browser.setField('Alert state', 'active')
  await browser.setField('From date', '2026-10-14')
  await browser.setField('To date', '2026-10-15')
  await browser.clickText('Search')
  await browser.until("(() => { const query = new URLSearchParams(window.operationsFixture.requests.filter(item => item.path === '/api/v1/seller/low-stock-alerts').at(-1)?.query ?? ''); return query.get('search') === 'Olive' && query.get('state') === 'active' && query.get('from') === '2026-10-14' && query.get('to') === '2026-10-15' })()", 'alert search, state and date filters are sent')
  const filtered = await browser.evaluate("return document.querySelector('[role=region][aria-label=\"Low-stock alert history\"] tbody')?.innerText ?? ''")
  assert.match(filtered, /Olive Oil Set/)
  assert.doesNotMatch(filtered, /Blue Glaze Mug|Linen Gift Set/)

  await browser.setField('Search product or SKU', '')
  await browser.setField('Alert state', '')
  await browser.setField('From date', '')
  await browser.setField('To date', '')
  await browser.clickText('Search')
  await browser.waitText('Blue Glaze Mug')
  await browser.clickText('Next')
  await browser.waitText('Linen Gift Set')
  await browser.clickText('Previous')

  await browser.setMode('alerts', 'empty')
  await browser.clickName('Refresh alerts')
  await browser.waitText('No alert thresholds configured')
  assert.ok(await browser.evaluate("return [...document.querySelectorAll('a')].some(item => item.innerText.trim() === 'Open inventory')"), 'Threshold-free empty state links back to inventory')
  await browser.setMode('alerts', 'normal')
  await browser.setField('Search product or SKU', 'No such SKU')
  await browser.clickText('Search')
  await browser.waitText('No alerts match this view')
  assert.doesNotMatch(await browser.evaluate("return document.body.innerText"), /No alert thresholds configured/)
  await browser.setField('Search product or SKU', '')
  await browser.clickText('Search')
  await browser.waitText('Olive Oil Set')

  await browser.navigate(`/low-stock-alerts/${ids.active}`)
  await browser.waitText('Active alert')
  await browser.waitText('Latest available')
  await browser.waitText('Latest threshold')
  await browser.waitText('Open SKU inventory')
  const activeSnapshot = await browser.evaluate("return [...document.querySelectorAll('.alert-data-strip dt')].map((node, index) => [node.innerText, node.parentElement.querySelector('dd')?.innerText])")
  assert.deepEqual(activeSnapshot.slice(0, 2), [['Latest available', '4'], ['Latest threshold', '4']], 'Alert details show current snapshots separately from trigger snapshots')
  const triggerDate = await browser.evaluate("return [...document.querySelectorAll('dt')].find(node => node.innerText.includes('Triggered'))?.parentElement.querySelector('dd')?.innerText ?? ''")
  assert.match(triggerDate, /10:15\s*AM/i, `UTC trigger time is presented in Asia/Manila: ${triggerDate}`)
  assert.equal(await browser.evaluate("return [...document.querySelectorAll('a')].find(item => item.innerText.trim() === 'Open SKU inventory')?.getAttribute('href')"), `/inventory/${ids.activeSku}`, 'Alert detail links to the exact inventory SKU')

  await browser.navigate(`/low-stock-alerts/${ids.resolved}`)
  await browser.waitText('Resolved')
  await browser.waitText('Stock recovered above the threshold. This alert remains in history.')
  await browser.waitText('Resolved · Asia/Manila')
  assert.equal(await browser.evaluate("return Boolean(document.querySelector('main form'))"), false, 'Alert detail is historical and has no mutation form')

  await browser.setNextModes({ alertDetail: 'error' })
  await browser.navigate(`/low-stock-alerts/${ids.archived}`)
  await browser.waitText('This alert could not be loaded.')
  await browser.setMode('alertDetail', 'normal')
  await browser.clickText('Try again')
  await browser.waitText('Linen Gift Set')
  await browser.waitText('This alert remains in history.')
  assert.deepEqual(await browser.evaluate('return window.operationsFixture.unhandled'), [], 'All alert reads stay within the synthetic API fixture')

  await captureResponsive(browser, { route: '/low-stock-alerts', expected: 'Olive Oil Set', prefix: 'alerts-list' })
  await captureResponsive(browser, { route: `/low-stock-alerts/${ids.active}`, expected: 'Active alert', prefix: 'alert-detail' })
  await browser.navigate(`/low-stock-alerts/${ids.resolved}`)
  await browser.waitText('Resolved')
  await browser.screenshot('alert-detail-resolved-390-light.png')
  return { screenshots: ['alerts-list-*.png', 'alert-detail-*.png', 'alert-detail-resolved-390-light.png'] }
}
