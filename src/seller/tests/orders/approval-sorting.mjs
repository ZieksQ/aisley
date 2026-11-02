import assert from 'node:assert/strict'

export async function verifyApprovalSorting(browser) {
  const options = ['oldest', 'newest', 'activity_desc', 'amount_high', 'amount_low']
  const checked = "document.querySelector('dialog input:checked')?.value"
  const escape = () => browser.cdp('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27,
  })
  const openSort = async () => {
    await browser.clickText('Sort')
    await browser.until("return document.querySelector('dialog')?.open", 'approval sort dialog')
  }
  const settled = (sort) => browser.until(`return location.search.includes('sort=${sort}') &&
    !new URLSearchParams(location.search).has('page') && !document.querySelector('dialog') &&
    document.querySelector('section[aria-labelledby=approval-queue-title]')?.getAttribute('aria-busy') === 'false'`, 'approval sort settles')

  await browser.navigate('/orders/approval?page=2')
  await browser.waitText('Review order')
  await openSort()
  assert.deepEqual(await browser.evaluate("return [...document.querySelectorAll('dialog input[type=radio]')].map(input => input.value)"), options)
  assert.equal(await browser.evaluate(`return ${checked}`), 'oldest')
  await browser.evaluate("document.querySelector('input[value=newest]').click()")
  await browser.clickText('Cancel')
  assert.equal(await browser.evaluate('return location.search'), '?page=2')
  await openSort()
  assert.equal(await browser.evaluate(`return ${checked}`), 'oldest')
  await escape()

  for (const sort of options) {
    await openSort()
    await browser.evaluate(`document.querySelector('input[value=${sort}]').click()`)
    await browser.clickText('Apply sort')
    await settled(sort)
    assert.equal(await browser.evaluate("return document.activeElement?.textContent.trim()"), 'Sort')
    const query = await browser.evaluate("return window.orderFixture.requests.filter(item => item.path === '/api/v1/seller/orders').at(-1).query")
    const params = new URLSearchParams(query)
    assert.equal(params.get('sort'), sort)
    assert.equal(params.get('status'), 'placed')
    assert.equal(params.get('page'), '1')
  }
  await browser.evaluate('history.back()')
  await settled('amount_high')
  await browser.evaluate('history.forward()')
  await settled('amount_low')
  await browser.cdp('Page.reload')
  await browser.waitText('Review order')
  await openSort()
  assert.equal(await browser.evaluate(`return ${checked}`), 'amount_low')
  await escape()
  await browser.navigate('/orders/approval?sort=unsafe')
  await browser.waitText('Review order')
  await openSort()
  assert.equal(await browser.evaluate(`return ${checked}`), 'oldest')
  const fallbackQuery = await browser.evaluate("return window.orderFixture.requests.find(item => item.path === '/api/v1/seller/orders').query")
  assert.equal(new URLSearchParams(fallbackQuery).get('sort'), 'oldest')
  await escape()

  for (const theme of ['light', 'dark']) {
    for (const width of [320, 768, 1440]) {
      await browser.viewport(width, 960, false)
      await browser.evaluate(`localStorage.setItem('aisley-seller-theme', '${theme}')`)
      await browser.navigate('/orders/approval?sort=newest')
      await browser.waitText('Review order')
      await openSort()
      assert.equal(await browser.evaluate(`return ${checked}`), 'newest')
      assert.equal(await browser.evaluate("return document.documentElement.classList.contains('dark')"), theme === 'dark')
      await browser.assertNoHorizontalOverflow(`Approval sort ${width}px ${theme}`)
      assert.equal(await browser.evaluate(`return (() => {
        const dialog = document.querySelector('dialog').getBoundingClientRect();
        return dialog.top >= 0 && dialog.bottom <= innerHeight && dialog.left >= 0 && dialog.right <= innerWidth;
      })()`), true)
      await browser.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      assert.equal(await browser.evaluate("return document.querySelector('dialog').contains(document.activeElement)"), true)
      await browser.screenshot(`approval-sort-${width}-${theme}.png`)
      await escape()
      await browser.until("return !document.querySelector('dialog')", 'sort Escape closes')
      assert.equal(await browser.evaluate("return document.activeElement?.textContent.trim()"), 'Sort')
    }
  }
  console.log('Approval sort options, requests, pagination, history, reload, fallback and responsive dialogs passed.')
}
