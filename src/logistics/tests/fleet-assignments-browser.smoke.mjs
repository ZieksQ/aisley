// Run from the repository root against a production preview and isolated Chromium CDP.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fixtureSource } from './fleet-monitoring-browser.fixtures.mjs'
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
async function key(value, code = value, keyCode = 0) {
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: value,
    code,
    windowsVirtualKeyCode: keyCode,
    text: value === 'Enter' ? '\r' : undefined
  })
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: value,
    code,
    windowsVirtualKeyCode: keyCode
  })
}
async function fill(selector, value) {
  await js(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true})); })()`
  )
}

await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Network.setBypassServiceWorker', { bypass: true })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: fixtureSource })
const directory = 'src/logistics/node_modules/.cache/fleet-assignments-browser'
await mkdir(directory, { recursive: true })
let checks = 0
async function check(value, message) { assert.equal(await js(value), true, message); checks++ }
async function navigate(path, full = false) {
  if (!full && await js('Boolean(window.monitoringFixture && document.querySelector(".portal-shell"))')) {
    await js(`window.monitoringFixture.mode = 'normal'; history.pushState(null, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate'))`)
  } else await cdp('Page.navigate', { url: origin + path })
  await until(`document.querySelector('.portal-page-heading') && !document.querySelector('.portal-skeleton')`)
  await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
}
const assignmentRows = "document.querySelectorAll('[aria-label=\"Active courier assignments\"] > li')"
const selectedRow = "document.querySelector('[aria-label=\"Active courier assignments\"] button[aria-pressed=\"true\"]')"
async function capture(name) {
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(`${directory}/${name}.png`, Buffer.from(shot.data, 'base64'))
}
try {
  if (process.env.FLEET_NO_MAP) {
    await navigate('/fleet-monitoring', true)
    await until(`${assignmentRows}.length === 6`)
    await check("document.body.innerText.includes('map provider is not configured') && !document.querySelector('.leaflet-container')", 'Unconfigured map keeps a truthful fallback')
    await js(`${assignmentRows}[0].querySelector('button').click()`)
    await check("document.body.innerText.includes('Mira Santos') && Boolean(document.querySelector('#selected-assignment-title'))", 'List selection and details work without the provider')
    await capture('unconfigured-provider')
  } else {
  for (const width of process.env.FLEET_FAST ? [] : [320, 390, 768, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    for (const dark of [false, true]) {
      await navigate('/fleet-monitoring', true)
      await until(`${assignmentRows}.length === 6`)
      await js(`document.documentElement.classList.toggle('dark', ${dark})`)
      await until("Boolean(document.querySelector('.leaflet-marker-icon'))")
      await until("!document.body.innerText.includes('Loading map tiles…')")
      await check('document.documentElement.scrollWidth <= innerWidth + 1', `No overflow at ${width}/${dark}`)
      await check("document.querySelectorAll('[aria-label=\"Map legend\"] li').length === 4", 'Legend identifies all stages and hubs')
      await check("document.querySelectorAll('.assignment-pin-count').length >= 2", 'Coincident stops combine assignments')
      await check("document.body.innerText.includes('Map shows 6 on page 1') && document.body.innerText.includes('Not live courier GPS')", 'Map scope and source stay explicit')
      await capture(`overview-${width}-${dark ? 'dark' : 'light'}`)
      await js(`${assignmentRows}[2].querySelector('button').click()`)
      await until("document.querySelector('#selected-assignment-title')?.textContent.includes('Elena Reyes')")
      await check("Boolean(document.querySelector('.assignment-pin-selected'))", 'Row selection highlights mapped stops')
      await check("document.querySelector('#selected-assignment-title').parentElement.parentElement.innerText.includes('Delivery accepted')", 'Selected work retains server status')
      await js("document.querySelector('#selected-assignment-title').scrollIntoView({block:'center'})")
      await capture(`selection-${width}-${dark ? 'dark' : 'light'}`)
      await js("window.scrollTo(0,0)")
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await navigate('/fleet-monitoring', true)
  await until("Boolean(document.querySelector('.assignment-pin-count'))")
  await js("document.querySelector('.leaflet-control-zoom-in').click()")
  await js('new Promise(resolve=>setTimeout(resolve,350))')
  const position = await js("document.querySelector('.leaflet-marker-icon').style.transform")
  await click('Refresh assignments')
  await until("!document.querySelector('[aria-label=\"Active courier assignments\"]')?.closest('section').querySelector('button[disabled]')")
  await check(`document.querySelector('.leaflet-marker-icon').style.transform === ${JSON.stringify(position)}`, 'Refresh preserves map zoom and viewport')
  await js("document.querySelector('.assignment-pin-count').closest('.leaflet-marker-icon').click()")
  await until("document.querySelectorAll('.assignment-map-popup button').length > 1")
  await js("document.querySelector('.assignment-map-popup button').click()")
  await check(`Boolean(${selectedRow}) && Boolean(document.querySelector('#selected-assignment-title'))`, 'Overlapping marker selects a specific assignment')
  await click('Last-mile')
  await until(`${assignmentRows}.length === 2`)
  await check("location.search.includes('stage=final_mile') && !document.querySelector('#selected-assignment-title')", 'Stage filter resets obsolete selection')
  await js(`${assignmentRows}[1].querySelector('button').click()`)
  await check("document.body.innerText.includes('Map pin unavailable') && document.body.innerText.includes('Ana Lopez')", 'Missing pin keeps assignment details')
  await fill('input[name=assignment_search]', 'Elena')
  await click('Search work')
  await until(`${assignmentRows}.length === 1`)
  await check("location.search.includes('assignment_search=Elena')", 'Work search persists in URL')
  await fill('input[name=search]', 'Isuzu')
  await click('Apply filters')
  await until("location.search.includes('search=Isuzu')")
  await check("location.search.includes('assignment_search=Elena') && location.search.includes('stage=final_mile')", 'Truck filters preserve assignment filters')
  await click('Clear filters')
  await until("!new URLSearchParams(location.search).has('search')")
  await js(`${assignmentRows}[0].querySelector('button').click()`)
  await js("[...document.querySelectorAll('tbody a')][1].click()")
  await until("document.body.innerText.includes('Truck overview')")
  await js("[...document.querySelectorAll('a')].find(a=>a.textContent==='Back to fleet monitoring').click()")
  await until(`${assignmentRows}.length === 1`)
  await check("document.querySelector('input[name=assignment_search]').value === 'Elena'", 'Work filters survive truck detail and Back')
  await click('Clear work search')
  await click('All stages')
  await until(`${assignmentRows}.length === 6`)
  await js("window.monitoringFixture.assignments.push(...Array.from({length:19},(_,i)=>({...window.monitoringFixture.assignments[i%6],id:'extra-'+i,reference:'WB-extra-'+i})))")
  await click('Refresh assignments')
  await until(`${assignmentRows}.length === 20`)
  await js("[...document.querySelectorAll('[aria-label=\"Assignment pagination\"] button')].find(b=>b.textContent.trim()==='Next').click()")
  await until(`${assignmentRows}.length === 5`)
  await check("location.search.includes('assignment_page=2') && document.body.innerText.includes('Map shows 5 on page 2')", 'Assignment page limits map coverage honestly')
  await js("window.monitoringFixture.assignmentMode='error'")
  await click('Refresh assignments')
  await until("document.body.innerText.includes('Displayed data is outdated')")
  await check(`${assignmentRows}.length === 5`, 'Failed refresh retains marked outdated assignments')
  await js("window.monitoringFixture.assignmentMode='normal'")
  await click('Retry')
  await until("!document.body.innerText.includes('Displayed data is outdated')")
  await js("window.monitoringFixture.assignments.splice(6)")
  await click('Refresh assignments')
  await until(`${assignmentRows}.length === 6 && location.search.includes('assignment_page=1')`)
  await check("document.body.innerText.includes('Map shows 6 on page 1')", 'Completed work clamps a disappearing last page')
  await js("window.monitoringFixture.assignmentMode='empty'")
  await click('Refresh assignments')
  await until("document.body.innerText.includes('No active assignments')")
  await check("!document.querySelector('.leaflet-marker-icon') && !document.querySelector('#selected-assignment-title')", 'Empty response removes private stops and selection')
  await navigate('/fleet-monitoring', true)
  await js("window.monitoringFixture.assignmentMode='delay'")
  await click('Refresh assignments')
  await until('window.monitoringFixture.pending.length === 1')
  await click('First-mile')
  await until('window.monitoringFixture.pending.length === 2')
  await check(`${assignmentRows}.length === 0 && !document.querySelector('.leaflet-marker-icon')`, 'New resource hides previous page during loading')
  await js("window.monitoringFixture.assignmentMode='normal'; window.monitoringFixture.pending.splice(0).forEach(resolve=>resolve())")
  await until(`${assignmentRows}.length === 2`)
  await check("[...document.querySelectorAll('[aria-label=\"Active courier assignments\"] button')].every(b=>b.textContent.includes('First-mile'))", 'Obsolete all-stage response cannot replace filtered results')
  await cdp('Page.bringToFront')
  await js(`${assignmentRows}[0].querySelector('button').focus()`)
  await check("document.activeElement?.closest('[aria-label=\"Active courier assignments\"]') !== null", 'Keyboard focus reaches assignment button')
  await key('Enter', 'Enter', 13)
  await until(`Boolean(${selectedRow})`)
  await check(`Boolean(${selectedRow})`, 'Keyboard selects assignment')
  await js("window.monitoringFixture.assignmentMode='forbidden'")
  await click('Refresh assignments')
  await until("location.pathname === '/policy-consent'")
  await check("!document.querySelector('.leaflet-marker-icon') && !document.body.innerText.includes('Mira Santos')", 'Consent loss clears map and list')
  await navigate('/fleet-monitoring', true)
  await js("window.monitoringFixture.assignmentMode='unauthorized'")
  await click('Refresh assignments')
  await until("location.pathname === '/login'")
  await check("!document.querySelector('.leaflet-marker-icon')", 'Session loss removes private pins')
  await navigate('/fleet-monitoring', true)
  await until("Boolean(document.querySelector('.leaflet-marker-icon'))")
  await js("window.monitoringFixture.assignmentMode='delay'")
  await click('Refresh assignments')
  await until('window.monitoringFixture.pending.length === 1')
  await click('Sign out')
  await until("location.pathname === '/login'")
  await js("window.monitoringFixture.pending.splice(0).forEach(resolve=>resolve())")
  await check("!document.querySelector('.leaflet-marker-icon') && !document.body.innerText.includes('Mira Santos')", 'Late response after logout cannot restore assignments')
  await navigate('/fleet-monitoring', true)
  await until("Boolean(document.querySelector('.leaflet-marker-icon'))")
  await cdp('Network.enable')
  await cdp('Network.setBlockedURLs', { urls: ['*maps.geoapify.com/*'] })
  await navigate('/fleet-monitoring?stage=linehaul')
  await until("document.body.innerText.includes('Map tiles are unavailable')")
  await check("document.querySelectorAll('.leaflet-marker-icon').length > 0 && document.body.innerText.includes('Rafael Mendoza')", 'Tile failure keeps saved markers and active work')
  await click('Retry tiles')
  await until("document.body.innerText.includes('Map tiles are unavailable')")
  await check("Boolean(document.querySelector('.assignment-pin-linehaul'))", 'Retry retains the linehaul origin truck icon')
  await cdp('Network.setBlockedURLs', { urls: [] })
  await navigate('/fleet-monitoring', true)
  await until("Boolean(document.querySelector('.leaflet-marker-icon'))")
  await until("!document.body.innerText.includes('Loading map tiles…')")
  await js("document.documentElement.classList.remove('dark')")
  await capture('final-desktop-light')
  const snapshot = await js('document.documentElement.outerHTML')
  await writeFile(`${directory}/snapshot.html`, '<!doctype html>\n' + snapshot.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/(href|src)="\/assets\//g, `$1="${origin}/assets/`))
  await js("document.documentElement.classList.add('dark')")
  const darkSnapshot = await js('document.documentElement.outerHTML')
  await writeFile(`${directory}/snapshot-dark.html`, '<!doctype html>\n' + darkSnapshot.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/(href|src)="\/assets\//g, `$1="${origin}/assets/`))
  }
  assert.deepEqual(errors, [])
  const result = { checks, responsiveCombinations: process.env.FLEET_FAST || process.env.FLEET_NO_MAP ? 0 : 8, runtimeErrors: errors }
  await writeFile(`${directory}/${process.env.FLEET_NO_MAP ? 'verification-no-map' : 'verification'}.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} finally {
  socket.close()
  await fetch(`${browser}/json/close/${target.id}`)
}
