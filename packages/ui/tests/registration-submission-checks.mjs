import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { registrationRoleModules, registrationRoleSource } from './registration-role-fixture.mjs'

export async function checkRegistrationSubmissions(browser, modules, compile, artifacts) {
  const js = browser.evaluate
  const submitLabel = role => role === 'customer' ? 'Create account' : role === 'seller' ? 'Submit application' : 'Submit for approval'
  await js("document.getElementById('root').remove();const main=document.createElement('main');main.id='role-root';main.className='mx-auto max-w-3xl p-5';document.body.append(main)")
  await js(registrationRoleSource({ ...modules, ...registrationRoleModules(compile) }))
  async function fill(name, value) {
    await js(`(() => {
      const el=document.querySelector('[name="${name}"]');
      const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});
      el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    })()`)
  }
  async function click(label) {
    await js(`(() => {
      const el=[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(label)});
      if(!el||el.matches(':disabled'))throw Error('Missing enabled button '+${JSON.stringify(label)});el.click();
    })()`)
  }
  async function verify(email) {
    await fill('email', email)
    await click('Send verification code')
    await browser.until("!!document.querySelector('[name=verification_code]')", 'code entry')
    await fill('verification_code', '012345')
    await click('Verify email')
    await browser.until(`window.verification?.email===${JSON.stringify(email)} && !!window.verification.token`, 'verified identity')
  }
  async function start(role) {
    await js(`window.mountRole('${role}')`)
    await browser.until("!!document.querySelector('[name=email]')", 'new role registration')
    await verify('first@example.invalid')
    for (const [name, value] of Object.entries({ first_name: 'Retained', last_name: 'Fixture', contact_number: '09170000000', birth_date: '2000-01-01', sex: 'male', password: 'Synthetic123', password_confirmation: 'Synthetic123' })) {
      await fill(name, value)
    }
    if (role !== 'customer') {
      await fill('business_name', 'Retained business')
      if (role === 'seller') await fill('shop_category_id', 'category')
      await js(`for(const name of ['government_id','business_permit']){
        const transfer=new DataTransfer();transfer.items.add(new File(['fixture'],name+'.png',{type:'image/png'}));
        const el=document.querySelector('[name='+name+']');el.files=transfer.files;el.dispatchEvent(new Event('change',{bubbles:true}));
      }`)
    }
  }
  async function submit(role, duplicate = false) {
    if (duplicate) {
      await js("(() => {const form=document.querySelector('[name=first_name]').closest('form');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));})()")
    } else await click(submitLabel(role))
    await browser.until('window.finalQueue.length>0', 'final request')
  }
  async function checkDraft(role) {
    assert.equal(await js("document.querySelector('[name=first_name]').value"), 'Retained', `${role} draft`)
    if (role !== 'customer') {
      assert.equal(await js("document.querySelector('[name=business_name]').value"), 'Retained business')
      assert.deepEqual(await js("['government_id','business_permit'].map(name=>document.querySelector('[name='+name+']').files[0]?.name)"), ['government_id.png', 'business_permit.png'])
    }
  }
  async function checkHandoff(role) {
    if (role === 'seller') {
      await browser.until("document.body.innerText.includes('Waiting for Admin approval')", 'Seller handoff')
      assert.equal(await js('window.navigations.length'), 0)
      assert.equal(await js("document.querySelector('[aria-label=\"Application submitted\"]').textContent.includes('first@example.invalid')"), true)
    } else {
      await browser.until('window.navigations.length===1', `${role} handoff`)
      const expected = role === 'customer' ? { path: '/waiting-for-approval?registered=1' }
        : { path: '/login', options: { replace: true, state: { notice: 'Registration submitted for approval.' } } }
      assert.deepEqual(await js('window.navigations[0]'), expected)
    }
    assert.equal(await js('window.attempts[0].complete()'), false, 'completion consumes the attempt once')
  }

  for (const role of ['customer', 'seller', 'logistics']) {
    await start(role)
    await submit(role, true)
    assert.equal(await js('window.finalQueue.length'), 1, `${role} synchronous duplicate submission`)
    assert.equal(await js('window.verification.beginSubmission()'), null)
    assert.deepEqual(await js("({email:window.finalQueue[0].body.email,token:window.finalQueue[0].body.email_verification_token,first:window.finalQueue[0].body.first_name})"), { email: 'first@example.invalid', token: 'a'.repeat(64), first: 'Retained' })
    if (role !== 'customer') assert.equal(await js('window.finalQueue[0].body.government_id.name'), 'government_id.png')
    assert(await js("[...document.querySelectorAll('button')].find(el=>el.textContent==='Change email').disabled"))
    assert(await js("[...document.querySelectorAll('form input,form select,form button')].every(el=>el.matches(':disabled'))"))
    await js("[...document.querySelectorAll('button')].find(el=>el.textContent==='Change email').click()")
    assert.equal(await js('window.verification.email'), 'first@example.invalid')
    for (const theme of role === 'customer' ? ['light'] : ['light', 'dark']) {
      await js(`document.documentElement.className='${theme === 'dark' ? 'dark' : ''}'`)
      for (const width of [320, 390, 768, 1440]) {
        await browser.viewport(width)
        assert(await js('document.documentElement.scrollWidth<=innerWidth'), `${role} pending ${theme} ${width}`)
      }
      await browser.viewport(390)
      await browser.screenshot(resolve(artifacts, `${role}-${theme}-pending.png`))
    }
    await js('window.offset=3600001;new Promise(resolve=>setTimeout(resolve,1100))')
    assert.equal(await js('window.verification.token'), 'a'.repeat(64), 'pending proof survives local expiry')
    await js('window.resolveFinal()')
    await checkHandoff(role)

    // Ordinary validation permits an explicit same-proof retry with intact drafts.
    await start(role)
    await submit(role)
    await js("window.rejectFinal('validation')")
    await browser.until('!window.verification.submitting', 'validation releases lock')
    await checkDraft(role)
    await submit(role)
    assert.equal(await js('window.finalQueue[1].body.email'), 'first@example.invalid')
    assert.equal(await js('window.finalQueue[1].body.email_verification_token'), 'a'.repeat(64))
    assert.equal(await js('window.attempts[0].complete()'), false, 'old attempt cannot complete same-proof retry')
    await js("window.attempts[0].finish({reverify:true,message:'Obsolete feedback'})")
    assert.equal(await js('window.verification.submitting'), true, 'old cleanup cannot release newer lock')
    await js("window.rejectFinal('proof',1)")
    await browser.until("document.body.innerText.includes('Verify your email again')", 'proof failure recovery')
    await checkDraft(role)
    // Old callbacks cannot reset/complete another verification, even for the same email/token.
    for (const email of ['first@example.invalid', 'second@example.invalid']) {
      await verify(email)
      assert.equal(await js('window.attempts[0].complete()'), false)
      await js("window.attempts[1].finish({reverify:true,message:'Obsolete feedback'})")
      assert.equal(await js('window.verification.email'), email)
      assert(await js('!!window.verification.token'))
      assert.equal(await js("document.body.innerText.includes('Obsolete feedback')"), false)
      if (email.startsWith('first')) {
        await click('Change email')
        await browser.until("!window.verification.token", 'different-email retry')
      }
    }
    await checkDraft(role)
    await submit(role)
    assert.equal(await js('window.finalQueue[2].body.email'), 'second@example.invalid')
    assert.equal(await js('window.finalQueue[2].body.email_verification_token'), 'b'.repeat(64))
    await js("window.rejectFinal('validation',2)")
    await browser.until('!window.verification.submitting', 'different-email submission')

    // Delayed results after an explicit reset/new proof must not navigate or mutate feedback.
    for (const outcome of ['success', 'proof']) {
      await start(role)
      await submit(role)
      await js('window.oldRequest=window.finalQueue[0];window.attempts[0].finish({reverify:true})')
      await browser.until('!window.verification.token', 'explicit reset')
      await verify('second@example.invalid')
      await js(outcome === 'success' ? 'window.resolveFinal()' : "window.rejectFinal('proof')")
      await js('new Promise(resolve=>setTimeout(resolve,50))')
      assert.equal(await js('window.verification.email'), 'second@example.invalid')
      assert.equal(await js('window.verification.token'), 'b'.repeat(64))
      assert.equal(await js('window.navigations.length'), 0)
      assert.equal(await js("document.body.innerText.includes('Email proof rejected.')"), false)
      await checkDraft(role)
    }

    // A proof expired just before submit cannot dispatch even before the timer ticks.
    await start(role)
    await js("window.offset=3600001;document.querySelector('[name=first_name]').closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))")
    await browser.until("document.body.innerText.includes('verification expired')", 'expiry at submission boundary')
    assert.equal(await js('window.finalQueue.length'), 0)
    await checkDraft(role)

    // Expiry and ambiguous transport/upload failures preserve recovery guidance.
    for (const outcome of ['uncertain', ...(role === 'customer' ? [] : ['cancel'])]) {
      await start(role)
      await submit(role)
      await js('window.offset=3600001')
      await js(`window.rejectFinal('${outcome}')`)
      await browser.until("document.body.innerText.includes('registration result is unconfirmed') && document.body.innerText.includes('verification expired')", 'uncertain expired proof')
      await checkDraft(role)
      assert.equal(await js('window.finalQueue.length'), 1, 'no automatic replay')
      assert.equal(await js('window.navigations.length'), 0)
    }

    // CSRF completion after route exit cannot dispatch a registration POST.
    await start(role)
    await js('window.delayCsrf=true')
    await click(submitLabel(role))
    await browser.until('window.csrfQueue.length===1', 'pending CSRF')
    await js('window.savedAttempt=window.attempts[0];window.unmountRole();window.csrfQueue[0]()')
    await js('new Promise(resolve=>setTimeout(resolve,50))')
    assert.equal(await js('window.finalQueue.length'), 0)
    assert.equal(await js('window.savedAttempt.isCurrent()'), false)
    assert.equal(await js('window.savedAttempt.signal.aborted'), true)

    // Ignore success and rejection from old screens while a new screen is verified.
    for (const outcome of ['success', 'proof']) {
      await start(role)
      await submit(role)
      await js('window.oldRequest=window.finalQueue[0];window.savedAttempt=window.attempts[0];window.unmountRole()')
      assert.equal(await js('window.oldRequest.signal.aborted'), true)
      await js(`window.mountRole('${role}')`)
      await verify('second@example.invalid')
      await js(outcome === 'success' ? "window.oldRequest.resolve({message:'Old success.',seller:{email:'first@example.invalid'}})"
        : "window.oldRequest.reject(new Error('Old failure'))")
      await js('new Promise(resolve=>setTimeout(resolve,50))')
      assert.equal(await js('window.verification.email'), 'second@example.invalid')
      assert.equal(await js('window.verification.token'), 'b'.repeat(64))
      assert.equal(await js('window.navigations.length'), 0)
      assert.equal(await js('window.savedAttempt.complete()'), false)
    }
    console.log(`B12 ${role}: pending lock, frozen payload, expiry, retry/draft/evidence, obsolete success/error, CSRF and unmount checks pass.`)
  }
  await js('window.unmountRole()')
  await start('customer')
  await submit('customer')
  await js("window.resolveFinal(0,'active')")
  await browser.until('window.navigations.length===1', 'active buyer sign-in handoff')
  assert.deepEqual(await js('window.navigations'), [{ path: '/login?registered=1' }])

}
