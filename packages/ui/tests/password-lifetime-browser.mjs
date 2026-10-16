// Actual role auth providers, password clients and React form; synthetic HTTP only.
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { openChatBrowser } from './chat-browser-driver.mjs'
const require = createRequire(resolve('src/seller/package.json'))
const ts = require('typescript')
const dependencies = createRequire(require.resolve('react-dom/client'))
function production(name, file) {
  return readFileSync(resolve(dirname(dependencies.resolve(`${name}/package.json`)), 'cjs', file), 'utf8')
}
function compile(file, replacements = {}) {
  let source = readFileSync(file, 'utf8')
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to)
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
}
const modules = {
  react: production('react', 'react.production.js'), 'react/jsx-runtime': production('react', 'react-jsx-runtime.production.js'),
  'react-dom': production('react-dom', 'react-dom.production.js'), 'react-dom/client': production('react-dom', 'react-dom-client.production.js'),
  scheduler: production('scheduler', 'scheduler.production.js'),
  '@aisley/ui/password-change': compile('packages/ui/src/password-change/index.ts'),
  './session': compile('packages/ui/src/password-change/session.ts'),
  './PasswordChangeForm': compile('packages/ui/src/password-change/PasswordChangeForm.tsx'),
  './use-password-change': compile('packages/ui/src/password-change/use-password-change.ts'),
  './customer-provider': compile('src/webapp/src/components/auth/auth-provider.tsx'),
  './seller-provider': compile('src/seller/src/auth/AuthContext.tsx', {"'./context'": "'./seller-context'"}),
  './logistics-provider': compile('src/logistics/src/auth/AuthContext.tsx', {"'./context'": "'./logistics-context'"}),
  './seller-context': compile('src/seller/src/auth/context.ts'), './logistics-context': compile('src/logistics/src/auth/context.ts'),
  '@/lib/auth/session-controller': compile('src/webapp/src/lib/auth/session-controller.ts'),
  './customer-client': compile('src/webapp/src/lib/account/client.ts'),
  './seller-client': compile('src/seller/src/lib/password-change.ts'),
  './logistics-client': compile('src/logistics/src/lib/password-change.ts'),
  '@aisley/ui': "exports.Button=(props)=>require('react').createElement('button',props);",
  '@aisley/ui/chat': 'exports.clearChatPrivateState=()=>{};', '@/lib/checkout/placement': 'exports.clearCheckoutPlacement=()=>{};',
  '@/lib/auth/session-events': 'exports.advanceSessionRevision=()=>{};exports.isInvalidSession=(status)=>status===401;exports.subscribeToSessionFailures=()=>()=>{};',
  '../features/linehaulReceiving/offlineSession': 'exports.clearReceivingSession=()=>{};exports.rememberReceivingSession=()=>{};exports.offlineReceivingSession=()=>null;',
  '../features/linehaulReceiving/db': 'exports.clearLinehaulReceiving=async()=>{};',
  '../lib/parcelSearchDb': 'exports.clearParcelSearchCache=async()=>{};',
  '../lib/sortingDb': 'exports.sortingDb={captures:{clear:async()=>{}}};',
}
const transport = `class ApiError extends Error{constructor(status,payload={}){super(payload.message||'Synthetic rejection');this.status=status;this.code=payload.code;this.errors=payload.errors||{};this.retryAfter=payload.retryAfter;}}
exports.ApiError=ApiError;exports.initializeCsrf=exports.csrf=async(signal)=>{if(window.csrfPending)await new Promise(resolve=>window.releaseCsrf=resolve);if(signal?.aborted)throw new Error('Aborted');};
exports.apiRequest=exports.request=async(path,options={})=>{
if(path.endsWith('/auth/me')||path.endsWith('/auth/login'))return {customer:window.identity,seller:window.identity,logistics:window.identity};
if(path.endsWith('/auth/logout'))return {message:'Signed out'};
window.calls.push(path);if(window.delayed)await new Promise(resolve=>window.release=resolve);
if(options.signal?.aborted)throw new Error('Aborted');
if(window.networkFailure)throw new Error('Synthetic network failure');
if(window.failureStatus)throw new ApiError(window.failureStatus,{retryAfter:2});
if(path.endsWith('/verification-code'))return {data:{challenge_id:'00000000-0000-4000-8000-000000000001',masked_email:'b***@example.test',expires_at:new Date(Date.now()+600000).toISOString(),resend_available_at:new Date(Date.now()+60000).toISOString()}};
if(window.malformed)return {};return {message:'Password updated successfully.'};};`
for (const name of ['@/lib/api', '../lib/api', './api']) modules[name] = transport
const artifacts = resolve('node_modules/.cache/password-change-browser/b11')
mkdirSync(artifacts, { recursive: true })
const assets = resolve('src/seller/dist/assets')
const css = readdirSync(assets).filter(name => name.endsWith('.css')).map(name => readFileSync(resolve(assets, name), 'utf8')).join('\n')
const browser = await openChatBrowser()
const js = browser.evaluate
const source = `const process={env:{NODE_ENV:'production'}};const sources=${JSON.stringify(modules)},cache={};
function require(name){if(cache[name])return cache[name].exports;if(!sources[name])throw Error('Missing '+name);const module={exports:{}};cache[name]=module;new Function('module','exports','require',sources[name])(module,module.exports,require);return module.exports;}
const React=require('react'),UI=require('@aisley/ui/password-change'),root=require('react-dom/client').createRoot(document.getElementById('root'));
const realNow=Date.now.bind(Date);window.offset=0;Date.now=()=>realNow()+window.offset;
window.identity={id:'account-a',role:'customer',status:'active',displayName:'Synthetic account'};window.sequence=0;window.screen=0;window.visible=true;
function Content(){let ctx; if(window.role==='customer')ctx=require('./customer-provider').useAuth();else ctx=React.useContext(require('./'+window.role+'-context').AuthContext);window.ctx=ctx;window.renderedSequence=window.sequence;const client=require('./'+window.role+'-client');if(!window.visible)return React.createElement('p',null,'Another account screen');const props={session:ctx.passwordSession,sessionDescription:'This browser stays signed in.',accent:window.role==='logistics'?'blue':'purple',requestCode:client.requestCustomerPasswordCode||client.requestPasswordCode,updatePassword:client.updateCustomerPassword||client.updatePassword};return React.createElement(React.Fragment,null,React.createElement(UI.PasswordChangeForm,{...props,key:window.screen}),window.second?React.createElement(UI.PasswordChangeForm,{...props,key:'second'}):null);}
window.render=()=>root.render(React.createElement(require('./'+window.role+'-provider').AuthProvider,{key:window.sequence},React.createElement(Content)));
window.start=(role)=>{window.role=role;window.identity={...window.identity,id:'account-a',role};window.sequence++;window.screen++;window.calls=[];window.offset=0;window.failureStatus=0;window.networkFailure=false;window.malformed=false;window.delayed=false;window.csrfPending=false;window.second=false;window.visible=true;window.render();};
window.navigate=(visible)=>{window.visible=visible;window.screen++;window.render();};`
async function fill(name, value) {
  await js(`(()=>{const el=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
}
async function click(text) {
  await js(`(()=>{const el=[...document.querySelectorAll('button')].find(el=>el.textContent===${JSON.stringify(text)});if(!el||el.disabled)throw Error('Missing/enabled '+${JSON.stringify(text)});el.click();})()`)
}
async function start(role) {
  await js(`window.start('${role}')`)
  await browser.until("window.renderedSequence===window.sequence && window.ctx.passwordSession.getSnapshot().phase==='ready' && !!document.querySelector('[name=current_password]') && !document.querySelector('button[type=submit]').disabled", 'authenticated form')
}
async function code() {
  for (const name of ['current_password', 'password', 'password_confirmation']) await fill(name, name === 'current_password' ? 'Synthetic123' : 'Synthetic456')
  await click('Send verification code')
  await browser.until("!!document.querySelector('[name=verification_code]')", 'challenge')
  await fill('verification_code', '012345')
}
async function reopen() {
  await js('window.navigate(false)')
  await browser.until("document.body.innerText.includes('Another account screen')", 'leave password screen')
  await js('window.navigate(true)')
  await browser.until("!!document.querySelector('form')", 'reopen password screen')
}
async function assertBlocked() {
  assert(await js("document.querySelector('button[type=submit]').disabled"))
  assert.equal(await js('window.ctx.passwordSession.begin(false)'), null)
  assert.equal(await js('window.ctx.passwordSession.begin(true)'), null)
  assert.equal(await js('window.calls.length'), 2)
}
try {
  await js(`document.head.innerHTML='<meta name=viewport content="width=device-width,initial-scale=1">';document.body.innerHTML=${JSON.stringify('<style>'+css+'</style><main id="root" class="mx-auto max-w-xl p-5"></main>')}`)
  await js(source)
  for (const role of ['customer', 'seller', 'logistics']) {
    for (const failure of [0, 408, 500, 'decode']) {
      await start(role); await code()
      await js(failure === 'decode' ? 'window.malformed=true' : failure === 0 ? 'window.networkFailure=true' : `window.failureStatus=${failure}`)
      await click('Verify and update password')
      await browser.until("document.body.innerText.includes('outcome is uncertain')", 'uncertain confirmation')
      await reopen(); await assertBlocked()
      await click('Cancel'); await js('window.offset=601000')
      await assertBlocked()
      if (role === 'customer') await js('window.ctx.setAuthenticatedCustomer(window.identity);window.ctx.refresh()')
      else if (role === 'seller') await js('window.ctx.updateSeller(window.identity)')
      else await js('window.ctx.refresh()')
      await assertBlocked()
      for (const width of [320, 390, 768, 1440]) {
        await browser.viewport(width)
        assert(await js('document.documentElement.scrollWidth<=innerWidth'), `${role} recovery overflow ${width}`)
      }
      for (const theme of role === 'customer' ? ['light'] : ['light', 'dark']) {
        await js(`document.documentElement.classList.toggle('dark', '${theme}'==='dark')`)
        await browser.screenshot(resolve(artifacts, `${role}-${theme}-recovery.png`))
      }
      await js("document.documentElement.classList.remove('dark');window.ctx.logout()")
      await js(role === 'customer' ? 'window.ctx.setAuthenticatedCustomer(window.identity,true)' : 'window.ctx.login({})')
      await browser.until("window.ctx.passwordSession.getSnapshot().phase==='ready'", 'fresh sign-in reset')
    }
    for (const outcome of ['success', '422', 'uncertain']) {
      await start(role); await code(); await js('window.delayed=true')
      await click('Verify and update password'); await browser.until('!!window.release', 'pending confirmation')
      await reopen(); await assertBlocked()
      assert(await js("document.body.innerText.includes('still pending')"))
      await js(`window.failureStatus=${outcome === '422' ? 422 : outcome === 'uncertain' ? 500 : 0};window.delayed=false;window.release()`)
      await browser.until("window.ctx.passwordSession.getSnapshot().phase!=='confirming'", 'settled disposed confirmation')
      assert.equal(await js('window.ctx.passwordSession.getSnapshot().phase'), outcome === 'uncertain' ? 'reconciliation' : 'ready')
      assert.equal(await js('document.querySelectorAll("[name=verification_code]").length'), 0)
      assert.equal(await js('window.calls.length'), 2)
    }
    // An old completion cannot clear a newer session's pending operation.
    for (const identity of ['account-a', 'account-b']) {
      await start(role); await code(); await js('window.delayed=true')
      await click('Verify and update password'); await browser.until('!!window.release', 'old confirmation')
      await js('window.navigate(false);window.ctx.logout()')
      await js(`window.identity={...window.identity,id:'${identity}'};window.failureStatus=0`)
      await js(role === 'customer' ? 'window.ctx.setAuthenticatedCustomer(window.identity,true)' : 'window.ctx.login({})')
      await js("window.newOperation=window.ctx.passwordSession.begin(true);window.release()")
      await js('new Promise(resolve=>setTimeout(resolve,100))')
      assert.equal(await js('window.ctx.passwordSession.getSnapshot().phase'), 'confirming')
      await js('window.ctx.passwordSession.settle(window.newOperation)')
    }
    await start(role); await code(); await click('Cancel'); await reopen()
    assert(await js("document.querySelector('button[type=submit]').disabled"))
    await js('window.offset=61000')
    await browser.until("!document.querySelector('button[type=submit]').disabled", 'preserved cooldown expiry')
    // Identity changes while awaiting CSRF must prevent password dispatch.
    await code(); await js('window.csrfPending=true')
    await click('Verify and update password'); await browser.until('!!window.releaseCsrf', 'pending CSRF')
    await js("window.identity={...window.identity,id:'account-b'}")
    if (role === 'customer') await js('window.ctx.setAuthenticatedCustomer(window.identity,true)')
    else if (role === 'seller') await js('window.ctx.updateSeller(window.identity)')
    else await js('window.ctx.refresh()')
    await js('window.csrfPending=false;window.releaseCsrf();new Promise(resolve=>setTimeout(resolve,100))')
    assert.equal(await js('window.calls.length'), 2) // Two code requests, no confirmation.
    // An uncertain code request keeps its cooldown through recreation, then permits a fresh request.
    await start(role); await js('window.networkFailure=true')
    for (const name of ['current_password', 'password', 'password_confirmation']) await fill(name, 'Synthetic123')
    await click('Send verification code')
    await browser.until("window.ctx.passwordSession.getSnapshot().blockedUntil>Date.now()", 'uncertain code cooldown')
    await reopen()
    assert(await js("document.querySelector('button[type=submit]').disabled"))
    assert.equal(await js('window.ctx.passwordSession.getSnapshot().phase'), 'ready')
    assert.equal(await js('window.calls.length'), 1)
    await js('window.offset=61000;window.networkFailure=false')
    await browser.until("!document.querySelector('button[type=submit]').disabled", 'uncertain code cooldown expiry')
    await code()
    assert.equal(await js('window.calls.length'), 2)
    // Two live forms share the synchronous operation lock.
    await start(role); await code(); await js('window.second=true;window.render()')
    await browser.until('document.querySelectorAll("form").length===2', 'two forms')
    await js('window.delayed=true')
    await click('Verify and update password')
    await browser.until('!!window.release', 'shared operation')
    assert(await js('[...document.querySelectorAll("button[type=submit]")].every(el=>el.disabled)'))
    await js('window.failureStatus=500;window.delayed=false;window.release()')
    await browser.until('document.querySelectorAll("input").length===0', 'all forms require reconciliation')
  }
  assert.deepEqual(browser.errors, [])
  console.log('B11: actual Customer/Seller/Logistics providers and clients pass uncertainty/remount, pending/disposal, delayed outcomes, refresh, cancel/cooldown, sign-in/account replacement, obsolete CSRF and simultaneous-form checks; recovery layouts pass 320/390/768/1440px and supported themes.')
} catch (error) {
  console.error(await js("({role:window.role,calls:window.calls,state:window.ctx?.passwordSession.getSnapshot(),text:document.body.innerText})"));
  throw error;
} finally { browser.close() }
