import assert from 'node:assert/strict'

export async function checkRegistrationSubmissions(browser, helpers, artifacts) {
  const { js, click, fill, details, verify } = helpers
  for (const role of ['customer', 'seller', 'logistics']) {
    // Resend/expiry must retain the captured automatic-submission callback.
    await details(role)
    await js('window.offset=600001')
    await browser.until("document.body.innerText.includes('This code expired')", 'code expiry')
    assert.equal(await js("[...document.querySelectorAll('button')].find(b=>b.textContent==='Verify email').disabled"), true)
    await click('Resend code')
    await browser.until("!document.body.innerText.includes('This code expired')", 'fresh resend')
    await verify()
    await js('window.resolveFinal()')
    await browser.until("window.registrationPath==='/register/success'", 'resent OTP automatically registers')

    // A validation failure goes back to editable details; a deliberate corrected retry reuses proof.
    await details(role)
    await verify()
    await js("window.rejectFinal('validation')")
    await browser.until("window.registrationPath==='/register' && !window.verification.submitting", 'validation recovery')
    assert.equal(await js('window.finalQueue.length'), 1)
    assert.equal(await js("document.querySelector('[name=first_name]').value"), 'Retained')
    if (role !== 'customer') assert.equal(await js("document.querySelector('[name=government_id]').files[0].name"), 'government_id.png')
    await click('Create account')
    await browser.until('window.finalQueue.length===2', 'deliberate retry')
    await js('window.resolveFinal(1)')
    await browser.until("window.registrationPath==='/register/success'", 'retry completes')

    // Proof expiry while persistence is pending must not override an authoritative success.
    await details(role)
    await verify()
    await js('window.offset=3600001')
    await new Promise(resolve => setTimeout(resolve, 1100))
    assert.equal(await js('window.verification.submitting'), true)
    await js('window.resolveFinal()')
    await browser.until("window.registrationPath==='/register/success'", 'pending expiry success')

    // Browser Back invalidates the originating attempt. A late response cannot navigate.
    await details(role)
    await verify()
    await js('window.backPath()')
    await browser.until("!window.verification.submitting && document.body.innerText.includes('unconfirmed')", 'browser back cancels')
    const before = await js('window.navigations.length')
    await js('window.resolveFinal()')
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.equal(await js('window.navigations.length'), before)

    // An uncertain failure never retries itself, including on timer/focus changes.
    await details(role)
    await verify()
    await js("window.rejectFinal('server')")
    await browser.until("document.body.innerText.includes('unconfirmed') && window.registrationPath==='/register'", 'uncertain response')
    await js("window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))")
    assert.equal(await js('window.finalQueue.length'), 1)

    // Leaving while CSRF is pending must not dispatch persistence after navigation.
    await details(role)
    await js('window.delayCsrf=true')
    await fill('verification_code', '012345')
    await click('Verify email')
    await browser.until('window.csrfQueue.length>0', 'delayed csrf')
    await js('window.unmountRole();for(const resolve of window.csrfQueue)resolve()')
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.equal(await js('window.finalQueue.length'), 0)

    for (const path of ['/register/verify-email', '/register/success']) {
      await js(`window.mountRole('${role}','${path}')`)
      await browser.until("window.registrationPath==='/register'", 'missing in-memory state')
      assert.equal(await js("document.body.innerText.includes('Account created successfully')"), false)
    }
  }
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors))
  console.log('Submission validation, explicit retry, pending expiry, Back, uncertainty, CSRF and direct-entry checks passed.')
}
