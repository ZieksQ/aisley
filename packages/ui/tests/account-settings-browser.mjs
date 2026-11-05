// Run from the repository root: node packages/ui/tests/account-settings-browser.mjs
// Real role components and CSS, synthetic account APIs/auth, isolated workspace frame.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openBrowser, pause } from './account-settings/browser.mjs';

const port = process.env.ACCOUNT_SETTINGS_PORT ?? '15220';
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['packages/ui/tests/account-settings/server.mjs'], { env: { ...process.env, ACCOUNT_SETTINGS_PORT: port }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });
let browser;
const artifacts = resolve('node_modules/.cache/account-settings-browser');
mkdirSync(artifacts, { recursive: true });
const sections = { admin: ['profile', 'security'], seller: ['profile', 'storefront', 'pickup-addresses', 'security'], logistics: ['profile', 'organization', 'security'], customer: ['profile', 'id-image', 'preferences', 'security'] };
let combinations = 0;

try {
  for (let count = 0; !output.includes('fixture ready'); count++) {
    if (count === 100 || server.exitCode !== null) throw new Error(output);
    await pause(100);
  }
  browser = await openBrowser();
  const page = await browser.page();
  const js = (expression) => page.evaluate(expression);
  async function until(expression) {
    for (let count = 0; count < 120; count++) {
      if (await js(`Boolean(${expression})`)) return;
      await pause(100);
    }
    throw new Error(`Timed out: ${expression}\n${await js('document.body.innerText')}`);
  }
  async function navigate(role, section = 'profile', theme = 'light') {
    const previous = await js('window.fixture?.navigation');
    await page.cdp('Page.navigate', { url: `${origin}/?role=${role}&section=${section}&theme=${theme}&keep=present` });
    await until(`window.fixture?.navigation !== ${JSON.stringify(previous)} && document.querySelector('.account-settings-nav')`);
  }
  async function select(section) {
    await until(`document.querySelector('.account-settings-nav button[aria-controls$="-${section}"]')`);
    await js(`[...document.querySelectorAll('.account-settings-nav button')].find(button => button.getAttribute('aria-controls').endsWith('-${section}')).click()`);
    await until(`new URLSearchParams(location.search).get('section') === '${section}' && document.querySelector('.account-settings-nav [aria-current]').getAttribute('aria-controls').endsWith('-${section}')`);
    assert.equal(await js('new URLSearchParams(location.search).get("keep")'), 'present');
  }
  const visible = (selector) => `[...document.querySelectorAll(${JSON.stringify(selector)})].filter(el => el.getClientRects().length)`;
  async function fill(selector, value) {
    await js(`(() => { const el = ${visible(selector)}[0]; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  }
  async function submit(label) {
    await js(`(() => { const button = ${visible('button')}.find(button => button.textContent.trim() === ${JSON.stringify(label)}); button.focus(); button.click(); })()`);
  }

  for (const role of Object.keys(sections)) {
    for (const theme of role === 'customer' ? ['light'] : ['light', 'dark']) {
      await navigate(role, 'profile', theme);
      for (const width of [320, 390, 768, 1440]) {
        await page.viewport(width);
        for (const section of sections[role]) {
          await select(section);
          await pause(80);
          assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true, `${role}/${theme}/${width}/${section} overflow`);
          assert.equal(await js('document.querySelectorAll("h1").length'), 1);
          assert.equal(await js('document.querySelectorAll(".account-settings-content > div:not([hidden])").length'), 1);
          assert.equal(await js(`${visible('.account-settings-content input, .account-settings-content button')}.every(el => !el.closest('[hidden]'))`), true);
          combinations++;
          if (width === 390 || width === 1440) {
            const { data } = await page.cdp('Page.captureScreenshot', { format: 'jpeg', quality: 65, captureBeyondViewport: false });
            writeFileSync(resolve(artifacts, `${role}-${theme}-${width}-${section}.jpg`), Buffer.from(data, 'base64'));
          }
        }
      }
    }
    await navigate(role, 'invalid');
    assert.equal(await js('document.querySelector(".account-settings-nav [aria-current]").textContent.trim()'), 'Profile');
    const firstName = role === 'logistics' ? '#first_name' : 'input[name="first_name"]';
    await fill(firstName, 'Draft name');
    await select('security');
    await fill('input[type="password"]', 'Secret123');
    await select('profile');
    assert.equal(await js(`${visible(firstName)}[0].value`), 'Draft name', `${role} profile draft`);
    await select('security');
    assert.equal(await js(`${visible('input[type="password"]')}[0].value`), '', `${role} secret disposal`);
    await js('history.back()');
    await until('document.querySelector(".account-settings-nav [aria-current]").textContent.trim() === "Profile"');
    await js('history.forward()');
    await until('document.querySelector(".account-settings-nav [aria-current]").textContent.trim() === "Security"');
    const beforeReload = await js('window.fixture.navigation');
    await page.cdp('Page.reload');
    await until(`window.fixture?.navigation !== ${JSON.stringify(beforeReload)} && document.querySelector('.account-settings-nav')`);
    await until('document.querySelector(".account-settings-nav [aria-current]")?.textContent.trim() === "Security"');
    await select('profile');
    await fill(firstName, 'Saved name');
    await submit('Save profile');
    await until('window.fixture.writes.some(write => write.path.endsWith("/profile"))');
    await until('document.querySelector("[role=status]")');
    await js('window.fixture.mode="validation"');
    await fill(firstName, 'Invalid name');
    await submit('Save profile');
    await until('document.body.innerText.includes("Enter your first name.")');
    assert.equal(await js(`${visible(firstName)}[0].getAttribute('aria-invalid')`), 'true');
    await js('window.fixture.mode="normal"');
    await fill(firstName, 'Retry name');
    await submit('Save profile');
    await until('document.querySelector(".account-settings-name").textContent.includes("Retry name")');
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.equal(await js('getComputedStyle(document.querySelector(".account-settings-nav button")).transitionDuration'), '0s');
    await page.cdp('Emulation.setEmulatedMedia', { features: [] });
    // Upload previews, validation, confirmed removal, Escape and focus restoration.
    await select('profile');
    async function chooseImage(name, type = 'image/png') {
      await js(`(() => { const input = ${visible('input[type=file]')}[0]; const transfer = new DataTransfer(); transfer.items.add(new File(['fixture image'], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} })); input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    }
    await chooseImage('blocked.gif', 'image/gif');
    await until('document.body.innerText.includes("JPEG")');
    const uploadsBefore = await js('window.fixture.writes.length');
    await chooseImage('portrait.png');
    await until(`document.querySelector('img[alt="Selected profile photo preview"]')`);
    await submit('Upload');
    await until(`window.fixture.writes.length > ${uploadsBefore} && ${visible('button')}.some(button => button.textContent.trim() === 'Remove')`);
    await submit('Remove');
    await until('document.querySelector("dialog[open]")');
    assert.equal(await js('document.activeElement.textContent.trim()'), 'Cancel');
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await until('!document.querySelector("dialog[open]")');
    assert.equal(await js('document.activeElement.textContent.trim()'), 'Remove');
    await submit('Remove');
    await until('document.querySelector("dialog[open]")');
    await submit('Remove photo');
    await until('!document.querySelector("dialog[open]")');
    assert.equal(await js(`${visible('button')}.some(button => button.textContent.trim() === 'Remove')`), false);

    if (role === 'seller') {
      await select('storefront');
      await fill('input[name="name"]', 'Updated Shop');
      await js(`${visible('input[type=checkbox]')}[0].click()`);
      await until('document.body.innerText.includes("Vacation message")');
      await fill('textarea[required]', 'Back next week.');
      await submit('Save storefront');
      await until('window.fixture.writes.some(write => write.path.endsWith("/storefront"))');
      const payload = await js('JSON.parse(window.fixture.writes.find(write => write.path.endsWith("/storefront")).body)');
      assert.equal(payload.is_on_vacation, true);
      assert.equal(payload.name, 'Updated Shop');
      await select('pickup-addresses');
      await until('document.body.innerText.includes("Add a pickup address before requesting")');
      await submit('Add address');
      await until('document.querySelector("[role=dialog]")');
      await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    }
    if (role === 'logistics') {
      await select('organization');
      await fill('#business_name', 'Updated Express');
      await submit('Save organization');
      await until('window.fixture.writes.some(write => write.path.endsWith("/organization"))');
      await fill('#hub-location-reason', 'Corrected loading entrance.');
      await js('window.fixture.mode="conflict"');
      await submit('Save hub pin');
      await until('window.fixture.writes.some(write => write.path.endsWith("/hub-location"))');
      await until('document.body.innerText.includes("changed in another session")');
      await js('window.fixture.mode="normal"');
    }
    if (role === 'customer') {
      await select('preferences');
      await until(`${visible('input[type=checkbox]')}.length === 1`);
      await js(`${visible('input[type=checkbox]')}[0].click()`);
      await submit('Save preference');
      await until('document.body.innerText.includes("messages are on")');
    }

    // Existing password contracts remain distinct: Admin uses its current form;
    // Customer/Seller/Logistics retain emailed codes and session recovery.
    await select('security');
    const passwordForm = 'form:has(input[autocomplete="new-password"])';
    await fill(passwordForm + ' input[name="current_password"]', 'Current123');
    await fill(passwordForm + ' input[name="password"]', 'Replacement123');
    await fill(passwordForm + ' input[name="password_confirmation"]', 'Replacement123');
    if (role === 'admin') {
      await submit('Update password');
      await until('window.fixture.writes.some(write => write.path.endsWith("/password"))');
    } else {
      await submit('Send verification code');
      await until('document.querySelector("input[name=verification_code]")');
      await fill('input[name="verification_code"]', '123456');
      await js('window.fixture.mode="password-uncertain"');
      await submit('Verify and update password');
      await until('document.body.innerText.includes("outcome is uncertain")');
      await select('profile');
      await select('security');
      await until('document.body.innerText.includes("outcome is uncertain")');
      assert.equal(await js(`${visible('button')}.find(button => button.textContent.trim() === 'Sign-in verification required').disabled`), true);
      await js('window.fixture.mode="normal"');
    }

    // Late writes from the prior editor must never update a new identity.
    await select('profile');
    await fill(firstName, 'Old account draft');
    await js('window.fixture.mode="pending"');
    await submit('Save profile');
    await until('typeof window.fixture.resolve === "function"');
    const authUpdates = await js('window.fixture.authUpdates.length');
    await js('window.fixture.mode="normal"; window.fixture.switchIdentity()');
    await until('document.querySelector(".account-settings-name")?.textContent.includes("Lia")');
    await js('window.fixture.resolve()');
    await pause(100);
    assert.equal(await js('document.querySelector(".account-settings-name").textContent.includes("Lia")'), true);
    assert.equal(await js('window.fixture.authUpdates.length'), authUpdates);
    await navigate(role);
    await js('document.querySelector(".account-settings-nav button").focus()');
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await js('document.activeElement.getAttribute("aria-controls").endsWith("-' + sections[role][1] + '")'), true);
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await until(`new URLSearchParams(location.search).get('section') === '${sections[role][1]}'`);
    const previousErrorNavigation = await js('window.fixture.navigation');
    await page.cdp('Page.navigate', { url: `${origin}/?role=${role}&mode=load-error` });
    await until(`window.fixture?.navigation !== ${JSON.stringify(previousErrorNavigation)} && document.querySelector('.account-settings-state-panel [type=button]')`);
    assert.equal(await js('document.querySelector(".account-settings-state-panel").getAttribute("role")'), 'alert');
    await js('window.fixture.mode="normal"');
    await submit('Try again');
    await until('document.querySelector(".account-settings-nav")');
    console.log(`${role}: responsive/themes, history/drafts, profile save/retry, image dialogs, role-specific forms, password contract and account-switch isolation passed`);
  }
  assert.deepEqual(browser.errors, []);
  console.log(`Passed ${combinations} role/theme/viewport/section combinations. Synthetic API coverage only.`);
  await page.close();
} finally {
  if (browser) await browser.close();
  server.kill();
}
