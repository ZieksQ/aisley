import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const role = process.argv[2] ?? 'admin'
assert.ok(['admin', 'seller'].includes(role))
const origin =
  process.env.VOUCHER_UI_ORIGIN ??
  `http://127.0.0.1:${role === 'admin' ? 15195 : 15196}`
const cdpOrigin = process.env.VOUCHER_UI_CDP ?? 'http://127.0.0.1:19355'
const target = await (
  await fetch(`${cdpOrigin}/json/new?${encodeURIComponent('about:blank')}`, {
    method: 'PUT',
  })
).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) =>
  ws.addEventListener('open', resolve, { once: true }),
)
let sequence = 0
const waiting = new Map()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const pending = waiting.get(message.id)
    waiting.delete(message.id)
    if (message.error) pending.reject(message.error)
    else pending.resolve(message.result)
  }
})
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    waiting.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function js(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(expression) {
  for (let i = 0; i < 120; i++) {
    if (
      await js(
        `(() => { try { return Boolean(document.body) && Boolean(${expression}) } catch { return false } })()`,
      )
    )
      return
    await sleep(100)
  }
  throw new Error(
    `Timeout: ${expression}; ${await js('document.body.innerText')}`,
  )
}
function fixture(role) {
  const original = window.fetch.bind(window)
  const start = new Date(Date.now() - 86400000).toISOString()
  const end = new Date(Date.now() + 7 * 86400000).toISOString()
  const terms = {
    code: 'AIS-VOUCHER-1',
    benefit_type: 'discount',
    value_type: 'fixed',
    value: '20.00',
    maximum_discount: null,
    minimum_spend: '0.00',
    starts_at: start,
    ends_at: end,
    global_limit: 100,
    per_customer_limit: 1,
    payment_method: 'cod',
    eligibility_rules: [],
    stacking_policy: { allow_with: [] },
    terms_summary: 'Save on all eligible items. COD only.',
  }
  const make = (i) => ({
    id: `voucher-${i}`,
    code: `AIS-VOUCHER-${i}`,
    benefit_type: 'discount',
    lifecycle: i === 2 ? 'draft' : 'published',
    status: i === 2 ? 'draft' : 'active',
    revision: 1,
    version: i === 2 ? 0 : 1,
    is_active: i !== 2,
    authoring_supported: true,
    terms: { ...terms, code: `AIS-VOUCHER-${i}` },
    draft:
      i === 2
        ? {
            id: 'draft-2',
            number: 1,
            terms: { ...terms, code: 'AIS-VOUCHER-2' },
          }
        : null,
    redeemed_count: 3,
    remaining_capacity: 97,
    customer_savings: '60.00',
  })
  const state = (window.voucherFixture = {
    rows: Array.from({ length: 23 }, (_, i) => make(i + 1)),
    writes: [],
    error: '',
    delay: 70,
    receipts: {},
    history: {},
  })
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  const page = (rows, page = 1) => ({
    data: rows.slice((page - 1) * 15, page * 15),
    meta: {
      current_page: page,
      last_page: Math.max(1, Math.ceil(rows.length / 15)),
      total: rows.length,
    },
  })
  window.fetch = async (url, options = {}) => {
    const parsed = new URL(url, location.origin),
      path = parsed.pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/'))
      return original(url, options)
    if (path.endsWith('/auth/me'))
      return json({
        [role]: {
          id: role,
          role,
          status: 'active',
          email: 'voucher@example.com',
          profile: { first_name: 'Voucher', last_name: 'Tester' },
          permissions: sessionStorage.getItem('voucher-readonly')
            ? ['vouchers.view']
            : ['vouchers.view', 'vouchers.manage'],
          shop: {
            id: 'shop',
            name: 'Voucher shop',
            status: 'active',
            category: null,
            is_on_vacation: false,
          },
        },
      })
    if (path.endsWith('/policy-consent/status'))
      return json({ data: { all_required_accepted: true, policies: [] } })
    if (!path.includes('/vouchers')) return json({ data: [], unread_count: 0 })
    await new Promise((resolve) => setTimeout(resolve, state.delay))
    if (state.error === 'denied')
      return json({ message: 'Permission changed.' }, 403)
    if ((options.method ?? 'GET') === 'GET') {
      if (state.error === 'read')
        return json({ message: 'Vouchers could not be loaded.' }, 503)
      const suffix = path.split('/vouchers')[1]
      if (!suffix) {
        const filter = state.rows.filter(
          (v) =>
            (!parsed.searchParams.get('status') ||
              v.status === parsed.searchParams.get('status')) &&
            (!parsed.searchParams.get('benefit') ||
              v.benefit_type === parsed.searchParams.get('benefit')) &&
            v.code.includes(
              (parsed.searchParams.get('search') ?? '').toUpperCase(),
            ),
        )
        return json(page(filter, Number(parsed.searchParams.get('page') ?? 1)))
      }
      const [id, kind] = suffix.slice(1).split('/')
      const row = state.rows.find((v) => v.id === id)
      if (!kind) return json({ data: row })
      if (state.error === 'history')
        return json({ message: 'History unavailable.' }, 503)
      const rows =
        kind === 'redemptions'
          ? Array.from({ length: 17 }, (_, i) => ({
              id: `r-${i}`,
              order_reference: `AIS-ORDER-${i}`,
              order_status: i === 0 ? 'cancelled' : 'delivered',
              redeemed_at: start,
              discount_amount: '20.00',
              currency: 'PHP',
              version: 1,
            }))
          : kind === 'actions'
            ? [{ id: 'a-1', action: 'publish', revision: 1, created_at: start }]
            : [
                {
                  id: 'v-1',
                  number: 1,
                  state: 'published',
                  terms: row.terms,
                  created_at: start,
                  published_at: start,
                },
              ]
      return json(page(rows, Number(parsed.searchParams.get('page') ?? 1)))
    }
    const body = JSON.parse(options.body),
      key = new Headers(options.headers).get('Idempotency-Key')
    state.writes.push({ path, body, key })
    if (state.error === 'validation')
      return json(
        {
          message: 'Check your terms.',
          errors: { value: ['Saving must be positive.'] },
        },
        422,
      )
    if (state.error === 'conflict')
      return json(
        { message: 'Voucher changed.', code: 'REVISION_CONFLICT' },
        409,
      )
    let response = state.receipts[key]
    if (!response) {
      const [id, action] = path.split('/vouchers')[1].slice(1).split('/')
      let row = state.rows.find((v) => v.id === id)
      const normalize = (input) => ({
        ...terms,
        ...input,
        code: input.code || `AIS-NEW-${state.rows.length}`,
        value: Number(input.value).toFixed(2),
        maximum_discount: input.maximum_discount || null,
        stacking_policy: {
          allow_with: input.stacking ? ['app:shipping', 'shop:shipping'] : [],
        },
      })
      if (!id || action === 'duplicate') {
        row = {
          ...make(state.rows.length + 1),
          lifecycle: 'draft',
          status: 'draft',
          version: 0,
          redeemed_count: 0,
          remaining_capacity: null,
          customer_savings: '0.00',
          is_active: false,
        }
        row.terms = !id
          ? normalize(body)
          : { ...row.terms, code: `AIS-COPY-${state.rows.length}` }
        row.code = row.terms.code
        row.draft = { id: 'draft-new', number: 1, terms: row.terms }
        state.rows.push(row)
      } else {
        row.revision++
        if (action === 'draft')
          row.draft = {
            id: 'working',
            number: row.version + 1,
            terms: normalize(body),
          }
        if (action === 'publish') {
          row.terms = row.draft.terms
          row.version = row.draft.number
          row.draft = null
          row.status =
            row.lifecycle === 'draft' || row.is_active ? 'active' : 'paused'
          row.lifecycle = 'published'
          row.is_active = row.status === 'active'
        }
        if (action === 'pause') {
          row.status = 'paused'
          row.is_active = false
        }
        if (action === 'resume') {
          row.status = 'active'
          row.is_active = true
        }
        if (action === 'end') {
          row.status = 'ended'
          row.lifecycle = 'ended'
          row.is_active = false
        }
        if (action === 'discard') row.draft = null
      }
      response = { data: structuredClone(row) }
      state.receipts[key] = response
    }
    if (state.error === 'uncertain')
      throw new TypeError('Response lost after commit')
    return json(response)
  }
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `(${fixture.toString()})(${JSON.stringify(role)});`,
})
async function navigate(
  path,
  theme = 'light',
  ready = 'document.querySelector(".vouchers")',
) {
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('aisley-${role}-theme', ${JSON.stringify(theme)});`,
  })
  await cdp('Page.navigate', { url: origin + path })
  await until(ready)
  await sleep(200)
}
async function clickButton(label, scope = 'document') {
  const point = await js(
    `(() => { const e = [...${scope}.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(label)}); if (!e) throw new Error('Missing ${label}'); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()`,
  )
  await cdp('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    clickCount: 1,
    ...point,
  })
  await cdp('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: 1,
    ...point,
  })
}
async function fill(id, value) {
  await js(
    `(() => { const e=document.getElementById(${JSON.stringify(id)}); const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,'value').set; setter.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`,
  )
}
const shots = `src/${role}/node_modules/.cache/voucher-browser`
await mkdir(shots, { recursive: true })
let states = 0
try {
  for (const width of [390, 768, 1440])
    for (const theme of ['light', 'dark'])
      for (const route of [
        '/vouchers',
        '/vouchers/new',
        '/vouchers/voucher-1',
      ]) {
        await cdp('Emulation.setDeviceMetricsOverride', {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        })
        await navigate(
          route,
          theme,
          route === '/vouchers'
            ? 'document.querySelector(".vouchers tbody")'
            : route.endsWith('/new')
              ? 'document.getElementById("voucher-value")'
              : 'document.querySelector(".vouchers dl")',
        )
        assert.ok(
          await js(`document.documentElement.scrollWidth <= ${width} + 1`),
          `${role} ${route} overflow ${width}`,
        )
        assert.equal(
          await js('document.documentElement.classList.contains("dark")'),
          theme === 'dark',
        )
        await cdp('Input.dispatchKeyEvent', {
          type: 'keyDown',
          key: 'Tab',
          code: 'Tab',
          windowsVirtualKeyCode: 9,
        })
        await cdp('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: 'Tab',
          code: 'Tab',
          windowsVirtualKeyCode: 9,
        })
        assert.ok(await js('document.activeElement !== document.body'))
        if (
          (width === 390 && theme === 'light') ||
          (width === 1440 && theme === 'dark')
        ) {
          const shot = await cdp('Page.captureScreenshot', { format: 'png' })
          await writeFile(
            `${shots}/${width}-${theme}-${route.split('/').pop() || 'list'}.png`,
            Buffer.from(shot.data, 'base64'),
          )
        }
        states++
      }
  await navigate(
    '/vouchers',
    'light',
    'document.querySelector(".vouchers tbody")',
  )
  await clickButton('Next')
  await until(
    'document.querySelector(".voucher-pager").innerText.includes("Page 2")',
  )
  await fill('voucher-search', 'NO-MATCH')
  await clickButton('Search')
  await until(
    'document.querySelector(".vouchers").innerText.includes("No vouchers match")',
  )
  await js('voucherFixture.error="read"')
  await clickButton('Search')
  await fill('voucher-search', 'AIS')
  await clickButton('Search')
  await until(
    'document.querySelector(".vouchers").innerText.includes("Vouchers could not be loaded")',
  )
  await js('voucherFixture.error=""')
  await clickButton('Retry loading')
  await until('document.querySelector(".vouchers tbody")')
  await navigate(
    '/vouchers',
    'light',
    'document.querySelector(".vouchers tbody")',
  )
  await clickButton('Create voucher')
  await until('document.getElementById("voucher-value")')
  if (role === 'seller')
    assert.equal(
      await js(
        '!!document.querySelector("#voucher-benefit_type option[value=shipping]")',
      ),
      false,
    )
  await fill('voucher-value', '25')
  await fill('voucher-terms_summary', 'Safe retained terms')
  await js('window.confirm=()=>false')
  await until('document.body.innerText.includes("Unsaved changes")')
  await js(`document.querySelector('a[href="/vouchers"]').click()`)
  await sleep(250)
  assert.equal(await js('location.pathname'), '/vouchers/new')
  await js('history.back()')
  await sleep(350)
  assert.equal(await js('location.pathname'), '/vouchers/new')
  assert.equal(await js('document.getElementById("voucher-value").value'), '25')
  await clickButton('Cancel')
  assert.equal(await js('location.pathname'), '/vouchers/new')
  await js('voucherFixture.error="validation"')
  await clickButton('Save draft')
  await until('document.body.innerText.includes("Saving must be positive")')
  assert.equal(
    await js('document.getElementById("voucher-terms_summary").value'),
    'Safe retained terms',
  )
  await js('voucherFixture.error="uncertain"')
  await clickButton('Save draft')
  await until('document.body.innerText.includes("Retry exact request")')
  const first = await js('voucherFixture.writes.at(-1)')
  await js('voucherFixture.error=""')
  await clickButton('Retry exact request')
  await until(
    'location.pathname.includes("/voucher-24") && !!document.querySelector(".vouchers dl")',
  )
  assert.deepEqual(await js('voucherFixture.writes.at(-1)'), first)
  await navigate(
    '/vouchers/voucher-1',
    'dark',
    'document.querySelector(".vouchers dl")',
  )
  await clickButton('Create revision')
  await until('document.getElementById("voucher-value")')
  assert.equal(
    await js('document.getElementById("voucher-code").disabled'),
    true,
  )
  await fill('voucher-value', '35')
  await clickButton('Save draft')
  await until('document.body.innerText.includes("Pending draft differences")')
  assert.ok(
    await js(
      'document.querySelector(".voucher-diff").innerText.includes("35.00")',
    ),
  )
  await clickButton('Discard draft')
  await until('document.querySelector("dialog[open]")')
  await clickButton('Discard', 'document.querySelector("dialog")')
  await until('document.body.innerText.includes("draft discarded")')
  assert.equal(await js('!!document.querySelector(".voucher-diff")'), false)
  await clickButton('Create revision')
  await until('document.getElementById("voucher-value")')
  await fill('voucher-value', '35')
  await clickButton('Save draft')
  await until('document.body.innerText.includes("Pending draft differences")')
  await clickButton('Publish draft')
  await until('document.querySelector("dialog[open]")')
  assert.ok(
    await js('document.querySelector("dialog").innerText.includes("35.00")'),
  )
  assert.ok(
    await js(
      `document.querySelector('dialog').innerText.includes(${JSON.stringify(role === 'admin' ? 'platform funds' : 'Shop funds')})`,
    ),
  )
  assert.ok(
    await js(
      'document.querySelector("dialog").contains(document.activeElement)',
    ),
  )
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  })
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  })
  await until('!document.querySelector("dialog[open]")')
  await clickButton('Publish draft')
  await until('document.querySelector("dialog[open]")')
  await clickButton('Publish', 'document.querySelector("dialog")')
  await until('document.body.innerText.includes("Voucher published.")')
  for (const action of ['Pause', 'Resume', 'End permanently']) {
    if (action === 'Pause') await js('voucherFixture.error="uncertain"')
    await clickButton(action)
    await until('document.querySelector("dialog[open]")')
    await clickButton(action, 'document.querySelector("dialog")')
    await until('!document.querySelector("dialog[open]")')
    if (action === 'Pause') {
      await until('document.body.innerText.includes("Retry exact request")')
      const original = await js('voucherFixture.writes.at(-1)')
      await js(`document.querySelector('a[href="/vouchers"]').click()`)
      await sleep(250)
      assert.equal(await js('location.pathname'), '/vouchers/voucher-1')
      await js('voucherFixture.error=""')
      await clickButton('Retry exact request')
      await until('document.body.innerText.includes("Voucher paused.")')
      assert.deepEqual(await js('voucherFixture.writes.at(-1)'), original)
    }
    await until(
      `document.querySelector('.vouchers dl')?.innerText.includes('${action === 'Pause' ? 'Paused' : action === 'Resume' ? 'Active' : 'Ended'}')`,
    )
  }
  assert.ok(
    await js(
      'document.querySelector(".vouchers dl").innerText.includes("Ended")',
    ),
  )
  await clickButton('Duplicate')
  await until('document.querySelector("dialog[open]")')
  await clickButton('Duplicate', 'document.querySelector("dialog")')
  await until(
    'location.pathname.endsWith("/voucher-24") && !!document.querySelector(".vouchers dl")',
  )
  assert.equal(await js('voucherFixture.rows.at(-1).redeemed_count'), 0)
  assert.equal(await js('voucherFixture.rows.at(-1).lifecycle'), 'draft')
  assert.notEqual(await js('voucherFixture.rows.at(-1).code'), 'AIS-VOUCHER-1')
  await navigate(
    '/vouchers/voucher-1',
    'dark',
    'document.querySelector(".vouchers dl")',
  )
  await clickButton('Redemptions')
  await until(
    'document.querySelector(".voucher-table").innerText.includes("Cancelled Orders")',
  )
  await clickButton('Next')
  await until(
    'document.querySelector(".voucher-pager").innerText.includes("Page 2")',
  )
  await js('voucherFixture.error="history"')
  await clickButton('Actions')
  await until('document.body.innerText.includes("History unavailable")')
  await js('voucherFixture.error=""')
  await clickButton('Retry history')
  await until(
    'document.querySelector(".voucher-table").innerText.includes("Publish")',
  )
  await js('voucherFixture.error="denied"')
  await clickButton('Redemptions')
  await until('document.body.innerText.includes("Voucher access unavailable")')
  assert.equal(await js('!!document.querySelector(".vouchers dl")'), false)
  if (role === 'admin') {
    await js('sessionStorage.setItem("voucher-readonly","1")')
    await navigate(
      '/vouchers/voucher-1',
      'light',
      'document.querySelector(".vouchers dl")',
    )
    assert.equal(
      await js(
        '[...document.querySelectorAll(".vouchers button")].some(b=>["Create revision","Publish draft","Pause","End permanently","Duplicate"].includes(b.textContent.trim()))',
      ),
      false,
    )
    await navigate('/vouchers/new')
    assert.ok(
      await js('document.body.innerText.includes("management permission")'),
    )
  }
  console.log(
    JSON.stringify({
      role,
      viewportThemeRouteStates: states,
      result: 'passed',
      checks:
        'forms, tables, focus, publication, lifecycle, differences, pagination, errors, retained input, exact retries, access loss, permissions',
      screenshots: shots,
    }),
  )
} finally {
  await cdp('Page.close').catch(() => {})
  ws.close()
}
