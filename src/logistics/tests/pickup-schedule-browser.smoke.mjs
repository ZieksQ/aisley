// Run from the repository root against a production preview and isolated Chromium CDP.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { installRatesFleetFixtures } from './rates-fleet-browser.fixtures.mjs'
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
function installPickupFixtures() {
  const original = window.fetch.bind(window)
  const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json'}})
  const courier = {id:'courier-1', name:'Cora Rider', email:'cora@example.test'}
  const pickups = [1,3,3].map((count, group) => ({id:`pickup-${group}`,shop:{id:`shop-${group}`,name:`Seller ${group + 1}`},created_at:'2026-11-11T00:00:00Z',parcel_count:count,orders:Array.from({length:count},(_,i)=>({id:`order-${group}-${i}`,reference:`ASL-${group}-${i}`,status:'ready_for_pickup',waybill:{id:`waybill-${group}-${i}`,reference:`TRACK-${group}-${i}`}}))}))
  const schedule = {id:'schedule-1',reference:'PUS-SEVEN',status:'scheduled',courier_id:courier.id,courier,starts_at:'2026-11-12T00:00:00Z',ends_at:null,revision:1,parcel_count:7,remaining_parcel_count:7,pickup_requests:pickups}
  window.pickupFixture = {mode:'normal'}
  window.fetch = async (input, options) => {
    const url = new URL(String(input),location.origin)
    if(url.pathname.endsWith('/pickup-couriers')) return json({data:[]})
    if(url.pathname.endsWith('/pickup-schedules')) return json({data:[schedule],meta:{current_page:1,last_page:1,total:1,per_page:25}})
    if(url.pathname.endsWith('/pickup-schedules/schedule-1')) {
      if(window.pickupFixture.mode === 'error') return json({message:'Schedule connection failed'},503)
      if(window.pickupFixture.mode === 'missing') return json({message:'Schedule unavailable'},404)
      return json({data:window.pickupFixture.mode === 'empty' ? {...schedule,parcel_count:0,pickup_requests:[]} : schedule})
    }
    return original(input, options)
  }
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(${installRatesFleetFixtures.toString()})(); (${installPickupFixtures.toString()})();`})
let checks=0
const directory='src/logistics/node_modules/.cache/pickup-schedule-browser'
await mkdir(directory,{recursive:true})
try {
 for(const width of [320,390,768,1440]) {
  for(const dark of [false,true]) {
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
   await cdp('Page.navigate',{url:origin+'/pickups'})
   await until(`document.body.innerText.includes('PUS-SEVEN')`)
   assert.equal(await js(`document.querySelector('a[aria-label="Open PUS-SEVEN pickup information"]').getAttribute('href')`),'/pickups/schedules/schedule-1');checks++
   await js(`document.querySelector('a[aria-label="Open PUS-SEVEN pickup information"]').click()`)
   await until(`document.body.innerText.includes('ASL-2-2')`)
   assert.equal(await js(`document.body.innerText.includes('Page not found')`),false);checks++
   await js(`document.documentElement.classList.toggle('dark',${dark})`)
   assert.equal(await js(`document.querySelectorAll('section ul li').length`),7);checks++
   assert.equal(await js(`document.querySelectorAll('a[href^="/pickups/pickup-"]').length`),3);checks++
   assert.equal(await js(`document.documentElement.scrollWidth <= innerWidth`),true);checks++
   await js(`window.pickupFixture.mode='error'; [...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh').click()`)
   await until(`document.body.innerText.includes('Schedule connection failed')`)
   assert.equal(await js(`document.querySelectorAll('section ul li').length`),7);checks++
   await js(`window.pickupFixture.mode='normal'; [...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh').click()`)
   await until(`!document.body.innerText.includes('Schedule connection failed')`)
   const capture=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
   await writeFile(`${directory}/${width}-${dark?'dark':'light'}.png`,Buffer.from(capture.data,'base64'))
  }
 }
 await js(`window.pickupFixture.mode='empty'; [...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh').click()`)
 await until(`document.body.innerText.includes('No parcels are linked')`);checks++
 await js(`window.pickupFixture.mode='missing'; [...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh').click()`)
 await until(`document.body.innerText.includes('Schedule unavailable')`)
 assert.equal(await js(`document.querySelectorAll('section ul li').length`),0);checks++
 await cdp('Page.navigate',{url:origin+'/pickups/schedules/schedule-1'})
 await until(`document.body.innerText.includes('ASL-2-2')`);checks++
 assert.deepEqual(errors,[])
 console.log(`${checks} pickup schedule browser checks passed`)
} finally {
 await cdp('Page.close')
 socket.close()
}
