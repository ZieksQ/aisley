// Run from the repository root against a production preview and isolated Chromium CDP.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { installMonitoringFixtures } from './fleet-monitoring-browser.fixtures.mjs'
import { installTransportFixtures } from './transport-browser.fixtures.mjs'
const origin = process.env.LOGISTICS_UI_ORIGIN ?? 'http://127.0.0.1:5187'
const browser = process.env.LOGISTICS_UI_CDP ?? 'http://127.0.0.1:19359'
const target = await (
  await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })
).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) =>
  socket.addEventListener('open', resolve, { once: true })
)
const pending = new Map()
const errors = []
let serial = 0
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data)
  if (data.method === 'Runtime.exceptionThrown')
    errors.push(
      data.params.exceptionDetails.exception?.description ??
        data.params.exceptionDetails.text
    )
  if (data.method === 'Page.javascriptDialogOpening')
    void cdp('Page.handleJavaScriptDialog', { accept: true })
  if (!data.id) return
  const call = pending.get(data.id)
  if (!call) return
  pending.delete(data.id)
  clearTimeout(call.timer)
  if (data.error) call.reject(data.error)
  else call.resolve(data.result)
})
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP timeout: ${method}`))
    }, 20000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function js(expression) {
  const data = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  })
  if (data.exceptionDetails)
    throw new Error(JSON.stringify(data.exceptionDetails))
  return data.result.value
}
async function until(expression) {
  for (let count = 0; count < 400; count++) {
    if (await js(`Boolean(document.body && (${expression}))`)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(
    `Timed out: ${expression}\n${await js('JSON.stringify({text:document.body?.innerText,url:location.href,ready:document.readyState})')}\n${errors.join('\n')}`
  )
}
const button = (label) =>
  `[...document.querySelectorAll('button')].find(b=>b.textContent.trim() === ${JSON.stringify(label)})`
async function click(label) {
  await until(`${button(label)} && !${button(label)}.disabled`)
  await js(`${button(label)}.focus(); ${button(label)}.click()`)
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `(${installTransportFixtures.toString()})(); (${installMonitoringFixtures.toString()})();`
})
const before = process.argv.includes('--before')
const directory = `src/logistics/node_modules/.cache/linehaul-outbound/${before ? 'before' : 'after'}`
await mkdir(directory, { recursive: true })
let checks = 0
async function check(expression, message) { assert.equal(await js(expression), true, message); checks++ }
async function navigate(path) {
  await js(`history.pushState(null, '', ${JSON.stringify(path)}); dispatchEvent(new PopStateEvent('popstate'))`)
  await until("!document.querySelector('.portal-skeleton') && (document.querySelector('.transport-heading') || document.querySelector('.portal-page-heading'))")
}
async function snapshot(name) {
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(`${directory}/${name}.png`, Buffer.from(shot.data, 'base64'))
}
try {
  await cdp('Page.bringToFront')
  await cdp('Page.navigate', { url: origin + '/linehaul-dispatch' })
  await until("document.querySelector('tbody tr') && window.transportFixture")
  await js(`(() => {
    const first = window.transportFixture.trips.outbound[0];
    Object.assign(first, { id: 'active-1', truck: { ...first.truck, id: 'truck-1' } });
    window.transportFixture.trips.outbound.push(
      { ...first, id: 'blocked', lane_blocked: true, parcels: [{ sorting_assignment: { lane: { code: 'Long-source-lane-reference-for-overflow-check' } }, lane: { operational_state: 'closed', blocking_reason: 'Source lane closed for reconciliation' } }], from_hub: { name: 'San Pedro distribution and consolidation hub with extended route information' } },
      { ...first, id: 'pending', status: 'pending_acceptance', can_release: false, can_depart: false },
      { ...first, id: 'transit', status: 'in_transfer', can_release: false, can_depart: false }
    );
  })()`)
  await click('Refresh')
  await until("document.querySelectorAll('tbody tr').length === 4")
  for (const width of [390, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    for (const dark of [false, true]) {
      await js(`document.documentElement.classList.toggle('dark', ${dark}); document.querySelector('.transport-panel').scrollIntoView()`)
      await check('document.documentElement.scrollWidth <= innerWidth + 1', `Contained overflow ${width}/${dark}`)
      if (!before) {
        await check("[...document.querySelectorAll('.linehaul-outbound-table tbody td')].every(td => getComputedStyle(td).paddingTop === '8px' && getComputedStyle(td).paddingLeft === '16px')", 'Compact consistent cell insets')
        await check("[...document.querySelectorAll('.linehaul-outbound-actions button')].every(b => b.getBoundingClientRect().height >= 44)", 'Touch targets maintained')
        await check("document.querySelectorAll('.linehaul-outbound-table th').length === 6", 'Status separate from actions')
      }
      await snapshot(`${width}-${dark ? 'dark' : 'light'}`)
    }
  }
  let html = await js(`(() => {
    const root = document.documentElement.cloneNode(true);
    root.querySelectorAll('script').forEach(script => script.remove());
    return '<!doctype html>' + root.outerHTML.replaceAll('href="/','href="${origin}/').replaceAll('src="/','src="${origin}/');
  })()`)
  // Inline build assets so static inspection does not depend on cross-origin reads.
  for (const match of html.matchAll(/<link[^>]*href="([^"]+\.css)"[^>]*>/g)) {
    const path = new URL(match[1]).pathname;
    if (!path.startsWith('/assets/')) continue;
    let css = await readFile(`src/logistics/dist${path}`, 'utf8');
    for (const font of css.matchAll(/url\((\/assets\/[^)]+\.woff2)\)/g)) {
      const bytes = await readFile(`src/logistics/dist${font[1]}`);
      css = css.replaceAll(font[0], `url(data:font/woff2;base64,${bytes.toString('base64')})`);
    }
    html = html.replace(match[0], `<style>${css}</style>`);
  }
  for (const match of html.matchAll(/src="https?:[^" ]+(\/assets\/[^" ]+\.svg)"/g)) {
    const bytes = await readFile(`src/logistics/dist${match[1]}`);
    html = html.replaceAll(match[0], `src="data:image/svg+xml;base64,${bytes.toString('base64')}"`);
  }
  await writeFile(`${directory}/snapshot.html`, html);
  if (before) { console.log(JSON.stringify({ directory, checks })); }
  else {
    await check("document.querySelectorAll('tbody tr')[1].querySelector('button').disabled", 'Blocked release disabled')
    await js("document.querySelector('tbody tr button').click()")
    await until("window.transportFixture.writes.length > 0")
    await check("location.pathname === '/linehaul-dispatch'", 'Action does not navigate')
    await js("document.querySelector('tbody tr td:nth-child(2)').click()")
    await until("location.pathname === '/fleet-monitoring/truck-1' && document.querySelector('#active-trip')")
    await check("location.search.includes('trip_id=active-1') && document.querySelector('#active-trip').innerText.includes('Davao hub')", 'Row opens exact active trip')
    await until("document.activeElement.id === 'active-trip'")
    await snapshot('selected-trip')
    await check("document.querySelector('#active-trip').getBoundingClientRect().top >= -1", 'Selected section revealed')
    await check("![...document.querySelectorAll('.portal-page a')].some(a => a.search.includes('trip_id'))", 'Onward links omit selection')
    await js('history.back()')
    await until("location.pathname === '/linehaul-dispatch' && document.querySelector('tbody tr')")
    await js("document.querySelector('tbody tr a').focus()")
    await check("document.activeElement.tagName === 'A'", 'Route is a native keyboard link')
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await until("location.pathname === '/fleet-monitoring/truck-1' && document.querySelector('#active-trip')")
    await navigate('/fleet-monitoring/truck-1?trip_id=trip-2&search=NDR&history_page=2#active-trip')
    await until("location.pathname === '/fleet-monitoring/truck-1/history/trip-2' && document.body.innerText.includes('Recorded events')")
    await snapshot('selected-past-transfer')
    await check("location.search.includes('search=NDR') && location.search.includes('history_page=2') && !location.search.includes('trip_id')", 'Terminal trip resolves to history preserving filters')
    await navigate('/fleet-monitoring/truck-1?trip_id=unknown#active-trip')
    await until("document.body.innerText.includes('Selected trip unavailable')")
    await snapshot('selected-trip-unavailable')
    await check("!document.querySelector('#active-trip').innerText.includes('Rafael Mendoza')", 'Different active trip never substituted')
    await navigate('/fleet-monitoring/truck-1?trip_id=active-1#active-trip')
    await until("document.querySelector('#active-trip')?.innerText.includes('Rafael Mendoza')")
    await js("window.monitoringFixture.mode = 'error'")
    await click('Refresh')
    await until("document.body.innerText.includes('Monitoring connection interrupted.')")
    await check("document.querySelector('#active-trip').innerText.includes('Rafael Mendoza')", 'Same-trip stale data retained')
    await js("window.monitoringFixture.mode = 'normal'")
    await click('Refresh')
    await until("!document.body.innerText.includes('Monitoring connection interrupted.')")
    await js(`(() => {
      const original = window.fetch;
      window.replaceOutboundTrip = true;
      window.fetch = async (...args) => {
        const response = await original(...args);
        if (window.replaceOutboundTrip && new URL(String(args[0]), location.origin).pathname === '/api/v1/logistics/fleet/monitoring/truck-1') {
          const body = await response.json();
          body.data.active_trip.id = 'replacement-trip';
          return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
        }
        return response;
      };
    })()`)
    await click('Refresh')
    await until("document.body.innerText.includes('Selected trip unavailable')")
    await check("!document.querySelector('#active-trip').innerText.includes('Rafael Mendoza')", 'Changed assignment on refresh never replaces requested trip')
    await js('window.replaceOutboundTrip = false')
    await click('Refresh')
    await until("document.querySelector('#active-trip')?.innerText.includes('Rafael Mendoza')")
    await navigate('/fleet-monitoring/missing?trip_id=active-1')
    await until("document.body.innerText.includes('Truck unavailable')")
    await navigate('/linehaul-dispatch')
    await js('window.transportFixture.trips.outbound = []')
    await click('Refresh')
    await until("document.body.innerText.includes('No active outbound trips')")
    assert.deepEqual(errors, [], 'No runtime exceptions')
    await writeFile(`${directory}/verification.json`, JSON.stringify({ checks, errors }, null, 2))
    console.log(JSON.stringify({ directory, checks, errors }))
  }
} finally {
  socket.close()
  await fetch(`${browser}/json/close/${target.id}`)
}
