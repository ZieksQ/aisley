import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
const artifacts = 'src/admin/node_modules/.cache/commission-browser'
const origin = 'http://127.0.0.1:15175'
const targets = await (await fetch('http://127.0.0.1:19222/json')).json()
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => ws.addEventListener('open', resolve, {once:true}))
let id = 0
const waiting = new Map()
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const pending = waiting.get(message.id)
    waiting.delete(message.id)
    if (message.error) pending.reject(message.error)
    else pending.resolve(message.result)
  }
})
function cdp(method, params = {}) { return new Promise((resolve, reject) => { const request = ++id; waiting.set(request, {resolve, reject}); ws.send(JSON.stringify({id: request, method, params})) }) }
async function js(expression) {
  const r = await cdp('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true})
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result.value
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(expression) {
  for (let i=0;i<150;i++) { if (await js(`Boolean(document.body) && Boolean(${expression})`)) return; await sleep(100) }
  throw new Error(`Timed out: ${expression}; ${await js('document.body.innerText')}`)
}
// Real Chromium, mocked HTTP only. Run from the repository root with Admin
// Vite on 15175 and Chromium remote debugging on 19222.
function mockApi() {
  const original = window.fetch.bind(window)
  const before = new Date(Date.now() - 86400000).toISOString()
  const after = new Date(Date.now() + 86400000).toISOString()
  const policy = (i) => ({
    id: `policy-${i}`, beneficiary_type: i % 2 ? 'seller' : 'logistics', rate_basis_points: 500 + i,
    status: i < 2 ? 'active' : i < 5 ? 'scheduled' : i < 8 ? 'inactive' : 'expired',
    can_publish: i >= 2 && i < 8,
    effective_at: i < 2 ? before : i < 5 ? after : i < 8 ? null : before,
    ends_at: i < 8 ? null : new Date(Date.now() - 3600000).toISOString(),
    revision: 1, created_at: before,
  })
  const state = window.commissionFixture = { policies: Array.from({length:23}, (_,i)=>policy(i)), writes: [], error: null, delay: 100, reads: 0 }
  const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json'}})
  window.fetch = async (url, options={}) => {
    const path = new URL(url, location.origin).pathname
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(url,options)
    if (path.endsWith('/auth/me')) return json({admin:{id:'admin',role:'admin',status:'active',email:'test@example.com',profile:{first_name:'Test',last_name:'Admin'},permissions:sessionStorage.getItem('commission-readonly') ? ['finance.view'] : ['finance.view','finance.manage']}})
    if (path.endsWith('/policy-consent/status')) return json({data:{all_required_accepted:true,policies:[]}})
    if (!path.includes('/commission-policies')) return json({data:[],items:[],unread_count:0})
    const method = options.method ?? 'GET'
    await new Promise(resolve=>setTimeout(resolve,state.delay))
    if (method === 'GET') {
      state.reads++
      if (state.error === 'read') return json({message:'Policy history unavailable.'},503)
      return json({data:state.policies})
    }
    state.writes.push({path,body:JSON.parse(options.body)})
    if (state.error === 'validation') return json({message:'Check the commission rate.',errors:{rate_basis_points:['Rate rejected by server.']}},422)
    if (state.error === 'uncertain') throw new TypeError('Offline response')
    if (path.endsWith('/publish')) {
      const target = state.policies.find(p=>path.includes(`/${p.id}/`))
      const future = target.effective_at && new Date(target.effective_at).getTime() > Date.now()
      if (!future) for (const p of state.policies) if (p.status === 'active' && p.beneficiary_type === target.beneficiary_type) {p.status='expired';p.ends_at=new Date().toISOString()}
      target.status = future ? 'scheduled' : 'active'
      target.can_publish = false
      target.effective_at ??= new Date().toISOString()
      return json({data:target})
    }
    const payload=JSON.parse(options.body)
    const created={...policy(state.policies.length),...payload,id:payload.effective_at ? 'created-scheduled' : 'created',status:payload.effective_at ? 'scheduled' : 'inactive',can_publish:true,ends_at:null}
    state.policies.push(created)
    return json({data:created},201)
  }
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`(${mockApi.toString()})();`})
async function navigate() {
  await cdp('Page.navigate',{url:origin+'/pricing-and-fees?section=commissions'})
  await until('!!document.querySelector("table tbody")')
}
async function click(selector) {
  const point = await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error("Missing control");e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`)
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point})
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
  await sleep(120)
}
async function button(text, scope='document') {
  await js(`(()=>{const e=[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw new Error('Missing '+${JSON.stringify(text)});e.focus();e.click()})()`)
  await sleep(120)
}
async function key(key, modifiers=0) {
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,modifiers,windowsVirtualKeyCode:{Tab:9,Escape:27,Enter:13}[key] ?? 0})
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,modifiers,windowsVirtualKeyCode:{Tab:9,Escape:27,Enter:13}[key] ?? 0})
}
async function input(selector, value) {
  await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
}
const rowCount = 'document.querySelectorAll("table tbody tr").length'
const dialog = 'document.querySelector("dialog[open]")'
try {
  await js('sessionStorage.removeItem("commission-readonly")')
  await navigate()
  assert.equal(await js(rowCount),10)
  await button('Next')
  assert.equal(await js(rowCount),10)
  await button('Next')
  assert.equal(await js(rowCount),3)
  assert.equal(await js('[...document.querySelectorAll("nav button")].find(e=>e.textContent==="Next").disabled'),true)
  await click('button[aria-label="Sort by status"]')
  assert.equal(await js('document.querySelector("th[aria-sort=ascending]").textContent.trim()'),'Status')
  assert.equal(await js('document.querySelector("table tbody tr td:nth-child(3)").textContent'),'active')
  assert.equal(await js(`document.querySelector('nav[aria-label="Commission policy pagination"]').textContent.includes('Page 1 of 3')`),true)
  await click('button[aria-label="Sort by status"]')
  assert.equal(await js('document.querySelector("table tbody tr td:nth-child(3)").textContent'),'expired')
  for (const name of ['beneficiary','rate','effective','ends']) await click(`button[aria-label="Sort by ${name}"]`)
  await click('button[aria-label="Sort by status"]')
  for (const width of [320,390,768,1280]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:false})
    for (const theme of ['light','dark']) {
      await js(`document.documentElement.classList.toggle('dark',${theme==='dark'})`)
      assert.equal(await js('document.documentElement.scrollWidth <= innerWidth+2'),true,`page overflow ${width} ${theme}`)
      await button('New commission policy')
      await until(dialog)
      assert.equal(await js(`getComputedStyle(${dialog}).backgroundColor`),theme==='dark'?'rgb(23, 17, 29)':'rgb(255, 255, 255)')
      assert.equal(await js(`(()=>{const b=${dialog}.getBoundingClientRect();return b.width<=innerWidth && b.height<=innerHeight})()`),true,'dialog bounds')
      for(let i=0;i<10;i++) { await key('Tab'); assert.equal(await js(`${dialog}.contains(document.activeElement)`),true,'focus containment') }
      await key('Escape')
      await until(`!${dialog}`)
      assert.equal(await js('document.activeElement.textContent.trim()'),'New commission policy','focus restoration')
    }
  }
  await writeFile(`${artifacts}/history.png`,Buffer.from((await cdp('Page.captureScreenshot')).data,'base64'))
  await button('New commission policy')
  await input('#commission-rate','7.25')
  await button('Cancel','document.querySelector("dialog")')
  await until('document.querySelector("dialog").textContent.includes("Discard commission policy?")')
  await button('Keep editing','document.querySelector("dialog")')
  assert.equal(await js('document.querySelector("#commission-rate").value'),'7.25')
  await js('commissionFixture.error="validation"')
  await button('Save policy','document.querySelector("dialog")')
  await until('document.body.innerText.includes("Rate rejected by server.")')
  assert.equal(await js('document.querySelector("#commission-rate").value'),'7.25')
  await js('commissionFixture.error=null')
  await button('Save policy','document.querySelector("dialog")')
  await until(`!${dialog} && commissionFixture.policies.length===24`)
  assert.equal(await js('commissionFixture.writes.at(-1).body.effective_at'),null)
  assert.equal(await js('commissionFixture.writes.at(-1).body.rate_basis_points'),725)
  await until('!document.body.innerText.includes("Loading commission policies")')
  // Sort inactivity first so the new unscheduled policy appears on page one.
  await click('button[aria-label="Sort by status"]')
  await button('Next')
  await until(`!!document.querySelector('button[aria-label="Publish seller commission at 7.25%"]')`)
  await click('button[aria-label="Publish seller commission at 7.25%"]')
  const writes = await js('commissionFixture.writes.length')
  assert.equal(await js('document.querySelector("dialog").textContent.includes("immediately")'),true)
  assert.equal(await js('document.activeElement.textContent'),'Cancel','safe initial focus')
  await button('Cancel','document.querySelector("dialog")')
  assert.equal(await js('commissionFixture.writes.length'),writes,'cancel published policy')
  await click('button[aria-label="Publish seller commission at 7.25%"]')
  await button('Confirm publish','document.querySelector("dialog")')
  await until(`!${dialog} && commissionFixture.policies.find(p=>p.id==='created').status==='active'`)
  assert.equal(await js('commissionFixture.writes.length'),writes+1)
  assert.equal(await js('commissionFixture.policies.find(p=>p.id==="policy-1").status'),'expired')
  assert.equal(await js('commissionFixture.policies.find(p=>p.id==="policy-0").status'),'active')
  await until('!document.body.innerText.includes("Loading commission policies")')
  await button('New commission policy')
  await input('#commission-rate','9')
  await click('dialog input[type=checkbox]')
  assert.equal(await js('!!document.querySelector("#commission-effective")'),true)
  await button('Save policy','document.querySelector("dialog")')
  await until(`!${dialog} && commissionFixture.policies.some(p=>p.id==='created-scheduled')`)
  assert.equal(await js('commissionFixture.writes.at(-1).body.effective_at !== null'),true)
  await until('!document.body.innerText.includes("Loading commission policies")')
  await click('button[aria-label="Publish seller commission at 9.00%"]')
  assert.equal(await js('document.querySelector("dialog").textContent.includes("effective")'),true)
  await js('commissionFixture.delay=600; const b=[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="Confirm publish"); b.click(); b.click()')
  await key('Escape')
  assert.equal(await js(`Boolean(${dialog})`),true,'busy dialog escaped')
  await until(`!${dialog} && !commissionFixture.policies.find(p=>p.id==='created-scheduled').can_publish`)
  assert.equal(await js('commissionFixture.policies.find(p=>p.id==="created").status'),'active','future publication expired the active policy early')
  assert.equal(await js('commissionFixture.writes.filter(w=>w.path.includes("created-scheduled/publish")).length'),1,'duplicate publication')
  await js('commissionFixture.delay=100')
  await until('!document.body.innerText.includes("Loading commission policies")')
  await button('New commission policy')
  await js('commissionFixture.error="uncertain"')
  await button('Save policy','document.querySelector("dialog")')
  await until('document.body.innerText.includes("Creation could not be confirmed")')
  assert.equal(await js('document.querySelector("dialog button[type=submit]")'),null,'uncertain create can be repeated')
  await button('Review policy history','document.querySelector("dialog")')
  await until(`!${dialog}`)
  await js('commissionFixture.error="read"')
  await button('Refresh')
  await until('document.body.innerText.includes("Policy history unavailable")')
  assert.equal(await js('!!document.querySelector("table")'),false,'failed read shown as valid history')
  await js('commissionFixture.error=null')
  await button('Retry')
  await until('!!document.querySelector("table")')
  await js('commissionFixture.policies=[]')
  await button('Refresh')
  await until('document.body.innerText.includes("Create and publish both Seller and Logistics")')
  await js('sessionStorage.setItem("commission-readonly","1")')
  await navigate()
  assert.equal(await js('[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="New commission policy" || e.textContent.trim()==="Publish")'),false)
  console.log('Commission browser smoke passed: 10-row paging, reversible column sorting, both themes at 320/390/768/1280px, dialog bounds/focus/Escape/restoration, unsaved discard, validation recovery, create/publish/cancel, beneficiary isolation, uncertain creation, read failure/retry, empty history, and read-only access.')
} finally {
  ws.close()
}
