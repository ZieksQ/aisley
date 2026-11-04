// Actual shared workflow and role handlers with controlled API transport in Chromium.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { openChatBrowser } from './chat-browser-driver.mjs'
import { checkRegistrationSubmissions } from './registration-submission-checks.mjs'
import { registrationRoleModules, registrationRoleSource } from './registration-role-fixture.mjs'

const require = createRequire(resolve('src/seller/package.json'))
const ts = require('typescript')
const dependencyRequire = createRequire(require.resolve('react-dom/client'))
function production(name, file) {
  return readFileSync(resolve(dirname(dependencyRequire.resolve(`${name}/package.json`)), 'cjs', file), 'utf8')
}
const baseline = process.argv.includes("--before")
function compile(file) {
  return ts.transpileModule(baseline ? execFileSync("git", ["show", `HEAD:${file}`], {encoding:"utf8"}) : readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
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
const css = readdirSync(assets).filter(name => name.endsWith('.css')).map(name => readFileSync(resolve(assets, name), 'utf8')).join('\n').replaceAll('url(/assets/', 'url(/src/seller/dist/assets/')
const browser = await openChatBrowser()
const js = browser.evaluate
async function fill(name, value) {
  await js(`(() => {const el=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
}
async function click(label) {
  await js(`(() => {const el=[...document.querySelectorAll('button')].find(el=>el.textContent===${JSON.stringify(label)} && el.getClientRects().length);if(!el || el.disabled) throw new Error('Missing enabled button: '+${JSON.stringify(label)});el.click();})()`)
}
async function details(role, { otp = true, failure = false } = {}) {
  await js(`window.otpRequired=${otp};window.configFailure=${failure};window.mountRole('${role}')`)
  await browser.until("!!document.querySelector('[name=first_name]') && !document.body.innerText.includes('Loading registration settings')", 'details ready')
  for (const [name, value] of Object.entries({ email: 'first@example.invalid', first_name: 'Retained', last_name: 'Fixture', contact_number: '09170000000', birth_date: '2000-01-01', sex: 'male', password: 'Synthetic123', password_confirmation: 'Synthetic123' })) await fill(name, value)
  if (role !== 'customer') {
    await fill('business_name', 'Retained business')
    if (role === 'seller') await fill('shop_category_id', 'category')
    await js("for(const name of ['government_id','business_permit']) {const dt=new DataTransfer();dt.items.add(new File(['fixture'],name+'.png',{type:'image/png'}));document.querySelector('[name='+name+']').files=dt.files;}")
  }
  if (otp && !failure) {
    await click('Continue to email verification')
    if (baseline) await browser.until("!!document.querySelector('[name=verification_code]')", 'baseline inline OTP')
    else {
      await browser.until("window.registrationPath==='/register/verify-email'", 'dedicated OTP page')
      assert.equal(await js("document.querySelector('[name=first_name]').getClientRects().length"), 0)
    }
  }
}
async function verify() {
  await fill('verification_code', '012345')
  await click('Verify email')
  await browser.until('window.finalQueue.length===1', 'automatic single registration')
  assert.equal(await js('window.finalQueue[0].body.first_name'), 'Retained')
  assert.equal(await js('window.finalQueue[0].body.email_verification_token'), 'a'.repeat(64))
  assert.equal(await js("document.body.innerText.includes('Account created successfully')"), false)
}
try {
  await js(`document.body.innerHTML=${JSON.stringify('<style>' + css + '</style><main class="mx-auto max-w-2xl p-5"><header class="mb-6 font-semibold"><a href="/">AISLEY</a></header><div id="role-root"></div></main>')}`)
  await js("window.sequence=0;const realNow=Date.now.bind(Date);window.offset=0;Date.now=()=>realNow()+window.offset")
  await js(registrationRoleSource({ ...modules, ...registrationRoleModules(compile) }))
  if (baseline) {
    for (const role of ['customer', 'seller', 'logistics']) {
      await details(role)
      for (const width of [390, 768, 1440]) {
        await browser.viewport(width)
        await browser.screenshot(resolve(artifacts, `${role}-before-${width}.png`))
      }
      writeFileSync(resolve(artifacts, `${role}-before.html`), await js('document.documentElement.outerHTML'))
    }
    console.log('Baseline inline OTP captured from the committed source.')
  } else {
  for (const role of ['customer', 'seller', 'logistics']) {
    await details(role)
    await js("document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))")
    assert.equal(await js("document.querySelector('[name=password]').value"), 'Synthetic123')
    await fill('verification_code', '012345')
    await js("window.savedTransport=window.transport;window.transport=(path,options)=>path.endsWith('/verify-email')?Promise.reject({status:422,errors:{verification_code:['Incorrect code.']}}):window.savedTransport(path,options)")
    await click('Verify email')
    await browser.until("document.body.innerText.includes('Incorrect code.')", 'invalid OTP')
    assert.equal(await js('window.finalQueue.length'), 0)
    await js('window.transport=window.savedTransport')
    for (const width of [320, 390, 768, 1440]) {
      await browser.viewport(width)
      assert(await js('document.documentElement.scrollWidth<=innerWidth'))
      await browser.screenshot(resolve(artifacts, `${role}-otp-${width}.png`))
    }
    writeFileSync(resolve(artifacts, `${role}-otp.html`), await js('document.documentElement.outerHTML'))
    await verify()
    await js('window.resolveFinal()')
    await browser.until("window.registrationPath==='/register/success'", 'success route')
    assert(await js("document.body.innerText.includes('Please wait for Admin approval')"))
    assert.equal(await js("!!document.querySelector('[name=password]')"), false, 'success clears secret form')
    for (const width of [320, 390, 768, 1440]) {
      await browser.viewport(width)
      assert(await js('document.documentElement.scrollWidth<=innerWidth'))
      await browser.screenshot(resolve(artifacts, `${role}-success-${width}.png`))
    }
    writeFileSync(resolve(artifacts, `${role}-success.html`), await js('document.documentElement.outerHTML'))
    await js('window.backPath()')
    await browser.until("window.registrationPath==='/register/success'", 'success survives Back')
    await details(role)
    await click('Back to edit details')
    await browser.until("window.registrationPath==='/register'", 'edit details')
    assert.equal(await js("document.querySelector('[name=password]').value"), 'Synthetic123')
    await details(role, { otp: false, failure: true })
    await click('Continue to email verification')
    assert.equal(await js('window.finalQueue.length'), 0)
    await js('window.configFailure=false')
    await click('Retry registration settings')
    await browser.until('window.verification.ready', 'configuration retry')
    await click('Create account')
    await browser.until('window.finalQueue.length===1', 'OTP bypass')
    await js("window.rejectFinal('proof')")
    await browser.until("!window.verification.ready && window.registrationPath==='/register'", 'OTP re-enabled')
    assert.equal(await js("document.querySelector('[name=password]').value"), 'Synthetic123')
    await click('Continue to email verification')
    await browser.until("window.registrationPath==='/register/verify-email'", 'return to OTP')
    assert.equal(await js('window.finalQueue.length'), 1)
  }
  await details('customer')
  await verify()
  await js("window.resolveFinal(0,'active')")
  await browser.until("document.body.innerText.includes('Your account is ready')", 'active customer')
  assert.equal(await js("document.body.innerText.includes('Please wait for Admin approval')"), false)
  await checkRegistrationSubmissions(browser, { js, click, fill, details, verify }, artifacts)
  console.log('All three web roles pass dedicated OTP, automatic submission, success, configuration and draft checks.')
  }
} finally { browser.close() }
