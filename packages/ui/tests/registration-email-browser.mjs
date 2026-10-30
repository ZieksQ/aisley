// Exercise the actual shared registration gate in Chromium with synthetic API responses.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
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
try {
  await js(`document.body.innerHTML=${JSON.stringify('<style>'+css+'</style><main id="role-root" class="mx-auto max-w-3xl p-5"></main>')}`)
  await js("window.sequence=0;const realNow=Date.now.bind(Date);window.offset=0;Date.now=()=>realNow()+window.offset")
  await js(registrationRoleSource({...modules,...registrationRoleModules(compile)}))
  for (const role of ['customer','seller','logistics']) {
    await js(`window.mountRole('${role}')`)
    await browser.until("!!document.querySelector('[name=first_name]')", 'details first')
    assert.equal(await js("!!document.querySelector('[name=verification_code]')"),false)
    for (const [name,value] of Object.entries({email:'first@example.invalid',first_name:'Retained',last_name:'Fixture',contact_number:'09170000000',birth_date:'2000-01-01',sex:'male',password:'Synthetic123',password_confirmation:'Synthetic123'})) {
      await js(`(() => {const el=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
    }
    if(role!=='customer') {
      await fill('business_name','Retained business')
      if(role==='seller') await js("(() => {const el=document.querySelector('[name=shop_category_id]');el.value='category';el.dispatchEvent(new Event('change',{bubbles:true}));})()")
      await js("for(const name of ['government_id','business_permit']) {const dt=new DataTransfer();dt.items.add(new File(['fixture'],name+'.png',{type:'image/png'}));document.querySelector('[name='+name+']').files=dt.files;}")
    }
    await click('Continue to email verification')
    await browser.until("!!document.querySelector('[name=verification_code]')",'OTP after details')
    await js("document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))")
    assert.equal(await js("document.querySelector('[name=password]').value"),'Synthetic123')
    await fill('verification_code','012345')
    await js("window.savedTransport=window.transport;window.transport=(path,options)=>path.endsWith('/verify-email')?Promise.reject({status:422,errors:{verification_code:['Incorrect code.']}}):window.savedTransport(path,options)")
    await click('Verify email')
    await browser.until("document.body.textContent.includes('Incorrect code.')",'invalid OTP feedback')
    assert.equal(await js("document.querySelector('[name=password]').value"),'Synthetic123')
    await js('window.transport=window.savedTransport')
    await click('Verify email')
    await browser.until('!!window.verification.token','proof')
    assert.equal(await js('window.finalQueue.length'),0,'verify never submits')
    assert.equal(await js("document.querySelector('[name=first_name]').value"),'Retained')
    if(role!=='customer') assert.equal(await js("document.querySelector('[name=government_id]').files[0].name"),'government_id.png')
    for(const width of [320,390,768,1440]) {await browser.viewport(width);assert(await js('document.documentElement.scrollWidth<=innerWidth'))}
    await browser.screenshot(resolve(artifacts,role+'-details-first.png'))
    await click('Submit registration')
    await browser.until('window.finalQueue.length===1','explicit submission')
    assert.equal(await js('window.finalQueue[0].body.first_name'),'Retained')
    await js('window.resolveFinal()')
    await browser.until(role==='seller'?"document.body.textContent.includes('Waiting for Admin approval')":'window.navigations.length===1','completion')
  }
  // Disabled registration skips OTP; re-enabling at final submission preserves drafts.
  for (const role of ['customer','seller','logistics']) {
    await js(`window.otpRequired=false;window.configFailure=true;window.mountRole('${role}')`)
    await browser.until("document.body.textContent.includes('Retry registration settings')", 'configuration failure')
    for (const [name,value] of Object.entries({email:'first@example.invalid',first_name:'Retained',last_name:'Fixture',contact_number:'09170000000',birth_date:'2000-01-01',sex:'male',password:'Synthetic123',password_confirmation:'Synthetic123'})) {
      await js(`(() => {const el=document.querySelector('[name="${name}"]');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
    }
    if (role!=='customer') {
      await fill('business_name','Retained business')
      if(role==='seller') await js("(() => {const el=document.querySelector('[name=shop_category_id]');el.value='category';el.dispatchEvent(new Event('change',{bubbles:true}));})()")
      await js("for(const name of ['government_id','business_permit']) {const dt=new DataTransfer();dt.items.add(new File(['fixture'],name+'.png',{type:'image/png'}));document.querySelector('[name='+name+']').files=dt.files;}")
    }
    await click('Continue to email verification')
    assert.equal(await js('window.finalQueue.length'),0,'settings failure blocks registration')
    await js('window.configFailure=false')
    await click('Retry registration settings')
    await browser.until('window.verification.ready', 'bypass ready')
    assert.equal(await js("document.querySelector('[name=password]').value"),'Synthetic123')
    assert.equal(await js("!!document.querySelector('[name=verification_code]')"),false)
    await click('Submit registration')
    await browser.until('window.finalQueue.length===1', 'bypassed submission')
    assert.equal(await js('window.finalQueue[0].body.email_verification_token'),'')
    await js("window.rejectFinal('proof')")
    await browser.until('!window.verification.ready', 'server requires verification again')
    assert.equal(await js("document.querySelector('[name=password]').value"),'Synthetic123')
    if(role!=='customer') assert.equal(await js("document.querySelector('[name=government_id]').files[0].name"),'government_id.png')
    await click('Continue to email verification')
    await browser.until("!!document.querySelector('[name=verification_code]')", 're-enabled OTP')
    assert.equal(await js('window.finalQueue.length'),1,'no automatic submission retry')
  }
  await js('window.otpRequired=true;window.unmountRole()')
  await checkRegistrationSubmissions(browser, modules, compile, artifacts)
  assert.equal(browser.errors.length,0,JSON.stringify(browser.errors))
  console.log('All three role forms pass details-first, tab events, password/file retention, OTP and explicit submission checks.')
} finally { browser.close() }
