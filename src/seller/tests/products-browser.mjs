// Real Chromium against the Seller SPA with synthetic HTTP only. Start `pnpm --filter seller dev -- --host 127.0.0.1 --port 15174` first.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { installProductFixtures } from './product-fixtures.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const sellerRoot = resolve(repoRoot, 'src/seller')
const artifacts = resolve(repoRoot, 'node_modules/.cache/seller-products')
await mkdir(artifacts, { recursive: true })
const driverPath = resolve(artifacts, 'chat-browser-driver.mjs')
const driverSource = (await readFile(resolve(repoRoot, 'packages/ui/tests/chat-browser-driver.mjs'), 'utf8'))
  .replace('node_modules/.cache/messages-ui', 'node_modules/.cache/seller-products/browser')
  .replace('.next/mu', '.next/pb')
await writeFile(driverPath, driverSource)
const { openChatBrowser } = await import(pathToFileURL(driverPath))
const origin = process.env.SELLER_PRODUCTS_ORIGIN ?? 'http://127.0.0.1:15174'
const preview = process.argv.includes('--serve') ? spawn(process.execPath, [resolve(sellerRoot, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '15174', '--strictPort'], { cwd: sellerRoot, stdio: ['ignore', 'ignore', 'pipe'] }) : null
if (preview) {
  let ready = false
  const deadline = Date.now() + 20000
  while (!ready && Date.now() < deadline) {
    try { ready = (await fetch(origin)).ok } catch { await new Promise((done) => setTimeout(done, 200)) }
  }
  if (!ready) { preview.kill(); throw new Error('Seller preview did not start on 127.0.0.1:15174') }
}
const browser = await openChatBrowser()
const { cdp, screenshot } = browser
const evaluate = (expression) => browser.evaluate(expression.startsWith('return ') ? `(() => (${expression.slice(7)}))()` : expression)
const until = async (expression, label, timeout = 90000) => {
  const check = expression.startsWith('return ') ? `(() => (${expression.slice(7)}))()` : expression
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(check)) return
    await new Promise((done) => setTimeout(done, 200))
  }
  throw new Error(`Timed out: ${label}; ${JSON.stringify(browser.errors)}`)
}
const selectorEscape = (value) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
async function clickText(text, root = 'document') {
  const safe = selectorEscape(text)
  const clicked = await evaluate(`(() => { const root = ${root}; const node = [...root.querySelectorAll('button,a')].find((item) => item.innerText.trim() === '${safe}' || item.getAttribute('aria-label') === '${safe}' || item.title === '${safe}'); if (!node) return false; node.click(); return true })()`)
  assert.equal(clicked, true, `Could not find clickable control: ${text}`)
}
async function setInput(label, value) {
  const safe = selectorEscape(label)
  const found = await evaluate(`(() => { const node = [...document.querySelectorAll('input,textarea,select')].find((item) => item.getAttribute('aria-label') === '${safe}' || item.labels?.[0]?.innerText.includes('${safe}')); if (!node) return false; const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value').set; setter.call(node, '${selectorEscape(value)}'); node.dispatchEvent(new Event('input', { bubbles: true })); node.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  assert.equal(found, true, `Could not find field: ${label}`)
}
async function waitText(text) {
  try { await until(`return document.body?.innerText.includes('${selectorEscape(text)}')`, text) }
  catch (cause) {
    console.error('Browser wait diagnostic:', await evaluate(`JSON.stringify({ url: location.href, ready: document.readyState, body: document.body?.innerText.slice(0, 1200), html: document.body?.innerHTML.slice(0, 1500), fixture: Boolean(window.productFixture), requests: window.productFixture?.requests, errors: window.productFixture?.reads })`), browser.errors)
    throw cause
  }
}
async function clickRowAction(product, pattern) {
  const found = await evaluate(`(() => { const row = [...document.querySelectorAll('tr,[role="row"]')].find(item => item.innerText.includes('${selectorEscape(product)}')); const action = row && [...row.querySelectorAll('button,a')].find(item => /${pattern}/i.test([item.innerText, item.getAttribute('aria-label'), item.title].join(' '))); if (!action) return false; action.click(); return true })()`)
  assert.equal(found, true, `Could not find ${pattern} action for ${product}`)
}
async function selectSyntheticImage(name) {
  const selected = await evaluate(`(() => { const input = document.querySelector('input[type="file"][aria-label="Add gallery images"]'); if (!input) return false; const data = new DataTransfer(); data.items.add(new File(['synthetic image bytes'], '${selectorEscape(name)}', { type: 'image/png' })); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set.call(input, data.files); input.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  assert.equal(selected, true, 'Gallery image input exists')
}

try {
  const basketSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#eee7db"/><path d="M15 30h50l-5 38H20z" fill="#a98762"/></svg>'
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installProductFixtures.toString()})(); productFixture.products[0].gallery[0].url=${JSON.stringify(`data:image/svg+xml;base64,${Buffer.from(basketSvg).toString('base64')}`)}; productFixture.mode = 'list-loading'; localStorage.setItem('aisley-seller-theme', 'light');` })
  await browser.viewport(1280, 900, false)
  await browser.navigate(`${origin}/products?fixture=initial`)
  await waitText('Loading products')
  await waitText('Cedar Storage Basket')
  await evaluate(`productFixture.mode = 'normal'`)
  assert.equal(await evaluate(`return document.querySelectorAll('table img, [role="row"] img').length > 0`), true, 'Product rows should show thumbnail imagery')
  assert.equal(await evaluate(`return [...document.querySelectorAll('button,a')].some(node => node.getAttribute('aria-label') === 'Edit Cedar Storage Basket')`), true, 'Draft has an accessible edit action')
  await screenshot(`${artifacts}/products-list.png`)

  // Pagination is server driven and status controls retain the requested filter.
  const hasNext = await evaluate(`return [...document.querySelectorAll('button')].some(node => /next/i.test(node.getAttribute('aria-label') || node.innerText))`)
  if (hasNext) { await evaluate(`[...document.querySelectorAll('button')].find(node => /next/i.test(node.getAttribute('aria-label') || node.innerText)).click()`); await until('return productFixture.reads.some(read => new URLSearchParams(read.query).get("page") === "2")', 'page two request') }
  await evaluate(`productFixture.mode = 'list-delay'`)
  await setInput('Search products', 'ce')
  await setInput('Search products', 'Linen')
  await waitText('Linen Throw')
  await new Promise((done) => setTimeout(done, 650))
  assert.equal(await evaluate(`return !document.body.innerText.includes('Cedar Storage Basket')`), true, 'A stale search response must not replace the latest result')
  await evaluate(`productFixture.mode = 'normal'; productFixture.empty = true`)
  await clickText('Refresh products')
  await waitText('No products match this view')
  await clickText('Clear filters')
  await waitText('Your catalog starts here')
  await evaluate(`productFixture.empty = false; productFixture.mode = 'list-error'`)
  await clickText('Refresh products')
  await waitText('Products service is unavailable.')
  await evaluate(`productFixture.mode = 'normal'`)
  await clickText('Try again')
  await waitText('Cedar Storage Basket')
  await clickText('Archived')
  await waitText('Archived Tray')
  assert.equal(await evaluate(`return productFixture.reads.some(read => new URLSearchParams(read.query).get('status') === 'archived')`), true, 'Archived filter was not sent')

  // Draft publishing and active archiving are explicit actions; archived restore is confirmed.
  await clickText('All products')
  await waitText('Cedar Storage Basket')
  await clickRowAction('Cedar Storage Basket', 'publish')
  await until('return productFixture.writes.some(write => write.path.endsWith("/publish"))', 'publish endpoint')
  await clickRowAction('Linen Throw', 'archive')
  await waitText('Archive product?')
  await clickText('Archive product')
  await until('return productFixture.writes.some(write => write.path.endsWith("/archive"))', 'archive endpoint')
  await clickText('Archived')
  await waitText('Archived Tray')
  await clickRowAction('Archived Tray', 'unarchive')
  await waitText('Unarchive product?')
  assert.equal(await evaluate(`return document.activeElement !== document.body`), true, 'Opening the confirmation should move focus into the dialog')
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await until('return !document.body.innerText.includes("Unarchive product?")', 'Escape closes unarchive confirmation')
  assert.equal(await evaluate(`return productFixture.writes.some(write => write.path.endsWith('/unarchive'))`), false, 'Escape must not commit an action')

  // The create form accepts category, base inventory, packed measurements, gallery, variants and package inheritance.
  await browser.navigate(`${origin}/products/new`)
  await waitText('Add product')
  await until('return Boolean(document.querySelector("#product-name") && document.querySelector("#product-category option[value=category-home]"))', 'product fields and category options')
  await browser.viewport(390, 850, true)
  await clickText('Rich text')
  await until('return Boolean(document.querySelector(".seller-product-editor [class*=placeholder_]"))', 'description placeholder rendered at mobile width')
  const mobileCopy = await evaluate(`(() => { const editor = document.querySelector('.seller-product-editor'); const placeholder = editor?.querySelector('[class*="placeholder_"]'); const range = document.createRange(); if (placeholder?.firstChild) range.selectNodeContents(placeholder.firstChild); const button = [...document.querySelectorAll('#variants button')].find(node => node.innerText.includes('Add option')); const text = [...(button?.childNodes ?? [])].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()); const labelRange = document.createRange(); if (text) labelRange.selectNodeContents(text); return { editorRight: editor?.getBoundingClientRect().right, placeholderRight: placeholder?.getBoundingClientRect().right, placeholderLines: range.getClientRects().length, actionLabelLines: labelRange.getClientRects().length, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth } })()`)
  assert.ok(mobileCopy.placeholderLines >= 2, `Description placeholder should wrap across lines at 390px: ${JSON.stringify(mobileCopy)}`)
  assert.ok(mobileCopy.placeholderRight <= mobileCopy.editorRight + 1, `Description placeholder should remain inside the editor: ${JSON.stringify(mobileCopy)}`)
  assert.equal(mobileCopy.actionLabelLines, 1, `Add option label should stay on one line: ${JSON.stringify(mobileCopy)}`)
  assert.ok(mobileCopy.scrollWidth <= mobileCopy.viewport, `Product form should not overflow at 390px: ${JSON.stringify(mobileCopy)}`)
  await browser.viewport(1280, 900, false)
  await setInput('Product name', 'Browser Fixture Organizer')
  await setInput('Base SKU', 'ORG-01')
  await setInput('Base price (PHP)', '790.00')
  await setInput('Opening stock', '6')
  for (const [label, value] of [['Packed weight (g)', '600'], ['Length (mm)', '200'], ['Width (mm)', '150'], ['Height (mm)', '100']]) await setInput(label, value)
  const category = await evaluate(`return [...document.querySelectorAll('select')].find(node => node.labels?.[0]?.innerText.includes('Category'))?.outerHTML ?? ''`)
  if (category) await evaluate(`(() => { const node = [...document.querySelectorAll('select')].find(item => item.labels?.[0]?.innerText.includes('Category')); node.value = 'category-home'; node.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  await clickText('Add option')
  await setInput('Option 1 name', 'Color')
  await setInput('Color value 1', 'Natural')
  await clickText('Add variant')
  const variantSku = await evaluate(`return [...document.querySelectorAll('input')].find(node => node.getAttribute('aria-label')?.includes('SKU') && !node.getAttribute('aria-label')?.includes('Base'))?.getAttribute('aria-label')`)
  const variantStock = await evaluate(`return [...document.querySelectorAll('input')].find(node => node.getAttribute('aria-label')?.includes('opening stock'))?.getAttribute('aria-label')`)
  if (variantSku) await setInput(variantSku, 'ORG-01-NATURAL')
  if (variantStock) await setInput(variantStock, '3')
  await evaluate(`(() => { const label = [...document.querySelectorAll('label')].find(item => item.innerText.includes('Use different package')); const input = label?.querySelector('input'); if (!input) return false; input.click(); return input.checked })()`)
  for (const [label, value] of [['Color: Natural Packed weight in g', '650'], ['Color: Natural Length in mm', '210'], ['Color: Natural Width in mm', '160'], ['Color: Natural Height in mm', '105']]) await setInput(label, value)
  await evaluate(`(() => { const label = [...document.querySelectorAll('label')].find(item => item.innerText.includes('Use different package')); const input = label?.querySelector('input'); if (!input) return false; input.click(); return !input.checked })()`)
  await selectSyntheticImage('organizer-cover.png')
  await until('return productFixture.uploads.length === 1', 'first gallery upload request')
  await waitText('Uploading images…')
  assert.equal(await evaluate(`return document.querySelector('button[type="submit"]')?.disabled`), true, 'Saving stays disabled during an active upload')
  await waitText('organizer-cover.png')
  await until('return !document.querySelector("button[type=submit]")?.disabled', 'save enabled after completed upload')
  await selectSyntheticImage('organizer-detail.png')
  await until('return productFixture.uploads.length === 2', 'second gallery upload request')
  await waitText('organizer-detail.png')
  await clickText('Set default')
  await evaluate(`productFixture.uploadFailure = true`)
  await selectSyntheticImage('rejected-cover.png')
  await until('return productFixture.uploads.length === 3', 'rejected gallery upload request')
  await waitText('Synthetic image rejection.')
  assert.equal(await evaluate(`return !document.body.innerText.includes('rejected-cover.png')`), true, 'Rejected uploads must not enter the selected gallery')
  await screenshot(`${artifacts}/product-create.png`)
  const saveButton = await evaluate(`return [...document.querySelectorAll('button[type="submit"],button')].find(node => /save draft/i.test(node.innerText))?.innerText`)
  assert.ok(saveButton, 'Save draft control exists')
  await evaluate(`productFixture.mode = 'save-error'`)
  await clickText(saveButton)
  await waitText('Product name is already in use.')
  assert.equal(await evaluate(`return document.querySelector('#product-name')?.value === 'Browser Fixture Organizer'`), true, 'Server validation preserves form state')
  assert.equal(await evaluate(`return document.activeElement.id === 'product-name'`), true, 'Server validation moves focus to the first invalid field')
  await evaluate(`productFixture.mode = 'normal'`)
  await clickText(saveButton)
  await until('return productFixture.writes.some(write => write.method === "POST" && write.path === "/api/v1/seller/products")', 'create payload')
  const createPayload = await evaluate('return productFixture.writes.findLast(write => write.method === "POST" && write.path === "/api/v1/seller/products").body')
  assert.equal(createPayload.opening_stock, 6, 'Base opening stock is explicit')
  assert.equal(createPayload.shipping_weight_grams, 600)
  assert.equal(createPayload.variants[0].opening_stock, 3, 'New variant opening stock is explicit')
  assert.equal(createPayload.variants[0].price, null, 'Blank new variant price inherits the product price')
  for (const key of ['shipping_weight_grams', 'shipping_length_mm', 'shipping_width_mm', 'shipping_height_mm']) assert.equal(createPayload.variants[0][key], null, `${key} override cleared back to inherited package`)
  assert.equal(createPayload.gallery_upload_ids.length, 2, 'Only successful gallery uploads belong in the save')
  assert.equal(createPayload.default_gallery_upload_id, await evaluate('return productFixture.uploads[1].id'), 'Seller-selected gallery default is preserved')
  assert.deepEqual(createPayload.gallery_upload_ids, (await evaluate('return productFixture.uploads.slice(0, 2).map(upload => upload.id)')), 'Successful gallery upload IDs preserve order')

  // Existing records load by stable UUID and persisted inventory is informational on edit.
  await browser.navigate(`${origin}/products/${productFixtureId()}/edit`)
  await waitText('Edit product')
  await until('return document.querySelector("#product-name")?.value === "Cedar Storage Basket"', 'edit detail loaded')
  assert.equal(await evaluate(`return ![...document.querySelectorAll('input')].some(node => node.getAttribute('aria-label')?.toLowerCase().includes('opening stock') && !node.disabled)`), true, 'Persisted variant stock has no editable input')
  assert.equal(await evaluate(`return document.querySelector('#product-sku')?.disabled`), true, 'Persisted base SKU is disabled')
  await setInput('Short description', 'Updated synthetic product')
  await setInput('Color: Natural SKU', 'CEDAR-NAT-EDIT')
  const editSubmit = await evaluate(`return [...document.querySelectorAll('button[type="submit"],button')].find(node => /save changes/i.test(node.innerText))?.innerText`)
  await clickText(editSubmit)
  await until('return productFixture.writes.some(write => write.method === "PATCH")', 'edit payload')
  const editPayload = await evaluate('return productFixture.writes.find(write => write.method === "PATCH").body')
  assert.equal(editPayload.variants[0].id, '70000000-0000-4000-8000-000000000001', 'Edit must preserve the persisted variant UUID')
  assert.equal(editPayload.variants[0].price, null, 'Blank variant price remains inherited')
  assert.equal(editPayload.variants[0].shipping_weight_grams, null, 'Inherited package weight remains an override null')
  assert.equal(Object.hasOwn(editPayload, 'opening_stock'), false, 'Edit must not resubmit opening stock')
  assert.equal(Object.hasOwn(editPayload.variants[0], 'opening_stock'), false, 'Edit must not resubmit variant opening stock')
  await screenshot(`${artifacts}/product-edit.png`)
  await browser.navigate(`${origin}/products/${productFixtureId()}/edit`)
  await waitText('Edit product')
  await until('return document.querySelector("#product-name")?.value === "Cedar Storage Basket"', 'edit detail loaded before dirty navigation test')
  await setInput('Product name', 'Unsaved changed name')
  await clickText('Cancel')
  await waitText('Discard unsaved changes?')
  await clickText('Cancel', 'document.querySelector("dialog")')
  assert.equal(await evaluate(`return location.pathname.endsWith('/edit')`), true, 'Canceling discard confirmation stays on edit')
  await clickText('Cancel')
  await waitText('Discard unsaved changes?')
  await clickText('Discard changes', 'document.querySelector("dialog")')
  await until('return location.pathname === "/products"', 'discard leaves the editor')
  console.log('Seller Product browser regression passed: synthetic API states, list/filter/pagination/stale search, icon actions and confirmations, create/edit payloads, upload progress/failure/default, variant package inheritance, stock guards, save errors and unsaved cancellation.')
} finally {
  browser.close()
  preview?.kill()
  await rm(resolve(process.cwd(), '.next/pb'), { recursive: true, force: true })
}

function productFixtureId() { return '50000000-0000-4000-8000-000000000001' }
