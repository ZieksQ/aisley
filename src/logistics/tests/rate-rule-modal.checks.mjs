import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

// Uses the existing synthetic rates/fleet CDP harness; no live API writes.
export async function checkRateRuleModal({ cdp, js, until, click, fill, key, directory }) {
  const sizes = [[320, 700], [390, 844], [768, 1024], [1440, 900], [390, 500], [720, 450, 2]]
  for (const theme of ['light', 'dark']) {
    await js(`document.documentElement.classList.toggle('dark', ${theme === 'dark'})`)
    for (const [width, height, deviceScaleFactor = 1] of sizes) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false })
      await js("document.querySelector('[data-rate-rule-fields]').scrollTop = 0; new Promise(resolve => requestAnimationFrame(resolve))")
      const layout = await js(`(() => {
        const dialog = document.querySelector('dialog[open]');
        const body = dialog.querySelector('[data-rate-rule-fields]');
        const save = dialog.querySelector('button[type=submit]');
        const cancel = [...dialog.querySelectorAll('button')].find(b => b.textContent === 'Cancel');
        const close = dialog.querySelector('button[aria-label="Close rate rule dialog"]');
        const visible = el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; };
        const controls = [...dialog.querySelectorAll('input,select')];
        return {
          bounded: visible(dialog),
          overflow: dialog.scrollWidth <= dialog.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1,
          actions: [save, cancel, close].every(el => visible(el) && el.getBoundingClientRect().height >= 44 && el.getBoundingClientRect().width >= 44),
          aligned: innerWidth < 640 || Math.abs(controls[0].getBoundingClientRect().top - controls[1].getBoundingClientRect().top) < 1,
          scrollable: body.scrollHeight <= body.clientHeight || getComputedStyle(body).overflowY === 'auto',
          blue: getComputedStyle(save).backgroundColor === 'rgb(37, 99, 235)',
          footerTop: save.getBoundingClientRect().top,
        };
      })()`)
      for (const property of ['bounded', 'overflow', 'actions', 'aligned', 'scrollable', 'blue']) {
        assert.equal(layout[property], true, `${theme} ${width}x${height}: ${property}`)
      }
      await js("document.querySelector('[data-rate-rule-fields]').scrollTop = 10000; new Promise(resolve => requestAnimationFrame(resolve))")
      assert.equal(await js("document.querySelector('dialog button[type=submit]').getBoundingClientRect().top"), layout.footerTop, 'Scrolling fields keeps the footer in place')
      for (const label of ['Maximum height', 'Service leg']) {
        await js(`document.querySelector('button[aria-label^="${label}"]').focus(); new Promise(resolve => requestAnimationFrame(resolve))`)
        assert.equal(await js(`(() => {
          const trigger = document.querySelector('button[aria-label^="${label}"]');
          const tip = document.getElementById(trigger.getAttribute('aria-describedby'));
          const r = tip.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return getComputedStyle(tip).visibility === 'visible' && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && Boolean(hit?.closest('dialog'));
        })()`), true, `${theme} ${width}: ${label} remains visible in the viewport`)
      }
      await js("document.querySelector('dialog button[aria-label=\"Close rate rule dialog\"]').focus()")
      await writeFile(`${directory}/rule-${theme}-${width}-${height}.png`, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 768, height: 700, deviceScaleFactor: 1, mobile: false })
  const saveBounds = await js("(() => { const r = document.querySelector('dialog button[type=submit]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()")
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...saveBounds })
  await until("getComputedStyle(document.querySelector('dialog button[type=submit]')).backgroundColor === 'rgb(29, 78, 216)'")
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...saveBounds })
  await until("getComputedStyle(document.querySelector('dialog button[type=submit]')).backgroundColor === 'rgb(30, 64, 175)'")
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...saveBounds })
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 })
  await fill('#rate-rule-shop-category', 'category-1')
  await fill('#rate-rule-extra-fee', '12.5')
  await fill('#rate-rule-included-weight', '0')
  await click('Save rate rule')
  await until("document.querySelector('#rate-rule-included-weight[aria-invalid=true]')")
  assert.equal(await js("document.querySelector('#rate-rule-extra-fee').value"), '12.5', 'Validation preserves the rule draft')
  await fill('#rate-rule-included-weight', '1')
  await click('Save rate rule')
  await until("!document.querySelector('dialog[open]')")
  assert.equal(await js("document.activeElement.textContent.trim()"), 'Add rate rule', 'Add restores trigger focus')
  await js("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit').click()")
  await until("document.querySelector('dialog[open]')")
  assert.equal(await js("document.querySelector('#rate-rule-extra-fee').value"), '12.5', 'Edit retains the saved rule')
  await fill('#rate-rule-extra-fee', '15')
  await click('Save rate rule')
  await until("!document.querySelector('dialog[open]')")
  assert.equal(await js("document.activeElement.textContent.trim()"), 'Edit', 'Edit save restores trigger focus')
  await click('Add rate rule')
  await fill('#rate-rule-shop-category', 'category-1')
  await fill('#rate-rule-extra-fee', '99')
  await click('Save rate rule')
  await until("document.querySelector('dialog [role=alert]')")
  assert.equal(await js("document.querySelector('#rate-rule-extra-fee').value"), '99', 'Duplicate validation preserves the draft')
  await js("document.querySelector('dialog button[type=submit]').focus()")
  await key('Tab', 'Tab', 9)
  // Native dialogs may pass through browser chrome before wrapping back to the first control.
  if (await js("document.activeElement === document.body")) await key('Tab', 'Tab', 9)
  assert.equal(await js("Boolean(document.activeElement.closest('dialog'))"), true, 'Tab returns to the modal without focusing the background')
  await key('Escape', 'Escape', 27)
  await until("!document.querySelector('dialog[open]')")
  assert.equal(await js("document.activeElement.textContent.trim()"), 'Add rate rule', 'Escape restores trigger focus')
  await click('Add rate rule')
  await js("[...document.querySelectorAll('dialog button')].find(b => b.textContent === 'Cancel').click()")
  await until("!document.querySelector('dialog[open]')")
  await click('Add rate rule')
  await js("document.querySelector('button[aria-label=\"Close rate rule dialog\"]').click()")
  await until("!document.querySelector('dialog[open]')")
  assert.equal(await js('window.ratesFleetFixture.writes.length'), 0, 'Rule edits stay in the local rate-card draft')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 700, deviceScaleFactor: 1, mobile: false })
  await js("document.documentElement.classList.remove('dark')")
  console.log('Rate-rule modal passed 12 viewport/theme states, validation, add/edit, keyboard and close checks.')
}
