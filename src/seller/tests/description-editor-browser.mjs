// Focused regression for the Seller product description modes, Markdown round-trip and responsive editor surfaces.
// Run with `pnpm --filter seller test:description:browser` after a production build.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { installProductFixtures } from './product-fixtures.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const sellerRoot = resolve(repoRoot, 'src/seller')
const artifacts = resolve(repoRoot, 'node_modules/.cache/seller-products/description-editor')
await mkdir(artifacts, { recursive: true })
const driverPath = resolve(artifacts, 'chat-browser-driver.mjs')
const driverSource = (await readFile(resolve(repoRoot, 'packages/ui/tests/chat-browser-driver.mjs'), 'utf8'))
  .replace('node_modules/.cache/messages-ui', 'node_modules/.cache/seller-products/description-editor/browser')
  .replace('.next/mu', '.next/de')
await writeFile(driverPath, driverSource)
const { openChatBrowser } = await import(pathToFileURL(driverPath))
const previewPort = process.env.SELLER_DESCRIPTION_PORT ?? '15175'
const origin = process.env.SELLER_DESCRIPTION_ORIGIN ?? `http://127.0.0.1:${previewPort}`
await rm(resolve(artifacts, 'browser'), { recursive: true, force: true })
const preview = process.argv.includes('--serve') ? spawn(process.execPath, [resolve(sellerRoot, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', previewPort, '--strictPort'], { cwd: sellerRoot, stdio: ['ignore', 'ignore', 'pipe'] }) : null
if (preview) {
  let ready = false
  const deadline = Date.now() + 20000
  while (!ready && Date.now() < deadline) {
    try { ready = (await fetch(origin)).ok } catch { await new Promise((done) => setTimeout(done, 200)) }
  }
  if (!ready) { preview.kill(); throw new Error('Seller preview did not start on 127.0.0.1:15175') }
}
const browser = await openChatBrowser()
const { cdp, screenshot } = browser
const evaluate = (expression) => browser.evaluate(expression.startsWith('return ') ? `(() => (${expression.slice(7)}))()` : expression)
const until = async (expression, label, timeout = 15000) => {
  const check = expression.startsWith('return ') ? `(() => (${expression.slice(7)}))()` : expression
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(check)) return
    await new Promise((done) => setTimeout(done, 150))
  }
  const diagnostic = await evaluate(`JSON.stringify({url:location.href,body:document.body?.innerText.slice(0,1000),fixture:window.productFixture?.requests,active:document.activeElement?.outerHTML.slice(0,350),selection:document.getSelection()?.anchorNode?.parentElement?.outerHTML.slice(0,250),tables:[...document.querySelectorAll('.seller-product-editor table')].map(table=>table.outerHTML.slice(0,900)),editor:document.querySelector('.product-description-surface')?.innerHTML.slice(0,700)})`)
  throw new Error(`Timed out: ${label}; ${diagnostic}; ${JSON.stringify(browser.errors)}`)
}
const safe = (value) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
async function clickControl(name) {
  const found = await evaluate(`(() => { const node=[...document.querySelectorAll('button,[role=button]')].find(item=>item.getAttribute('aria-label')==='${safe(name)}'||item.innerText.trim()==='${safe(name)}'||item.title==='${safe(name)}'); if(!node)return false; node.click(); return true })()`)
  assert.equal(found, true, `Control exists: ${name}`)
}
async function mode(name) {
  const value = ({ Source: 'source', 'Rich text': 'rich-text', Diff: 'diff' })[name]
  await until(`return Boolean(document.querySelector('[data-editor-mode="${value}"]'))`, `${name} mode control is mounted`)
  await clickControl(name)
  await until(`return document.querySelector('[data-editor-mode="${value}"][aria-pressed="true"]') !== null`, `${name} editor mode`)
}
async function typeSource(markdown) {
  await until('return Boolean(document.querySelector(".seller-product-editor .mdxeditor-source-editor .cm-content"))', 'CodeMirror source editor')
  const clicked = await evaluate(`(() => { const node=document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-content'); node?.focus(); node?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); node?.click(); return Boolean(node) })()`)
  assert.equal(clicked, true, 'Source editor surface exists')
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft', modifiers: 2 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 })
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft' })
  await cdp('Input.insertText', { text: markdown })
}
async function focusDescriptionEditor(view) {
  const scopeSelector = view === 'Source' ? '.mdxeditor-source-editor' : view === 'Rich text' ? '.mdxeditor-rich-text-editor' : '.mdxeditor-diff-editor'
  const targetSelector = view === 'Rich text' ? '[contenteditable=true]' : '.cm-content'
  const point = await evaluate(`(() => {const editor=document.querySelector('.seller-product-editor');const scope=editor.querySelector(${JSON.stringify(scopeSelector)});const target=scope?.querySelector(${JSON.stringify(targetSelector)});target?.scrollIntoView({block:'center'});const rect=target?.getBoundingClientRect();return rect?{x:rect.left+Math.min(rect.width-2,32),y:rect.top+Math.min(rect.height-2,24)}:null})()`)
  assert.ok(point, `Visible ${view} caret target exists`)
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
}

try {
  const initialMarkdown = '# Cedar basket\n\nOriginal woven description.\n\n- Handwoven\n- Natural finish'
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installProductFixtures.toString()})(); productFixture.products[0].description_markdown=${JSON.stringify(initialMarkdown)}; localStorage.setItem('aisley-seller-theme','light');` })
  await browser.viewport(1440, 1000, false)
  await browser.navigate(`${origin}/products/50000000-0000-4000-8000-000000000001/edit`)
  await until('return document.querySelector("#product-name")?.value === "Cedar Storage Basket"', 'loaded product editor')
  assert.equal(await evaluate(`return document.querySelector('[data-editor-mode][aria-pressed="true"]')?.getAttribute('data-editor-mode')`), 'source', 'Source is the initial editor mode')
  await until('return Boolean(document.querySelector(".seller-product-editor .mdxeditor-source-editor .cm-content"))', 'source CodeMirror surface')
  await evaluate(`document.querySelector('.seller-product-toolbar')?.scrollIntoView({block:'center'})`)
  await mode('Rich text')
  await evaluate(`document.querySelector('.seller-product-toolbar')?.scrollIntoView({block:'center'})`)
  const actionGeometry = await evaluate(`(() => [...document.querySelectorAll('.seller-product-editor .seller-product-toolbar button[data-toolbar-item]:not([aria-label="Block type"])')].map(button=>({label:button.getAttribute('aria-label')||button.title||button.innerText,disabled:button.disabled,rect:button.getBoundingClientRect().toJSON(),icon:button.querySelector('svg')?.getBoundingClientRect().toJSON(),tooltip:button.title||button.getAttribute('aria-label'),trigger:button.querySelector('span')?.getBoundingClientRect().toJSON()})).filter(item=>item.icon))()`)
  assert.ok(actionGeometry.length >= 5, `Rich toolbar has named icon controls: ${JSON.stringify(actionGeometry)}`)
  for (const action of actionGeometry) {
    assert.ok(action.rect.width >= 44 && action.rect.height >= 44, `Editor control has a 44px hit target: ${action.label}`)
    assert.ok(Math.abs((action.rect.left + action.rect.right - action.icon.left - action.icon.right) / 2) < 2, `Editor icon is horizontally centered: ${action.label}`)
    assert.ok(Math.abs((action.rect.top + action.rect.bottom - action.icon.top - action.icon.bottom) / 2) < 2, `Editor icon is vertically centered: ${action.label}`)
    assert.ok(action.tooltip, `Editor icon has an accessible tooltip/name: ${action.label}`)
    assert.ok(action.trigger && Math.abs(action.trigger.left - action.rect.left) < 2 && Math.abs(action.trigger.right - action.rect.right) < 2, `Tooltip trigger spans the full centered hit target: ${action.label}`)
  }
  const tooltipAction = actionGeometry.find(action=>/^Bold/i.test(action.label) && !action.disabled)
  assert.ok(tooltipAction, `Enabled Bold toolbar action exists: ${JSON.stringify(actionGeometry)}`)
  const tooltipPoint = { x: tooltipAction.rect.left + tooltipAction.rect.width / 2, y: tooltipAction.rect.top + tooltipAction.rect.height / 2 }
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: tooltipPoint.x, y: tooltipPoint.y })
  await until('return Boolean(document.querySelector("[class*=tooltipContent_]"))', 'enabled Bold toolbar tooltip appears on hover', 5000)

  await until('return Boolean(document.querySelector(".seller-product-editor .mdxeditor-rich-text-editor [contenteditable=true]"))', 'rich text editing surface')
  await mode('Diff')
  await until(`return document.body.innerText.includes('Loaded description') && document.body.innerText.includes('Current draft') && document.body.innerText.includes('Original woven description.')`, 'frozen persisted baseline and current draft')
  await mode('Source')
  await typeSource('# Cedar basket\n\nCurrent draft with typed source.')
  await mode('Rich text')
  await until(`return document.querySelector('.seller-product-editor')?.innerText.includes('Current draft with typed source.')`, 'source markdown rendered in rich mode')
  await mode('Diff')
  await until(`return document.body.innerText.includes('Original woven description.') && document.body.innerText.includes('Current draft with typed source.')`, 'source changes compared with frozen baseline')
  await mode('Source')
  await until(`return document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-content')?.innerText.includes('Current draft with typed source.')`, 'source draft survives mode switches')

  await clickControl('Insert table')
  await until(`return document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-content')?.innerText.includes('Column 1')`, 'source table insertion at retained cursor')
  const sourceTable = await evaluate(`return document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-content')?.innerText`)
  assert.match(sourceTable, /\| Column 1 \| Column 2 \| Column 3 \|/, 'Source table insertion uses GFM syntax')
  await mode('Rich text')
  await until(`return Boolean(document.querySelector('.seller-product-editor table'))`, 'Source table renders as an editable rich table')
  const richTable = await evaluate(`(() => {const editor=document.querySelector('.seller-product-editor');const table=editor?.querySelector('table');const header=table?.querySelector('th');return {text:table?.innerText, cells:table?.querySelectorAll('th,td').length, headerBackground:header?getComputedStyle(header).backgroundColor:null, border:table?.querySelector('th,td')?getComputedStyle(table.querySelector('th,td')).borderColor:null}})()`)
  assert.ok(richTable.cells >= 9, `GFM table has a header and two data rows: ${JSON.stringify(richTable)}`)
  assert.ok(richTable.headerBackground && richTable.headerBackground !== 'rgba(0, 0, 0, 0)', `Table header has a themed surface: ${JSON.stringify(richTable)}`)
  assert.ok(richTable.border && richTable.border !== 'rgba(0, 0, 0, 0)', `Table cells have visible theme borders: ${JSON.stringify(richTable)}`)
  const paragraphPoint = await evaluate(`(() => {const paragraph=[...document.querySelectorAll('.seller-product-editor p')].find(node=>!node.closest('table'));paragraph?.scrollIntoView({block:'center'});const rect=paragraph?.getBoundingClientRect();return rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:null})()`)
  assert.ok(paragraphPoint, 'Rich table insertion can target a paragraph outside existing tables')
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: paragraphPoint.x, y: paragraphPoint.y, button: 'left', clickCount: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: paragraphPoint.x, y: paragraphPoint.y, button: 'left', clickCount: 1 })
  const richInsert = await evaluate(`(() => {const button=[...document.querySelectorAll('.seller-product-toolbar button')].find(item=>/insert table/i.test(item.getAttribute('aria-label')||item.title||item.innerText));if(!button)return false;button.click();return true})()`)
  assert.equal(richInsert, true, 'Rich toolbar exposes Insert Table')
  await until(`return document.querySelectorAll('.seller-product-editor table').length >= 2`, 'rich toolbar inserts a second table')
  const cellPoint = await evaluate(`(() => {const table=document.querySelectorAll('.seller-product-editor table')[1];const cell=table?.querySelector('td [contenteditable=true]')||table?.querySelector('td');cell?.scrollIntoView({block:'center'});const rect=cell?.getBoundingClientRect();return rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:null})()`)
  assert.ok(cellPoint, 'Inserted rich table has an editable data cell')
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: cellPoint.x, y: cellPoint.y, button: 'left', clickCount: 1 })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cellPoint.x, y: cellPoint.y, button: 'left', clickCount: 1 })
  await cdp('Input.insertText', { text: 'Woven' })
  await until(`return [...document.querySelectorAll('.seller-product-editor table')].some(table=>table.innerText.includes('Woven'))`, 'rich table cell edit', 8000)
  await mode('Source')
  await until(`return document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-content')?.innerText.includes('Woven')`, 'rich table edit survives Markdown roundtrip')

  await mode('Rich text')
  await clickControl('Insert image')
  await until('return Boolean(document.querySelector("input[type=file][name=file]"))', 'description image upload control')
  const fileSelected = await evaluate(`(() => {const input=document.querySelector('input[type=file][name=file]');if(!input)return false;const transfer=new DataTransfer();transfer.items.add(new File(['description image bytes'],'description-cover.png',{type:'image/png'}));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files').set.call(input,transfer.files);input.dispatchEvent(new Event('change',{bubbles:true}));const form=input.closest('form');return {selected:input.files.length,form:form?.innerText,buttons:[...(form?.querySelectorAll('button')||[])].map(button=>({text:button.innerText,label:button.getAttribute('aria-label'),type:button.type}))}})()`)
  assert.equal(fileSelected?.selected, 1, 'Description image file can be selected')
  const uploadAction = await evaluate(`(() => {const form=document.querySelector('input[type=file][name=file]')?.closest('form');const button=[...(form?.querySelectorAll('button')||[])].find(item=>item.type==='submit'||/upload/i.test(item.innerText));if(!button)return false;button.click();return button.innerText})()`)
  assert.ok(uploadAction, `Description image dialog starts upload: ${JSON.stringify(fileSelected)}`)
  await until('return productFixture.uploads.length === 1', 'canonical description upload request')
  const descriptionUpload = await evaluate('return productFixture.uploads[0]')
  assert.equal(await evaluate(`return [...document.querySelectorAll('[data-editor-mode]')].every(button=>button.disabled)`), true, 'Mode changes are guarded while a description image upload is active')
  await until(`return document.body.innerText.includes('Description image uploaded.')`, 'description image upload completed')
  assert.equal(await evaluate(`return [...document.querySelectorAll('[data-editor-mode]')].every(button=>!button.disabled)`), true, 'Mode changes return when the image upload completes')
  await until('return !document.querySelector("input[name=src]") && Boolean(document.querySelector(".seller-product-editor .mdxeditor-rich-text-editor img"))', 'single image save uploads and inserts preview')
  const insertedImage = await evaluate(`return document.querySelector('.seller-product-editor .mdxeditor-rich-text-editor img')?.getAttribute('src')`)
  assert.ok(insertedImage?.startsWith('data:image/svg+xml,'), `Uploaded image displays its synthetic preview: ${insertedImage}`)
  await mode('Source')
  await until(`return document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-content')?.innerText.includes('/api/v1/product-description-assets/${descriptionUpload.id}')`, 'uploaded image Markdown uses canonical asset URL')
  await mode('Rich text')
  assert.ok(descriptionUpload.url.endsWith('/api/v1/seller/product-uploads'), `Description uses the canonical seller upload endpoint: ${JSON.stringify(descriptionUpload)}`)
  assert.equal(descriptionUpload.purpose, 'description', 'Description upload purpose is set')
  assert.equal(descriptionUpload.name, 'description-cover.png', 'Selected filename reaches the upload endpoint')
  await clickControl('Save changes')
  await until('return productFixture.writes.some(write=>write.method === "PATCH")', 'table and image editor save')
  const tablePayload = await evaluate('return productFixture.writes.findLast(write=>write.method === "PATCH").body')
  assert.match(tablePayload.description_markdown, /\| Column 1 \| Column 2 \| Column 3 \|/, 'Save persists the edited GFM table from the editor')
  assert.ok(tablePayload.description_markdown.includes(`/api/v1/product-description-assets/${descriptionUpload.id}`), `Saved Markdown refers to its canonical description asset: ${JSON.stringify({ markdown: tablePayload.description_markdown, asset: descriptionUpload })}`)
  assert.ok(tablePayload.description_asset_ids.includes(descriptionUpload.id), `Saved product associates uploaded description assets: ${JSON.stringify(tablePayload.description_asset_ids)}`)

  // Invalid MDX must remain editable and recoverable in Source; a failed save cannot reset the typed draft.
  await browser.navigate(`${origin}/products/50000000-0000-4000-8000-000000000001/edit`)
  await until('return document.querySelector("#product-name")?.value === "Cedar Storage Basket"', 'reopened product editor')
  const invalidMarkdown = '# Cedar basket\n\n{unclosed expression'
  await typeSource(invalidMarkdown)
  await evaluate('productFixture.mode="save-error"')
  const save = await evaluate(`return [...document.querySelectorAll('button')].find(item=>/save changes/i.test(item.innerText))?.innerText`)
  assert.ok(save, 'Edit save action exists')
  await clickControl(save)
  await until('return Boolean(document.querySelector(".product-description-surface[inert]") && document.querySelector("button[type=submit]")?.disabled)', 'description and save actions lock during save')
  await until(`return document.body.innerText.includes('Product name is already in use.')`, 'synthetic save error')
  await until(`return document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-content')?.innerText.includes('{unclosed expression')`, 'source draft retained after save error')
  await focusDescriptionEditor('Source')
  const caret = await evaluate(`(() => {const cursor=document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-cursor');const content=document.querySelector('.seller-product-editor .mdxeditor-source-editor .cm-content');return cursor?{color:getComputedStyle(cursor).borderLeftColor,width:getComputedStyle(cursor).borderLeftWidth}:{color:getComputedStyle(content).caretColor,width:'0px'}})()`)
  assert.ok(caret.color && caret.color !== 'transparent' && caret.color !== 'rgba(0, 0, 0, 0)' && caret.width !== '0px', `Source caret is visible: ${JSON.stringify(caret)}`)
  await evaluate('productFixture.mode="normal"')
  const writesBeforeRecovery = await evaluate('return productFixture.writes.length')
  await clickControl(save)
  await until(`return productFixture.writes.length > ${writesBeforeRecovery} && productFixture.writes.at(-1)?.method === "PATCH"`, 'successful source-mode recovery save request')
  const payload = await evaluate('return productFixture.writes.findLast(write=>write.method === "PATCH").body')
  assert.equal(payload.description_markdown, invalidMarkdown, 'Save sends the latest Source text without requiring a mode switch')

  // Responsive snapshots cover each editing surface in both themes.
  await browser.navigate(`${origin}/products/50000000-0000-4000-8000-000000000001/edit`)
  await until('return document.querySelector("#product-name")?.value === "Cedar Storage Basket"', 'editor reopened for responsive screenshots')
  for (const theme of ['light', 'dark']) {
    await evaluate(`localStorage.setItem('aisley-seller-theme','${theme}')`)
    await cdp('Page.reload')
    await until('return document.querySelector("#product-name")?.value === "Cedar Storage Basket"', `${theme} editor reload`)
    for (const width of [320, 390, 768, 1440]) {
      await browser.viewport(width, 900, width < 800)
      for (const view of ['Source', 'Rich text', 'Diff']) {
        await mode(view)
        await focusDescriptionEditor(view)
        const measurements = await evaluate(`(() => {const editor=document.querySelector('.seller-product-editor');const scope=editor?.querySelector(${JSON.stringify(view==='Source'?'.mdxeditor-source-editor':view==='Rich text'?'.mdxeditor-rich-text-editor':'.mdxeditor-diff-editor')});const visible=node=>node&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden';const cursor=[...(scope?.querySelectorAll('.cm-cursor')||[])].find(visible);const target=cursor||[...(scope?.querySelectorAll('[contenteditable=true],.cm-content')||[])].find(visible);const style=target?getComputedStyle(target):null;const diff=editor?.querySelector('.mdxeditor-diff-editor');return {width:innerWidth,scroll:document.documentElement.scrollWidth,caret:target?{color:target.matches('.cm-cursor')?style.borderLeftColor:style.caretColor,width:target.matches('.cm-cursor')?style.borderLeftWidth:'n/a',rect:target.getBoundingClientRect().toJSON()}:null,diff:diff?{scrollWidth:diff.scrollWidth,clientWidth:diff.clientWidth,overflow:getComputedStyle(diff).overflowX}:null,scrollHint:document.body.innerText.includes('Scroll horizontally to compare both versions.'),editor:document.querySelector('.product-description-surface')?.getBoundingClientRect().toJSON()}})()`)
        assert.ok(measurements.scroll <= measurements.width, `No horizontal page overflow (${theme}/${width}/${view}): ${JSON.stringify(measurements)}`)
        assert.ok(measurements.caret?.color && measurements.caret.color !== 'transparent' && measurements.caret.color !== 'rgba(0, 0, 0, 0)' && measurements.caret.width !== '0px', `Visible caret styling (${theme}/${width}/${view}): ${JSON.stringify(measurements)}`)
        if (view === 'Diff' && width < 640) {
          assert.equal(measurements.diff.overflow, 'auto', `Narrow Diff is locally scrollable (${theme}/${width}): ${JSON.stringify(measurements)}`)
          assert.ok(measurements.diff.scrollWidth > measurements.diff.clientWidth, `Narrow Diff keeps both readable panes inside its scroll surface (${theme}/${width}): ${JSON.stringify(measurements)}`)
          assert.equal(measurements.scrollHint, true, 'Narrow Diff exposes its horizontal comparison hint')
        }
        await screenshot(`${artifacts}/${theme}-${width}-${view.toLowerCase().replace(' ', '-')}.png`)
      }
    }
  }

  console.log(`Description editor browser regression passed: source default, mode switching and frozen diff baseline, source draft/error recovery and save payload, centered named toolbar actions, and 24 light/dark responsive screenshots (${artifacts}).`)
} finally {
  browser.close()
  preview?.kill()
  await rm(resolve(repoRoot, '.next/de'), { recursive: true, force: true })
}
