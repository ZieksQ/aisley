// Run against local Admin/Seller Vite servers (ports 15351/15352 by default).
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openBrowser, pause } from './account-settings/browser.mjs';
import { installFixture } from './portal-settings/fixture.mjs';
const artifacts = 'node_modules/.cache/portal-settings';
mkdirSync(artifacts, { recursive: true });
const browser = await openBrowser();
let combinations = 0;
try {
  for (const [role, port] of [['admin', process.env.ADMIN_SETTINGS_PORT ?? 15351], ['seller', process.env.SELLER_SETTINGS_PORT ?? 15352]]) {
    const page = await browser.page();
    const js = value => page.evaluate(value);
    const until = async expression => {
      for (let i = 0; i < 100; i++) { if (await js(`Boolean(${expression})`)) return; await pause(100); }
      throw new Error(`${role}: ${expression}\n${await js('document.body.innerText')}`);
    };
    await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installFixture.toString()})('${role}')` });
    async function navigate(path) {
      const previous = await js('window.settingsFixture?.navigation');
      await page.cdp('Page.navigate', { url: `http://127.0.0.1:${port}${path}` });
      await until(`window.settingsFixture && window.settingsFixture.navigation !== ${JSON.stringify(previous)} && document.querySelector(".portal-shell")`);
    }
    async function clickLink(path) {
      await js(`document.querySelector('a[href="${path}"]').click()`);
      await until(`location.pathname === '${path}'`);
    }
    async function theme(value) {
      await js(`(()=>{const el=document.querySelector('select');el.value='${value}';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await until(`document.querySelector('select').value === '${value}'`);
    }
    await navigate('/account?section=security&keep=present#form');
    await until('location.pathname === "/settings/account" && document.querySelector(".account-settings-nav")');
    assert.equal(await js('location.search'), '?section=security&keep=present');
    assert.equal(await js('location.hash'), '#form');
    assert.match(await js('document.querySelector(".account-settings-nav [aria-current]").textContent'), /Security/);
    assert.equal(await js('document.querySelector(".account-settings-heading h2").textContent'), 'Account');
    assert.equal(await js(`!!document.querySelector("button[aria-label*=mode]")`), false);
    await navigate('/settings');
    await until('location.pathname === "/settings/account" && document.querySelector(".account-settings-nav")');
    for (const mode of ['light', 'dark']) {
      await navigate('/settings/appearance');
      await until('document.querySelector("select")');
      await theme(mode);
      for (const width of [390, 768, 1440]) {
        await page.viewport(width);
        for (const section of ['account', 'terms', 'billing', 'appearance']) {
          await navigate(`/settings/${section}`);
          await until(section === 'account' ? 'document.querySelector(".account-settings-nav")' : section === 'appearance' ? 'document.querySelector("select")' : `document.body.innerText.includes('${section === 'billing' ? 'Open payment settings' : 'Privacy Policy'}')`);
          await pause(120);
          assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true, `${role}/${mode}/${width}/${section} overflow`);
          assert.equal(await js('document.querySelectorAll("h1").length >= 1'), true);
          assert.equal(await js('document.documentElement.classList.contains("dark")'), mode === 'dark');
          const { data } = await page.cdp('Page.captureScreenshot', { format: 'png' });
          writeFileSync(`${artifacts}/after-${role}-${mode}-${width}-${section}.png`, Buffer.from(data, 'base64'));
          if (width === 1440 && section === 'appearance') {
            writeFileSync(`${artifacts}/${role}-${mode}.html`, await js(`(()=>{const root=document.documentElement.cloneNode(true);root.querySelectorAll('script').forEach(el=>el.remove());root.querySelectorAll('select').forEach((el,index)=>{const value=document.querySelectorAll('select')[index].value;el.querySelectorAll('option').forEach(option=>option.toggleAttribute('selected',option.value===value));});const base=document.createElement('base');base.href=location.origin;root.querySelector('head').prepend(base);return '<!doctype html>'+root.outerHTML})()`));
          }
          combinations++;
        }
      }
    }
    await theme('system');
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await until('document.documentElement.classList.contains("dark")');
    await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await until('!document.documentElement.classList.contains("dark")');
    await theme('dark');
    await page.cdp('Page.reload');
    await pause(800);
    await until('document.querySelector("select")?.value === "dark"');
    await js(`localStorage.setItem('aisley-${role}-theme','light');window.dispatchEvent(new StorageEvent('storage',{key:'aisley-${role}-theme'}))`);
    await until('document.querySelector("select")?.value === "light" && !document.documentElement.classList.contains("dark")');
    await js(`Storage.prototype.setItem = () => { throw new Error('Storage denied'); }`);
    await theme('dark');
    await until('document.documentElement.classList.contains("dark")');
    await navigate('/policy-consent');
    await until('location.pathname === "/settings/terms" && document.body.innerText.includes("Privacy Policy")');
    await js('window.settingsFixture.required = true');
    await clickLink('/settings/account');
    await until('location.pathname === "/settings/terms" && document.querySelectorAll("input[type=checkbox]").length === 2');
    await js('document.querySelectorAll("input[type=checkbox]").forEach(el=>el.click())');
    await until('[...document.querySelectorAll("button")].some(el=>el.textContent.trim()==="Accept" && !el.disabled)');
    await js('[...document.querySelectorAll("button")].find(el=>el.textContent.trim()==="Accept").click()');
    await until('window.settingsFixture.accepted && location.pathname === "/settings/account"');
    await until('document.querySelector(".account-settings-nav")');
    // Account forms retain ordinary drafts through section navigation.
    await js(`(()=>{const el=document.querySelector('input[name="first_name"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Draft');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await js('[...document.querySelectorAll(".account-settings-nav button")].find(el=>el.textContent==="Security").click()');
    await js('[...document.querySelectorAll(".account-settings-nav button")].find(el=>el.textContent==="Profile").click()');
    assert.equal(await js('document.querySelector("input[name=first_name]").value'), 'Draft');
    await clickLink('/settings/billing');
    await until('document.querySelector("a.portal-button")');
    const paymentPath = role === 'admin' ? '/finance/automation' : '/finance/payment-settings';
    assert.equal(await js('document.querySelector("a.portal-button").getAttribute("href")'), paymentPath);
    await page.viewport(390);
    await js(`document.querySelector("button[aria-label='Open sidebar']").click()`);
    await until('document.querySelector("[role=dialog]")');
    await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
    await until('!document.querySelector("[role=dialog]")');
    assert.equal(await js('document.activeElement.getAttribute("aria-label")'), 'Open sidebar');
    if (role === 'admin') {
      await js('window.settingsFixture.actor.permissions=[];window.dispatchEvent(new Event("admin:authorization-changed"))');
      await until('document.body.innerText.includes("Access restricted")');
      assert.equal(await js(`!!document.querySelector("nav[aria-label=Settings] a[href='/settings/billing']")`), false);
      await js('window.settingsFixture.actor.setup_required=true;window.dispatchEvent(new Event("admin:authorization-changed"))');
      await until('location.pathname === "/setup"');
    }
    await page.close();
  }
  assert.deepEqual(browser.errors, []);
  console.log(`PASS: ${combinations} role/theme/viewport/section combinations; redirects, consent, drafts, Billing, permissions, setup, themes, storage and drawer checks.`);
} finally { await browser.close(); }
