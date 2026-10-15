import assert from 'node:assert/strict'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
export const sellerRoot = resolve(repoRoot, 'src/seller')
export const artifacts = resolve(repoRoot, 'node_modules/.cache/seller-operations')
export const origin = process.env.SELLER_OPERATIONS_ORIGIN ?? 'http://127.0.0.1:15175'
export const widths = [320, 390, 768, 1440]
const skipCaptures = process.argv.includes('--skip-captures')

let browserDriver

async function loadBrowserDriver() {
  if (browserDriver) return browserDriver
  await mkdir(artifacts, { recursive: true })
  const driverPath = resolve(artifacts, 'operations-chromium-driver.mjs')
  const template = await readFile(resolve(repoRoot, 'packages/ui/tests/chat-browser-driver.mjs'), 'utf8')
  const source = template
    .replaceAll('node_modules/.cache/messages-ui', 'node_modules/.cache/seller-operations/chromium')
    .replaceAll('.next/mu', '../../node_modules/.cache/o')
    .replace('const pending = new Map();', 'const pending = new Map(); const listeners = new Map();')
    .replace('if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);', 'if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);\n      for (const listener of listeners.get(message.method) ?? []) listener(message.params);')
    .replace('cdp, evaluate, until, screenshot, errors,', 'cdp, evaluate, until, screenshot, errors, on: (method, listener) => { const entries = listeners.get(method) ?? []; entries.push(listener); listeners.set(method, entries); },')
    .replace('close: () => browser.kill(),', 'close: () => new Promise(done => { if (browser.exitCode !== null || browser.signalCode !== null) return done(); browser.once("exit", done); browser.kill(); }),')
  await writeFile(driverPath, source)
  browserDriver = await import(pathToFileURL(driverPath))
  return browserDriver
}

export async function openBrowser() {
  const { openChatBrowser } = await loadBrowserDriver()
  const browser = await openChatBrowser()
  const evaluate = (expression) => browser.evaluate(expression.startsWith('return ')
    ? `(() => (${expression.slice(7)}))()`
    : expression)
  const until = async (expression, label, timeout = 30000) => {
    const check = expression.startsWith('return ')
      ? `(() => (${expression.slice(7)}))()`
      : expression
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      if (await evaluate(check)) return
      await new Promise((done) => setTimeout(done, 100))
    }
    throw new Error(`Timed out waiting for ${label}; ${JSON.stringify(browser.errors)}`)
  }
  const clickPointer = async (selectorExpression, selectorLabel) => {
    const deadline = Date.now() + 10000
    let point = null
    while (!point && Date.now() < deadline) {
      point = await evaluate(`(() => { const node = ${selectorExpression}; if (!node || node.matches(':disabled') || !node.getClientRects().length) return null; node.scrollIntoView({ block: 'center', inline: 'nearest' }); node.focus({ preventScroll: true }); const rect = node.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } })()`)
      if (!point) await new Promise((done) => setTimeout(done, 50))
    }
    assert.ok(point, `Could not find enabled control: ${selectorLabel}`)
    await browser.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point })
    await browser.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point })
  }
  return {
    ...browser,
    evaluate,
    until,
    async navigate(path) {
      await browser.navigate(path.startsWith('http') ? path : `${origin}${path}`)
    },
    async waitText(text, timeout = 30000) {
      const safe = text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
      try {
        await until(`return document.body?.innerText.includes('${safe}')`, text, timeout)
      } catch (cause) {
        const details = await evaluate("return { href: location.href, ready: document.readyState, title: document.title, body: document.body?.innerText.slice(0, 1200), fixture: Boolean(window.operationsFixture), modes: window.operationsFixture?.modes, requests: window.operationsFixture?.requests, unhandled: window.operationsFixture?.unhandled, errors: window.operationsFixture?.errors }")
        throw new Error(`${cause instanceof Error ? cause.message : cause}; page diagnostic: ${JSON.stringify(details)}`)
      }
    },
    async waitForStatus(label, timeout = 30000) {
      const safe = label.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
      await until(`return [...document.querySelectorAll('[role="status"][aria-busy="true"]')].some(item => item.getAttribute('aria-label') === '${safe}')`, label, timeout)
    },
    async clickText(text, root = 'document') {
      const safe = text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
      await clickPointer(`(() => { const root = ${root}; return root && [...root.querySelectorAll('button,a,[role="button"]')].find(item => item.innerText.trim() === '${safe}' || item.getAttribute('aria-label') === '${safe}' || item.title === '${safe}') })()`, text)
    },
    async clickName(name, selector = 'button') {
      const safe = name.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
      await clickPointer(`(() => [...document.querySelectorAll('${selector}')].find(item => item.getAttribute('aria-label') === '${safe}' || item.title === '${safe}'))()`, name)
    },
    async setField(label, value) {
      const safe = label.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
      const valueSafe = String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")
      const found = await evaluate(`(() => { const node = [...document.querySelectorAll('input,textarea,select')].find(item => item.id === '${safe}' || item.getAttribute('aria-label') === '${safe}' || item.labels?.[0]?.innerText.trim() === '${safe}' || item.labels?.[0]?.innerText.includes('${safe}')); if (!node || node.disabled) return false; const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value'); descriptor?.set?.call(node, '${valueSafe}'); node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); if (node.tagName !== 'SELECT') node.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
      assert.equal(found, true, `Could not find editable field: ${label}`)
    },
    async setMode(name, mode) {
      const safeName = name.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
      const safeMode = mode.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
      await evaluate(`window.operationsFixture.modes['${safeName}'] = '${safeMode}'`)
    },
    async setNextModes(modes) {
      await evaluate(`sessionStorage.setItem('seller-operations-next-modes', ${JSON.stringify(JSON.stringify(modes))})`)
    },
    async requests() {
      return evaluate('return window.operationsFixture?.requests ?? []')
    },
    async waitForRequest(predicate, label, timeout = 15000) {
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        const requests = await this.requests()
        if (requests.some(predicate)) return requests
        await new Promise((done) => setTimeout(done, 100))
      }
      assert.fail(`Timed out waiting for synthetic request: ${label}`)
    },
    async screenshot(name) {
      if (skipCaptures && name !== 'operations-failure.png') return null
      const path = resolve(artifacts, name)
      await browser.screenshot(path)
      return path
    },
    async assertNoHorizontalOverflow(label) {
      const dimensions = await evaluate(`return (() => {
        const viewport = document.documentElement.clientWidth
        const outside = [...document.body.querySelectorAll('*')].filter(node => {
          if (node.closest('[role="region"][aria-label]')) return false
          const rect = node.getBoundingClientRect()
          return rect.right > viewport + 1 || rect.left < -1
        }).map(node => {
          const rect = node.getBoundingClientRect()
          const style = getComputedStyle(node)
          return { tag: node.tagName, className: typeof node.className === 'string' ? node.className : '', text: node.innerText?.trim().slice(0, 60), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), position: style.position, overflowX: style.overflowX }
        }).slice(0, 12)
        const containers = Object.fromEntries(['.portal-shell', '.portal-workspace', '.portal-content', '.portal-page', '.portal-table-region'].map(selector => {
          const node = document.querySelector(selector)
          const rect = node?.getBoundingClientRect()
          return [selector, node && rect ? { left: rect.left, right: rect.right, width: rect.width, scrollWidth: node.scrollWidth, overflowX: getComputedStyle(node).overflowX } : null]
        }))
        const rect = node => {
          const bounds = node.getBoundingClientRect()
          return { left: bounds.left, right: bounds.right, width: bounds.width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }
        }
        const tooltipNodes = [...document.querySelectorAll('.portal-action-tooltip')]
        const savedTooltips = tooltipNodes.map(node => ({ node, parent: node.parentNode, next: node.nextSibling }))
        tooltipNodes.forEach(node => node.remove())
        const widthWithoutTooltips = document.documentElement.scrollWidth
        savedTooltips.forEach(({ node, parent, next }) => parent?.insertBefore(node, next))
        const tableRegion = document.querySelector('.portal-table-region')
        const tableParent = tableRegion?.parentNode
        const tableNext = tableRegion?.nextSibling
        const tableStyles = tableRegion?.getAttribute('style')
        if (tableRegion) {
          tableRegion.style.contain = 'inline-size'
          tableRegion.style.width = '100%'
          tableRegion.style.minWidth = '0'
        }
        const widthWithContainedTable = document.documentElement.scrollWidth
        if (tableRegion) {
          if (tableStyles === null) tableRegion.removeAttribute('style')
          else tableRegion.setAttribute('style', tableStyles)
          tableRegion.remove()
        }
        const widthWithoutTableRegion = document.documentElement.scrollWidth
        if (tableRegion && tableParent) tableParent.insertBefore(tableRegion, tableNext)
        const pseudo = node => ['::before', '::after'].map(suffix => {
          const style = getComputedStyle(node, suffix)
          return { pseudo: suffix, content: style.content, width: style.width, position: style.position, overflowX: style.overflowX }
        })
        return {
          viewport,
          innerWidth,
          outerWidth,
          visualViewport: visualViewport && { width: visualViewport.width, scale: visualViewport.scale, offsetLeft: visualViewport.offsetLeft },
          scrollX,
          page: document.documentElement.scrollWidth,
          html: rect(document.documentElement),
          body: rect(document.body),
          causal: { tooltips: { count: tooltipNodes.length, pageWithoutTooltips: widthWithoutTooltips }, tableRegion: { widthWithContainedTable, widthWithoutTableRegion }, pseudo: { html: pseudo(document.documentElement), body: pseudo(document.body) } },
          outside,
          containers,
        }
      })()`)
      const layout = await browser.cdp('Page.getLayoutMetrics')
      const evidence = { ...dimensions, layout: layout.cssContentSize ?? layout.contentSize, layoutViewport: layout.cssLayoutViewport ?? layout.layoutViewport, visualViewport: layout.cssVisualViewport ?? layout.visualViewport }
      if (dimensions.page > dimensions.viewport + 1 && process.env.SELLER_OPERATIONS_COLLECT_OVERFLOW === '1') {
        console.warn(`${label} overflow diagnostic (collection mode only): ${JSON.stringify(evidence)}`)
      } else {
        assert.ok(dimensions.page <= dimensions.viewport + 1, `${label} overflows horizontally: ${JSON.stringify(evidence)}`)
      }
    },
  }
}

export async function captureResponsive(browser, { route, expected, settled, prefix, height = 850 }) {
  await browser.cdp('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Manila' })
  if (skipCaptures) {
    await browser.navigate(route)
    await browser.waitText(expected)
    if (settled) await browser.waitText(settled)
    await browser.until("return !document.body?.innerText.includes('Unexpected Application Error!')", `${prefix} avoids the route error boundary`)
    return
  }
  for (const theme of ['light', 'dark']) {
    for (const width of widths) {
      await browser.viewport(width, height, false)
      await browser.evaluate(`localStorage.setItem('aisley-seller-theme', '${theme}')`)
      await browser.navigate(route)
      await browser.waitText(expected)
      if (settled) await browser.waitText(settled)
      await new Promise((done) => setTimeout(done, 180))
      await browser.until("return !document.body?.innerText.includes('Unexpected Application Error!')", `${prefix} avoids the route error boundary`)
      assert.equal(await browser.evaluate("return document.documentElement.classList.contains('dark')"), theme === 'dark', `${prefix} should actually render the requested ${theme} theme at ${width}px`)
      await browser.assertNoHorizontalOverflow(`${prefix} ${width}px ${theme}`)
      await browser.screenshot(`${prefix}-${width}-${theme}.png`)
    }
  }
}

export async function pressKey(browser, key, code = key) {
  const keyCodes = { Escape: 27, Enter: 13, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowRight: 39, ArrowLeft: 37 }
  await browser.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCodes[key] ?? 0 })
  await browser.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCodes[key] ?? 0 })
}

export async function closeBrowser(browser) {
  await browser.close()
  await rm(resolve(artifacts, 'chromium/test-profile'), { recursive: true, force: true })
  await rm(resolve(repoRoot, 'node_modules/.cache/o'), { recursive: true, force: true })
}
