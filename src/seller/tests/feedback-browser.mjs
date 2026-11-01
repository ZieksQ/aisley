import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { openBrowser, closeBrowser, captureResponsive, sellerRoot, origin, artifacts, pressKey } from './operations/support.mjs'
import { installOperationsFixtures } from './operations/fixtures.mjs'
import { installFeedbackFixtures } from './feedback-fixtures.mjs'

const preview = spawn(process.execPath, [resolve(sellerRoot, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', new URL(origin).port, '--strictPort'], { cwd: sellerRoot, stdio: 'pipe' })
let browser
try {
  const deadline = Date.now() + 25000
  let ready = false
  while (!ready && Date.now() < deadline) {
    try { ready = (await fetch(origin)).ok } catch { await new Promise(done => setTimeout(done, 200)) }
  }
  assert.ok(ready, 'Seller preview starts')
  browser = await openBrowser()
  await browser.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installOperationsFixtures.toString()})(); (${installFeedbackFixtures.toString()})(); localStorage.setItem('aisley-seller-theme', localStorage.getItem('aisley-seller-theme') || 'light');` })
  await browser.navigate('/product-questions')
  await browser.waitText('30 cm deep')
  for (const page of [
    { route: '/product-questions', expected: '30 cm deep', prefix: 'questions-list' },
    { route: '/reviews', expected: 'The weave is sturdy', prefix: 'reviews-list' },
    { route: '/products/product-1/questions/question-1', expected: 'Write an official answer', prefix: 'question-detail' },
    { route: '/reviews/review-1', expected: 'Write an official Shop response', prefix: 'review-detail' },
  ]) await captureResponsive(browser, page)

  await browser.navigate('/product-questions')
  await browser.waitText('30 cm deep')
  const region = await browser.evaluate("return document.querySelector('[role=region][aria-label=\"Product questions\"]')?.getAttribute('tabindex')")
  assert.equal(region, '0', 'Feedback table scroll region is keyboard reachable')
  await pressKey(browser, 'Tab')
  await browser.evaluate("document.querySelector('[aria-label=\"Refresh product questions\"]').focus()")
  assert.equal(await browser.evaluate("return document.activeElement.matches(':focus-visible')"), true, 'Keyboard focus remains visible')
  await browser.setField('Filter by answer state', 'answered')
  await browser.waitText('No product questions match this view.')
  await browser.setField('Filter by answer state', 'all')
  await browser.waitText('30 cm deep')
  await browser.setField('Search by product', 'unmatched')
  await browser.clickText('Search')
  await browser.waitText('No product questions match this view.')
  await browser.navigate('/reviews')
  await browser.waitText('The weave is sturdy')
  await browser.setField('Rating', '1')
  await browser.waitText('No reviews match these filters.')
  await browser.setField('Rating', '')
  await browser.waitText('The weave is sturdy')
  for (const route of ['/product-questions', '/reviews']) {
    await browser.navigate(route)
    await browser.waitText('Cedar Storage Basket')
    await browser.evaluate("window.feedbackFixture.mode = 'error'")
    await browser.clickText('Refresh')
    await browser.waitText('Feedback service is unavailable.')
    assert.equal(await browser.evaluate("return Boolean(document.querySelector('tbody'))"), false)
    await browser.evaluate("window.feedbackFixture.mode = 'loading'")
    await browser.clickText('Try again')
    await browser.until("return Boolean(document.querySelector('[role=status][aria-busy=true]'))", 'Feedback loading skeleton')
    await browser.waitText('Cedar Storage Basket')
  }
  for (const [route, field, submit, text] of [
    ['/products/product-1/questions/question-1', 'Answer', 'Publish answer', 'The basket is 28 cm deep and fits your shelf.'],
    ['/reviews/review-1', 'Response', 'Publish response', 'Thank you for sharing how the basket fits your shelves.'],
  ]) {
    await browser.navigate(route)
    await browser.waitText(submit)
    await browser.setField(field, text)
    await browser.clickText(submit)
    await browser.waitText('read-only')
    assert.equal(await browser.evaluate('return window.feedbackFixture.writes.length'), 1)
    assert.match(await browser.evaluate('return window.feedbackFixture.writes[0].key'), /^[0-9a-f-]{36}$/i)
    assert.equal(await browser.evaluate('return Boolean(document.querySelector("textarea"))'), false)
  }
  assert.deepEqual(browser.errors, [])
  console.log(JSON.stringify({ result: 'Seller feedback responsive, filtering, recovery, and publication checks passed', artifacts, pressKey }))
} finally {
  if (browser) await closeBrowser(browser)
  preview.kill()
}
