import assert from 'node:assert/strict'
import { captureResponsive, pressKey } from './support.mjs'

const endpoint = '/api/v1/seller/vouchers'
const ids = {
  active: '41000000-0000-4000-8000-000000000001',
  draft: '41000000-0000-4000-8000-000000000002',
  created: '41000000-0000-4000-8000-000000000003',
}

export async function reviewVouchers(browser) {
  await browser.viewport(1440, 960, false)
  await browser.cdp('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Manila' })
  await browser.navigate('/vouchers/new')
  await browser.waitText('Create voucher')
  await browser.setField('Voucher name', 'Unsaved route guard check')
  await browser.clickText('Vouchers', 'document.querySelector("nav.portal-nav")')
  await browser.waitText('Discard unsaved voucher input?')
  assert.equal(await browser.evaluate("return document.querySelector('dialog')?.open === true"), true, 'Leaving dirty voucher terms opens the route discard confirmation')
  await pressKey(browser, 'Escape')
  await browser.until("return !document.querySelector('dialog')", 'Escape cancels voucher navigation')
  assert.equal(await browser.evaluate("return document.querySelector('#voucher-name')?.value"), 'Unsaved route guard check', 'Canceling navigation preserves the complete editor state')
  assert.equal(await browser.evaluate("return document.activeElement?.getAttribute('href') === '/vouchers'"), true, 'Canceling navigation restores focus to its Seller navigation link')
  await browser.clickText('Vouchers', 'document.querySelector("nav.portal-nav")')
  await browser.waitText('Discard unsaved voucher input?')
  await browser.clickText('Discard input', 'document.querySelector("dialog")')
  await browser.until("return location.pathname === '/vouchers'", 'confirmed voucher discard navigates to the list')
  await browser.waitText('Harvest weekend savings')

  await browser.setNextModes({ voucherList: 'loading' })
  await browser.navigate('/vouchers')
  await browser.waitText('Loading vouchers…')
  await browser.waitText('Vouchers')
  await browser.waitText('Harvest weekend savings')
  await browser.waitForRequest((item) => item.path === endpoint && item.method === 'GET', 'voucher list')
  const table = await browser.evaluate("return Boolean(document.querySelector('[role=region][aria-label=\"Voucher list\"]'))")
  assert.ok(table, 'Voucher table is a named, keyboard-focusable region')
  assert.equal(await browser.evaluate("return document.querySelector('[role=region][aria-label=\"Voucher list\"]')?.getAttribute('tabindex')"), '0')
  assert.match(await browser.evaluate("return document.querySelector('caption')?.innerText ?? ''"), /Asia\/Manila/)
  await browser.viewport(320, 760, false)
  const scrollRegion = await browser.evaluate("return (() => { const region = document.querySelector('[role=region][aria-label=\"Voucher list\"]'); return region && { client: region.clientWidth, content: region.scrollWidth } })()")
  assert.ok(scrollRegion && scrollRegion.content > scrollRegion.client, `Voucher table columns stay in their own scroll region at 320px: ${JSON.stringify(scrollRegion)}`)
  await browser.assertNoHorizontalOverflow('Voucher list at 320px')

  await browser.setField('Search name or code', 'First basket')
  await browser.setField('Status', 'draft')
  await browser.setField('Benefit', 'discount')
  await browser.clickText('Search')
  await browser.waitText('First basket thank-you')
  await browser.until("(() => { const query = new URLSearchParams(window.operationsFixture.requests.filter(item => item.path === '/api/v1/seller/vouchers').at(-1)?.query ?? ''); return query.get('search') === 'First basket' && query.get('status') === 'draft' && query.get('benefit') === 'discount' })()", 'voucher list filters are sent')
  assert.equal(await browser.evaluate("return document.querySelectorAll('[role=region][aria-label=\"Voucher list\"] tbody tr').length"), 1, 'Combined voucher filters narrow the list')

  await browser.setMode('voucherList', 'empty')
  await browser.setField('Search name or code', 'No matching voucher')
  await browser.clickText('Search')
  await browser.waitText('No vouchers match these filters.')
  await browser.setMode('voucherList', 'error')
  await browser.setField('Search name or code', 'Still no matching voucher')
  await browser.clickText('Search')
  await browser.waitText('Voucher service is unavailable.')
  await browser.setMode('voucherList', 'normal')
  await browser.clickText('Retry loading')
  await browser.waitText('No vouchers match these filters.')
  await browser.setField('Search name or code', 'First basket')
  await browser.setField('Status', 'draft')
  await browser.setField('Benefit', 'discount')
  await browser.clickText('Search')
  await browser.waitText('First basket thank-you')

  // Editing an existing draft after a conflict must use the refreshed
  // revision while keeping the seller's unsaved text and voucher identity.
  await browser.clickText('First basket thank-you')
  await browser.waitText('Draft terms')
  await browser.waitForRequest((item) => item.path === `${endpoint}/${ids.draft}`, 'draft detail')
  await browser.clickText('Edit draft')
  await browser.waitText('Edit voucher draft')
  await browser.setField('Voucher name', 'First basket thank-you revised')
  await browser.setMode('voucherWrite', 'conflict')
  await browser.clickText('Save draft')
  await browser.waitText('The voucher changed in another session.')
  assert.equal(await browser.evaluate("return document.querySelector('#voucher-name')?.value"), 'First basket thank-you revised', 'Revision conflict preserves the seller draft input')
  const draftReadsBeforeRefresh = (await browser.requests()).filter((item) => item.path === `${endpoint}/${ids.draft}` && item.method === 'GET').length
  await browser.clickText('Reload latest revision')
  await browser.until(`return window.operationsFixture.requests.filter(item => item.path === '${endpoint}/${ids.draft}' && item.method === 'GET').length > ${draftReadsBeforeRefresh}`, 'latest draft revision reload')
  await new Promise((done) => setTimeout(done, 100))
  await browser.waitText('Edit voucher draft')
  await browser.clickText('Save draft')
  const revisionedSave = await browser.waitForRequest((item) => item.path === `${endpoint}/${ids.draft}/draft` && item.method === 'PUT' && item.body?.revision === 3, 'save against refreshed voucher revision')
  const saves = revisionedSave.filter((item) => item.path === `${endpoint}/${ids.draft}/draft` && item.method === 'PUT')
  assert.deepEqual(saves.map((item) => item.body.revision), [2, 3], 'Draft retry after refresh advances only the expected revision')
  await browser.waitText('Draft saved. Published terms remain in effect until publication.')
  await browser.waitText('First basket thank-you revised')

  // Create a complete Shop-only voucher, first exercise recoverable validation,
  // then simulate an unconfirmed write and verify byte-equivalent retry data.
  await browser.navigate('/vouchers/new')
  await browser.waitText('Create voucher')
  assert.equal(await browser.evaluate("return Boolean(document.querySelector('#voucher-distribution_mode'))"), false, 'Seller authoring cannot choose platform-wide distribution')
  const benefitOptions = await browser.evaluate("return [...document.querySelector('#voucher-benefit_type').options].map(option => option.value)")
  assert.deepEqual(benefitOptions, ['discount'], 'Seller authoring supports Shop merchandise discounts only')
  assert.match(await browser.evaluate('return document.body.innerText'), /Your Shop funds this discount/)
  const fields = {
    'Voucher name': 'October market thank-you',
    Code: 'OCT-MARKET',
    Benefit: 'discount',
    'Saving type': 'percent',
    Percentage: '12.50',
    'Savings cap (PHP, optional)': '175.00',
    'Minimum Shop merchandise spend (PHP)': '750.00',
    Starts: '2026-10-20T10:30',
    Ends: '2026-10-31T23:15',
    'Total redemptions (optional)': '240',
    'Redemptions per Customer': '2',
    'Plain-text terms': 'Valid for eligible Cedar Home goods during the posted dates.',
  }
  for (const [label, value] of Object.entries(fields)) await browser.setField(label, value)
  await browser.setMode('voucherWrite', 'error')
  await browser.clickText('Save draft')
  await browser.waitText('Voucher could not be saved.')
  assert.equal(await browser.evaluate("return document.querySelector('#voucher-name')?.value"), fields['Voucher name'], 'Recoverable save failure preserves the complete editor')
  await browser.setMode('voucherWrite', 'uncertain-once')
  await browser.clickText('Save draft')
  await browser.waitText('Retry this exact request')
  const firstCreate = await browser.waitForRequest((item) => item.path === endpoint && item.method === 'POST' && item.body?.name === fields['Voucher name'], 'create voucher request')
  const originalCreate = firstCreate.findLast((item) => item.path === endpoint && item.method === 'POST' && item.body?.name === fields['Voucher name'])
  assert.ok(originalCreate.headers['idempotency-key'], 'Voucher creation sends an idempotency key')
  assert.equal(originalCreate.body.starts_at, '2026-10-20T02:30:00.000Z', 'Manila start time converts to the corresponding UTC instant')
  assert.equal(originalCreate.body.ends_at, '2026-10-31T15:15:00.000Z', 'Manila end time converts to the corresponding UTC instant')
  assert.equal(originalCreate.body.revision, 0)
  assert.equal(originalCreate.body.currency, 'PHP')
  assert.equal(originalCreate.body.payment_method, 'cod')
  assert.equal(originalCreate.body.distribution_mode, undefined, 'No platform-wide distribution mode leaks into seller payload')
  assert.equal(originalCreate.body.eligibility_rules, undefined, 'No buyer-targeting rules leak into the Shop voucher request')
  assert.equal(originalCreate.body.benefit_type, 'discount')
  assert.equal(originalCreate.body.value_type, 'percent')
  assert.equal(originalCreate.body.value, '12.50')
  assert.equal(originalCreate.body.maximum_discount, '175.00')
  assert.equal(originalCreate.body.minimum_spend, '750.00')
  assert.equal(originalCreate.body.global_limit, 240)
  assert.equal(originalCreate.body.per_customer_limit, 2)
  assert.equal(originalCreate.body.terms_summary, fields['Plain-text terms'])
  await browser.clickText('Retry exact request')
  await browser.until(`return window.operationsFixture.requests.filter(item => item.path === '${endpoint}' && item.method === 'POST' && item.body?.name === '${fields['Voucher name']}').length === 3`, 'second create attempt after validation and uncertain response')
  const createAttempts = await browser.evaluate(`return window.operationsFixture.requests.filter(item => item.path === '${endpoint}' && item.method === 'POST' && item.body?.name === '${fields['Voucher name']}')`)
  assert.equal(createAttempts.length, 3, 'Validation failure plus uncertain request and retry produce three attempts')
  assert.deepEqual(createAttempts[1].body, createAttempts[2].body, 'Retry uses the exact original voucher terms and revision')
  assert.equal(createAttempts[1].headers['idempotency-key'], createAttempts[2].headers['idempotency-key'], 'Retry preserves the original idempotency key')
  await browser.waitText('October market thank-you')
  assert.equal(await browser.evaluate("return window.operationsFixture.vouchers.filter(item => item.id === '41000000-0000-4000-8000-000000000003').length"), 1, 'Uncertain create retry resolves to one draft identity')

  await browser.clickText('Publish draft')
  await browser.waitText('Publish voucher')
  const confirmation = await browser.evaluate("return document.querySelector('dialog')?.innerText ?? ''")
  assert.match(confirmation, /12\.50% merchandise discount/)
  assert.match(confirmation, /Oct 20, 2026, 10:30 AM/i, 'Publish confirmation renders the scheduled start in Manila time')
  assert.match(confirmation, /Oct 31, 2026, 11:15 PM/i, 'Publish confirmation renders the scheduled end in Manila time')
  assert.match(confirmation, /exact terms/i)
  assert.equal(await browser.evaluate("return document.activeElement?.closest('dialog') !== null"), true, 'Publish confirmation contains keyboard focus')
  await browser.clickText('Publish')
  const publishRequest = await browser.waitForRequest((item) => item.path === `${endpoint}/${ids.created}/publish` && item.method === 'POST', 'revisioned Shop voucher publication')
  assert.deepEqual(publishRequest.findLast((item) => item.path === `${endpoint}/${ids.created}/publish`).body, { revision: 1 }, 'Create response revision is used for publication')
  await browser.waitText('Voucher published.')
  await browser.waitText('Published terms')
  assert.match(await browser.evaluate("return document.body.innerText"), /12\.50%/)
  await browser.waitText('Scheduled')

  await browser.navigate(`/vouchers/${ids.active}`)
  await browser.waitText('Harvest weekend savings')
  await browser.clickText('Pause')
  await browser.waitText('Pause voucher')
  await browser.clickText('Pause', 'document.querySelector("dialog")')
  const pauseRequest = await browser.waitForRequest((item) => item.path === `${endpoint}/${ids.active}/pause` && item.method === 'POST', 'pause voucher action')
  assert.deepEqual(pauseRequest.findLast((item) => item.path === `${endpoint}/${ids.active}/pause`).body, { revision: 4 }, 'Pause uses the latest published revision')
  await browser.waitText('Voucher paused.')
  await browser.waitText('Paused')
  await browser.clickText('Resume')
  await browser.waitText('Resume voucher')
  await browser.clickText('Resume', 'document.querySelector("dialog")')
  const resumeRequest = await browser.waitForRequest((item) => item.path === `${endpoint}/${ids.active}/resume` && item.method === 'POST', 'resume voucher action')
  assert.deepEqual(resumeRequest.findLast((item) => item.path === `${endpoint}/${ids.active}/resume`).body, { revision: 5 }, 'Resume uses the revision returned by pause')
  await browser.waitText('Voucher resumed.')
  await browser.waitText('Active')
  await browser.clickText('Actions')
  await browser.waitText('No actions yet.')

  assert.deepEqual(await browser.evaluate('return window.operationsFixture.unhandled'), [], 'All voucher requests and retries are synthetic; no live API call was attempted')
  await captureResponsive(browser, { route: '/vouchers', expected: 'Harvest weekend savings', prefix: 'vouchers-list' })
  await captureResponsive(browser, { route: '/vouchers/new', expected: 'Create voucher', prefix: 'vouchers-editor' })
  await captureResponsive(browser, { route: `/vouchers/${ids.draft}`, expected: 'First basket thank-you', prefix: 'vouchers-detail' })
  await browser.navigate(`/vouchers/${ids.active}`)
  await browser.waitText('Harvest weekend savings')
  await browser.screenshot('vouchers-detail-active-390-light.png')
  return { screenshots: ['vouchers-list-*.png', 'vouchers-editor-*.png', 'vouchers-detail-*.png', 'vouchers-detail-active-390-light.png'] }
}
