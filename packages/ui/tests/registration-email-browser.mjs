// Exercise the actual shared registration gate in Chromium with synthetic API responses.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { openChatBrowser } from './chat-browser-driver.mjs'
import { checkRegistrationSubmissions } from './registration-submission-checks.mjs'

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
  './gate': compile('packages/ui/src/registration-email/RegistrationEmailGate.tsx'),
  './use-registration-email': compile('packages/ui/src/registration-email/use-registration-email.ts'),
}
const artifacts = resolve('node_modules/.cache/registration-email-browser')
mkdirSync(artifacts, { recursive: true })
const assets = resolve('src/seller/dist/assets')
const css = readdirSync(assets).filter(name => name.endsWith('.css')).map(name => readFileSync(resolve(assets, name), 'utf8')).join('\n')
const browser = await openChatBrowser()
const js = browser.evaluate
async function fill(name, value) {
  await js(`(() => {const el=document.querySelector('[name="${name}"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
}
async function click(label) {
  await js(`(() => {const el=[...document.querySelectorAll('button')].find(el=>el.textContent===${JSON.stringify(label)});if(!el || el.disabled) throw new Error('Missing enabled button: '+${JSON.stringify(label)});el.click();})()`)
}
const source = `const process={env:{NODE_ENV:'production'}};const sources=${JSON.stringify(modules)};const cache={};
function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function('module','exports','require',sources[name])(module,module.exports,require);return module.exports;}
const React=require('react'),root=require('react-dom/client').createRoot(document.getElementById('root')),Gate=require('./gate').RegistrationEmailGate;
const realNow=Date.now.bind(Date);window.offset=0;Date.now=()=>realNow()+window.offset;window.mode='ok';window.calls=[];window.sequence=0;
window.mount=(role)=>{window.calls=[];window.offset=0;window.mode='ok';root.render(React.createElement(Gate,{key:++window.sequence,accent:role==='logistics'?'blue':'purple',client:{
requestCode:async(email,signal)=>{window.calls.push({action:'code',email});if(window.mode==='delayed')await new Promise(resolve=>window.release=resolve);if(window.mode==='throttle')throw {status:429,retryAfter:2,message:'Please wait.'};return {challenge_id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',expires_at:new Date(Date.now()+600000).toISOString(),resend_available_at:new Date(Date.now()+60000).toISOString()};},
verifyCode:async(email,id,code,signal)=>{window.calls.push({action:'verify',email,id,code});if(window.mode==='invalid')throw {status:422,errors:{verification_code:['The verification code is incorrect.']}};return {email_verification_token:'a'.repeat(64),expires_at:new Date(Date.now()+3600000).toISOString()};}
},children:({email,token})=>React.createElement('form',{onSubmit:event=>{event.preventDefault();window.registration={email,token};}},React.createElement('label',null,'First name',React.createElement('input',{name:'first_name',defaultValue:'',className:'block min-h-12 w-full border rounded-lg px-3'})),React.createElement('button',{type:'submit',className:'min-h-12 px-4'},'Submit application'))}));};window.mount('customer');`
try {
  await js("document.head.innerHTML='<meta name=viewport content=\"width=device-width,initial-scale=1\">'")
  await js(`document.body.innerHTML=${JSON.stringify('<style>'+css+'</style><main id="root" class="mx-auto max-w-xl p-5"></main>')}`)
  await js(source)
  for (const role of ['customer', 'seller', 'logistics']) {
    for (const theme of role === 'customer' ? ['light'] : ['light', 'dark']) {
      await js(`document.documentElement.className='${theme === 'dark' ? 'dark' : ''}';window.mount('${role}')`)
      await browser.until("!!document.querySelector('[name=email]')", 'email entry')
      assert.equal(await js("!!document.querySelector('[name=first_name]')"), false)
      for (const width of [320, 390, 768, 1440]) {
        await browser.viewport(width)
        assert(await js('document.documentElement.scrollWidth <= innerWidth'), `${role} ${theme} overflow ${width}`)
      }
      await fill('email', ' NEW@example.test ')
      // Browsers normalize surrounding whitespace on email inputs before submission.
      await click('Send verification code')
      await browser.until("!!document.querySelector('[name=verification_code]')", 'OTP input')
      assert.equal(await js('window.calls[0].email'), 'new@example.test')
      assert.equal(await js("document.querySelector('[name=verification_code]').autocomplete"), 'one-time-code')
      await browser.until("document.activeElement === document.querySelector('[name=verification_code]')", 'code keyboard focus')
      await fill('verification_code', '012345')
      await js("window.mode='invalid'")
      await click('Verify email')
      await browser.until("document.body.textContent.includes('The verification code is incorrect.')", 'incorrect code')
      await js("window.mode='ok'")
      await browser.viewport(390)
      await browser.screenshot(resolve(artifacts, `${role}-${theme}-code.png`))
      await click('Verify email')
      await browser.until("!!document.querySelector('[name=first_name]')", 'registration details')
      assert.equal(await js('window.calls.at(-1).code'), '012345')
      await fill('first_name', 'Preserved draft')
      await click('Change email')
      await browser.until("!!document.querySelector('[name=email]')", 'changed email')
      assert.equal(await js("document.querySelector('[name=first_name]').value"), 'Preserved draft')
      await fill('email', 'changed@example.test')
      await click('Send verification code')
      await browser.until("!!document.querySelector('[name=verification_code]')", 'new OTP')
      await fill('verification_code', '012345')
      await click('Verify email')
      await browser.until("document.body.textContent.includes('changed@example.test') && !document.querySelector('[name=verification_code]')", 'changed verification')
      await click('Submit application')
      assert.deepEqual(await js('window.registration'), { email: 'changed@example.test', token: 'a'.repeat(64) })
      await js('window.offset=3600001')
      await browser.until("document.body.textContent.includes('verification expired')", 'proof expiry')
      assert.equal(await js("document.querySelector('[name=first_name]').value"), 'Preserved draft')
    }
  }
  await js("window.mount('seller');window.mode='throttle'")
  await browser.until("!!document.querySelector('[name=email]')", 'throttle entry')
  await fill('email', 'limited@example.test')
  await click('Send verification code')
  await browser.until("document.body.textContent.includes('Please wait.')", 'throttle result')
  assert(await js("[...document.querySelectorAll('button')].find(el=>el.textContent==='Send verification code').disabled"))
  await js('window.offset=2100')
  await browser.until("![...document.querySelectorAll('button')].find(el=>el.textContent==='Send verification code').disabled", 'cooldown ends')
  await js("window.mount('customer');window.mode='delayed'")
  await browser.until("!!document.querySelector('[name=email]')", 'delay entry')
  await fill('email', 'late@example.test')
  await click('Send verification code')
  await browser.until('!!window.release', 'pending request')
  await js("window.mount('customer');window.release()")
  await browser.until("!!document.querySelector('[name=email]')", 'fresh gate')
  assert.equal(await js("!!document.querySelector('[name=verification_code]')"), false)
  await browser.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await js("matchMedia('(prefers-reduced-motion: reduce)').matches"), true)
  await checkRegistrationSubmissions(browser, modules, compile, artifacts)
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors))
  console.log('Registration OTP browser checks pass: all web roles, widths, themes, leading-zero codes, draft retention, proof expiry, cooldown and obsolete-response cleanup.')
} finally {
  browser.close()
}
