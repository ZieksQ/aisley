// Real production route layouts with synthetic API responses; never creates accounts.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openChatBrowser } from './chat-browser-driver.mjs'

const artifacts = resolve('node_modules/.cache/registration-routes')
mkdirSync(artifacts, { recursive: true })
const browser = await openChatBrowser()
const js = browser.evaluate
const fixture = `(() => {
  const original=window.fetch.bind(window);window.registrationPosts=[];window.registrationResult=null;
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
  window.fetch=async(input,options={})=>{
    const path=new URL(typeof input==='string'?input:input.url,location.href).pathname;
    if(path==='/sanctum/csrf-cookie')return new Response(null,{status:204});
    if(!path.startsWith('/api/'))return original(input,options);
    if(path.endsWith('/auth/me'))return json({message:'Unauthenticated.'},401);
    if(path.endsWith('/registration/config'))return json({email_verification_required:true});
    if(path.endsWith('/registration-options'))return json({shop_categories:[{id:'fixture-category',name:'Fixture category'}]});
    if(path.includes('/address-options/'))return json({options:[]});
    if(path.endsWith('/verification-code'))return json({challenge_id:'11111111-1111-4111-8111-111111111111',expires_at:new Date(Date.now()+600000).toISOString(),resend_available_at:new Date(Date.now()+60000).toISOString()});
    if(path.endsWith('/verify-email'))return json({email_verification_token:'a'.repeat(64),expires_at:new Date(Date.now()+3600000).toISOString()});
    if(path.endsWith('/auth/register')) {
      const body=options.body instanceof FormData?Object.fromEntries(options.body):JSON.parse(options.body);
      window.registrationPosts.push(body);
      return new Promise(resolve=>window.registrationResult=()=>resolve(json({message:'Submitted.',customer:{status:window.customerStatus||'pending'},seller:{email:body.email}},201)));
    }
    return json({message:'No synthetic response for '+path},404);
  };
})()`
await browser.cdp('Page.addScriptToEvaluateOnNewDocument', { source: fixture })
async function fill(name, value) {
  await js(`(()=>{const el=document.querySelector('[name="${name}"]');if(!el)throw Error('Missing field ${name}');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
}
async function click(label) {
  await js(`(()=>{const el=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(label)} && el.getClientRects().length);if(!el||el.disabled)throw Error('Missing enabled button ${label}');el.click()})()`)
}
async function capture(role, stage) {
  for (const dark of role === 'customer' ? [false] : [false, true]) {
    await js(`document.documentElement.classList.toggle('dark',${dark});document.documentElement.dataset.theme='${dark ? 'dark' : 'light'}'`)
    for (const width of [320, 390, 768, 1440]) {
      await browser.viewport(width)
      assert(await js('document.documentElement.scrollWidth<=innerWidth'), `${role} ${stage} overflow`)
      const target = `${role}-${stage}-${dark ? 'dark' : 'light'}`
      await browser.screenshot(resolve(artifacts, `${target}-${width}.png`))
      if (width === 1440) writeFileSync(resolve(artifacts, `${target}.html`), await js('document.documentElement.outerHTML'))
    }
  }
}
try {
  for (const [role, port] of [['customer',15300],['seller',15174],['logistics',15176]]) {
    await browser.navigate(`http://127.0.0.1:${port}/register`)
    await browser.until("!!document.querySelector('[name=first_name]') && !document.body.innerText.includes('Loading registration settings')", `${role} details`)
    for (const [name,value] of Object.entries({first_name:'Ana',last_name:'Applicant',email:'applicant@example.invalid',contact_number:'09171234567',birth_date:'2000-01-01',sex:'female',password:'Synthetic123',password_confirmation:'Synthetic123'})) await fill(name,value)
    if (role !== 'customer') {
      await fill('business_name','Applicant business')
      if (role === 'seller') await fill('shop_category_id','fixture-category')
      await click('Enter administrative address manually')
      for (const name of ['region','province','city_municipality','barangay','address_line_1','postal_code']) await fill(`address[${name}]`, name==='postal_code'?'0123':'Fixture address')
      await js("for(const name of ['government_id','business_permit']){const data=new DataTransfer();data.items.add(new File(['synthetic'],name+'.png',{type:'image/png'}));document.querySelector('[name='+name+']').files=data.files}")
    }
    await click('Continue to email verification')
    await browser.until("location.pathname==='/register/verify-email' && !!document.querySelector('[name=verification_code]')", `${role} OTP route`)
    assert.equal(await js("document.querySelector('[name=first_name]').getClientRects().length"),0)
    await capture(role,'otp')
    await click('Back to edit details')
    await browser.until("location.pathname==='/register'", `${role} Back`)
    assert.equal(await js("document.querySelector('[name=password]').value"),'Synthetic123')
    if (role !== 'customer') assert.equal(await js("document.querySelector('[name=government_id]').files.length"),1)
    await click('Continue to email verification')
    await browser.until("!!document.querySelector('[name=verification_code]')", `${role} OTP again`)
    await fill('verification_code','012345')
    await js("const form=document.querySelector('[name=verification_code]').form;form.requestSubmit();form.requestSubmit()")
    await browser.until('window.registrationPosts.length===1', `${role} auto persistence`)
    assert.equal(await js("document.body.innerText.includes('Account created successfully')"),false)
    await js('window.registrationResult()')
    await browser.until("location.pathname==='/register/success' && document.body.innerText.includes('Account created successfully')", `${role} success route`)
    assert(await js("document.body.innerText.includes('Please wait for Admin approval')"))
    await capture(role,'success')
    await browser.cdp('Page.reload')
    await browser.until("location.pathname==='/register' && !!document.querySelector('[name=first_name]')", `${role} refresh recovery`)
    assert.equal(await js("document.body.innerText.includes('Account created successfully')"),false)
  }
  assert.equal(browser.errors.length,0,JSON.stringify(browser.errors))
  console.log('Actual production routes pass OTP/Back with retained drafts/files, duplicate protection, confirmed success, refresh recovery and 40 viewport/theme captures.')
} catch(error) { console.error(await js('JSON.stringify({path:location.pathname,text:document.body.innerText,posts:window.registrationPosts.length})'));throw error } finally { browser.close() }
