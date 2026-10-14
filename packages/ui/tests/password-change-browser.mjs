// Real shared React form with synthetic verification responses; no live credentials or email.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { openChatBrowser } from './chat-browser-driver.mjs'

const require = createRequire(resolve('src/seller/package.json'))
const ts = require('typescript')
const dependencyRequire = createRequire(require.resolve('react-dom/client'))
function production(name, file) {
  return readFileSync(resolve(dirname(dependencyRequire.resolve(`${name}/package.json`)), 'cjs', file), 'utf8')
}
function compile(file) {
  return ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
}
const modules = {
  react: production('react', 'react.production.js'),
  'react/jsx-runtime': production('react', 'react-jsx-runtime.production.js'),
  'react-dom': production('react-dom', 'react-dom.production.js'),
  'react-dom/client': production('react-dom', 'react-dom-client.production.js'),
  scheduler: production('scheduler', 'scheduler.production.js'),
  './session': compile('packages/ui/src/password-change/session.ts'),
  './form': compile('packages/ui/src/password-change/PasswordChangeForm.tsx'),
  './use-password-change': compile('packages/ui/src/password-change/use-password-change.ts'),
}
const artifacts = resolve('node_modules/.cache/password-change-browser')
mkdirSync(artifacts, { recursive: true })
const assets = resolve('src/seller/dist/assets')
const css = readdirSync(assets).filter((name) => name.endsWith('.css')).map((name) => readFileSync(resolve(assets, name), 'utf8')).join('\n')
const browser = await openChatBrowser()
const js = browser.evaluate
async function fill(name, value) {
  await js(`(() => { const el=document.querySelector('[name="${name}"]'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); })()`)
}
async function click(text) {
  await js(`(() => { const el=[...document.querySelectorAll('button')].find(el=>el.textContent===${JSON.stringify(text)}); if(!el || el.disabled) throw new Error('Missing/enabled button: '+${JSON.stringify(text)}); el.click(); })()`)
}
const source = `const process={env:{NODE_ENV:'production'}}; const sources=${JSON.stringify(modules)}; const cache={};
function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function('module','exports','require',sources[name])(module,module.exports,require);return module.exports;}
const React=require('react'), root=require('react-dom/client').createRoot(document.getElementById('root')), Form=require('./form').PasswordChangeForm;
const realNow=Date.now.bind(Date); window.offset=0; Date.now=()=>realNow()+window.offset;
window.calls=[]; window.mode='ok'; window.sequence=0;
window.mount=(role)=>{const session=require('./session').createPasswordChangeSession();session.setIdentity(role);window.calls=[];window.offset=0;window.mode='ok';root.render(React.createElement(Form,{key:++window.sequence,session,accent:role==='logistics'?'blue':'purple',sessionDescription:'This browser stays signed in.',requestCode:async(draft)=>{window.calls.push({action:'code',draft});if(window.mode==='delayed')await new Promise(resolve=>window.releaseCode=resolve);if(window.mode==='throttle')throw {status:429,message:'Please wait.',retryAfter:2}; return {data:{challenge_id:'00000000-0000-4000-8000-'+String(window.calls.length).padStart(12,'0'),masked_email:'b***@example.test',expires_at:new Date(Date.now()+600000).toISOString(),resend_available_at:new Date(Date.now()+60000).toISOString()}}},updatePassword:async(payload)=>{window.calls.push({action:'update',payload});if(window.mode==='invalid')throw {status:422,message:'Check your code.',errors:{verification_code:['The verification code is incorrect.']}};if(window.mode==='uncertain')throw {status:0};return {message:'Password updated successfully.'}}}));};window.mount('customer');`
try {
  await js("document.head.innerHTML='<meta name=viewport content=\"width=device-width,initial-scale=1\">'")
  await js(`document.body.innerHTML=${JSON.stringify('<style>'+css+'</style><main id="root" class="mx-auto max-w-xl p-5"></main>')}`)
  await js(source)
  for (const role of ['customer', 'seller', 'logistics']) {
    await js(`window.mount('${role}')`)
    await browser.until("!!document.querySelector('[name=current_password]')", 'password fields')
    for (const width of [320, 390, 768, 1440]) {
      await browser.viewport(width)
      assert(await js('document.documentElement.scrollWidth <= innerWidth'), `${role} overflow at ${width}`)
    }
    await fill('current_password', 'SyntheticCurrent123')
    await fill('password', 'SyntheticUpdated456')
    await fill('password_confirmation', 'SyntheticUpdated456')
    await click('Send verification code')
    await browser.until("!!document.querySelector('[name=verification_code]')", 'code step')
    assert.equal(await js('window.calls.length'), 1)
    for (const theme of ['light', 'dark']) {
      await browser.viewport(390)
      await js(`document.documentElement.classList.toggle('dark', '${theme}'==='dark')`)
      await js('new Promise(resolve=>setTimeout(resolve,250))')
      await browser.screenshot(resolve(artifacts, `${role}-${theme}-code.png`))
      const foreground = await js("(() => { const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); ctx.fillStyle = getComputedStyle(document.querySelector('form')).color; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data].slice(0,3); })()")
      assert(theme === 'light' ? foreground.every(value => value < 64) : foreground.every(value => value > 220), `${role} ${theme} readable foreground: ${foreground}`)
      assert(await js('document.documentElement.scrollWidth <= innerWidth'), `${role} ${theme} overflow`)
    }
    await js("document.documentElement.classList.remove('dark')")
    assert(await js("document.querySelector('[name=password]').disabled"))
    await fill('verification_code', '012345')
    await js("window.mode='invalid'")
    await click('Verify and update password')
    await browser.until("document.body.innerText.includes('The verification code is incorrect.')", 'invalid code feedback')
    await js("window.offset=61000;window.mode='ok'")
    await browser.until("[...document.querySelectorAll('button')].some(el=>el.textContent==='Resend code'&&!el.disabled)", 'resend cooldown')
    await click('Resend code')
    await browser.until("document.querySelector('[name=verification_code]').value===''", 'resend clears code')
    await fill('verification_code', '012345')
    await click('Verify and update password')
    await browser.until("document.body.innerText.includes('Password updated successfully.')", 'verified password success')
    assert.equal(await js("document.querySelector('[name=current_password]').value"), '')
    assert.equal(await js("window.calls.at(-1).payload.verification_code"), '012345')
    assert.equal(await js("window.calls.at(-1).payload.challenge_id"), '00000000-0000-4000-8000-000000000003')
  }
  await js("window.mount('customer')")
  await browser.until("document.body.innerText.includes('Send verification code')", 'fresh form')
  for (const [name, value] of [['current_password','SyntheticCurrent123'],['password','SyntheticUpdated456'],['password_confirmation','SyntheticUpdated456']]) await fill(name,value)
  await click('Send verification code')
  await browser.until("!!document.querySelector('[name=verification_code]')", 'fresh challenge')
  await js('window.offset=601000')
  await browser.until("document.body.innerText.includes('This code has expired')", 'expiry')
  assert(await js("[...document.querySelectorAll('button')].find(el=>el.textContent==='Verify and update password').disabled"))
  await click('Cancel')
  assert.equal(await js("document.querySelector('[name=current_password]').value"), '')
  await js('window.offset+=61000')
  await browser.until("!document.querySelector('button[type=submit]').disabled", 'cancel retains cooldown')
  for (const [name, value] of [['current_password','SyntheticCurrent123'],['password','SyntheticUpdated456'],['password_confirmation','SyntheticUpdated456']]) await fill(name,value)
  await click('Send verification code')
  await browser.until("!!document.querySelector('[name=verification_code]')", 'uncertain challenge')
  await fill('verification_code', '012345')
  await js("window.mode='uncertain'")
  await click('Verify and update password')
  await browser.until("document.body.innerText.includes('outcome is uncertain')", 'uncertain result')
  assert(await js("[...document.querySelectorAll('button')].find(el=>el.type==='submit').disabled"))
  assert.equal(await js('document.querySelectorAll("input").length'), 0)
  await browser.screenshot(resolve(artifacts, 'uncertain.png'))
  await js("window.mount('customer')")
  await browser.until("document.body.innerText.includes('Send verification code')", 'fresh throttle form')
  for (const [name, value] of [['current_password','SyntheticCurrent123'],['password','SyntheticUpdated456'],['password_confirmation','SyntheticUpdated456']]) await fill(name,value)
  await js("window.mode='throttle'")
  await click('Send verification code')
  await browser.until("document.body.innerText.includes('Please wait.')", 'throttle feedback')
  assert(await js("document.querySelector('button[type=submit]').disabled"))
  await js("window.offset=2100;window.mode='delayed'")
  await browser.until("!document.querySelector('button[type=submit]').disabled", 'Retry-After cooldown')
  await click('Send verification code')
  await browser.until("!!window.releaseCode", 'pending code request')
  await js("window.mount('seller')")
  await browser.until("!document.querySelector('[name=current_password]').disabled", 'new identity form')
  await js("window.releaseCode();new Promise(resolve=>setTimeout(resolve,100))")
  assert.equal(await js("document.querySelector('[name=verification_code]')"), null)
  assert.deepEqual(browser.errors, [])
  console.log('Password forms: three roles, 320/390/768/1440px, code gate, leading zero, invalid code, resend, expiry, cancel, success, uncertain outcome, Retry-After and obsolete-response cleanup passed.')
} finally {
  browser.close()
}
