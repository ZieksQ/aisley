// Build the four web apps first. Uses actual role routes with synthetic APIs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openChatBrowser } from './chat-browser-driver.mjs';
import { installNotificationsFixture } from './notifications-fixture.mjs';

if (!process.env.CHROMIUM_BINARY && existsSync('/usr/bin/chromium')) process.env.CHROMIUM_BINARY = '/usr/bin/chromium';

const artifacts = resolve('node_modules/.cache/notifications-browser');
mkdirSync(artifacts, { recursive: true });
const roles = (process.env.NOTIFICATION_BROWSER_ROLES ?? 'customer,seller,admin,logistics').split(',');
const servers = [];
const origins = {};
let browser;
let checks = 0;
async function waitForServer(origin) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch { /* server is starting */ }
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error(`Preview did not start: ${origin}`);
}
try {
  for (const [index, role] of roles.entries()) {
    const app = role === 'customer' ? 'webapp' : role;
    const port = 15430 + index;
    const origin = origins[role] = `http://127.0.0.1:${port}`;
    const args = role === 'customer'
      ? ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)]
      : ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
    servers.push(spawn(process.execPath, args, { cwd: resolve(`src/${app}`), stdio: ['ignore', 'ignore', 'inherit'] }));
    await waitForServer(origin);
  }
  browser = await openChatBrowser();
  const js = browser.evaluate;
  const pageRows = "document.querySelectorAll('.notification-center .notification-row').length";
  const dialog = "document.querySelector('.notification-popover')";
  const click = text => js(`[...document.querySelectorAll('.notification-center button')].find(el=>el.textContent.trim()===${JSON.stringify(text)})?.click()`);
  const status = text => js(`[...document.querySelectorAll('.notification-status-options button')].find(el=>el.textContent===${JSON.stringify(text)}).click()`);
  const category = value => js(`(() => {const el=document.querySelector('.notification-category-select select');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  let injection;
  for (const role of roles) {
    if (injection) await browser.cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection });
    ({ identifier: injection } = await browser.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installNotificationsFixture.toString()})(${JSON.stringify(role)})` }));
    await browser.viewport(1440, 900, false);
    await browser.navigate(`${origins[role]}/notifications`);
    await browser.until(`${pageRows}>0`, `${role} page loaded`);
    assert.equal(await js('window.notificationFixture.reads.length'), 0, 'listing never marks read');
    assert.equal(await js("document.querySelectorAll('.notification-center h1, .notification-center h2').length"), 1);
    assert(await js("document.querySelector('.notification-center').innerText.includes('<script>Plain text stays safe.</script>')"));
    assert(await js("document.querySelector('.notification-center').innerText.includes('Date unavailable')"));
    assert(await js("document.querySelector('.notification-center').innerText.includes('Other')"));
    assert.equal(await js("document.querySelectorAll('h1').length"), 1, 'one page heading across shell and inbox');
    checks += 6;
    for (const dark of role === 'customer' ? [false] : [false, true]) {
      await js(`document.documentElement.classList.toggle('dark',${dark})`);
      for (const width of [320, 390, 768, 1440]) {
        await browser.viewport(width, 850, width < 800);
        assert(await js('document.documentElement.scrollWidth <= innerWidth'), `${role}/${width} page overflow`);
        await js("document.querySelector('.notification-trigger').click()");
        await browser.until(`Boolean(${dialog})`, 'panel opened');
        assert(await js(`(() => {const r=${dialog}.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`), `${role}/${width} panel bounded`);
        assert.equal(await js('window.notificationFixture.reads.length'), 0, 'preview never marks read');
        assert.equal(await js("document.querySelectorAll('.notification-popover .notification-row').length"), 5);
        if ([390, 1440].includes(width)) {
          await browser.screenshot(resolve(artifacts, `${role}-${dark ? 'dark' : 'light'}-${width}-panel.png`));
        }
        await js("document.querySelector('[aria-label=\"Close notifications\"]').click()");
        await browser.until(`!${dialog}`, 'close control');
        assert(await js("document.activeElement.classList.contains('notification-trigger')"), 'close restores bell focus');
        if ([390, 1440].includes(width)) await browser.screenshot(resolve(artifacts, `${role}-${dark ? 'dark' : 'light'}-${width}-page.png`));
        checks++;
      }
    }
    await browser.viewport(390);
    await js("document.querySelector('.notification-trigger').focus();window.notificationEvents=[];['keydown','click','focusin'].forEach(type=>document.addEventListener(type,event=>window.notificationEvents.push({type,target:event.target.className,key:event.key,detail:event.detail})))");
    await browser.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await browser.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await browser.until(`document.activeElement===${dialog}`, 'keyboard opening focuses dialog');
    await browser.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await browser.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await js("document.activeElement.getAttribute('aria-label')"), 'Refresh notifications');
    await browser.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.until(`!${dialog}`, 'Escape dismisses panel');
    assert(await js("document.activeElement.classList.contains('notification-trigger')"));
    await js("document.querySelector('.notification-trigger').click()");
    await browser.until(`Boolean(${dialog})`, 'panel ready for outside click');
    await js("document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    await browser.until(`!${dialog}`, 'outside pointer dismisses');
    checks += 3;

    await click('Next');
    await browser.until("location.search.includes('page=2')", 'pagination URL');
    await browser.until("!document.querySelector('.notification-list').getAttribute('aria-busy').includes('true')", 'page 2 loaded');
    await category('support');
    await browser.until("location.search.includes('category=support')&&!location.search.includes('page=')", 'filter resets page');
    await status('Unread');
    await browser.until(`${pageRows}>0&&![...document.querySelectorAll('.notification-center .notification-row')].some(el=>el.dataset.unread!=='true')`, 'unread category results');
    assert(await js("location.search.includes('status=unread')&&location.search.includes('category=support')"));
    const filteredQuery = await js('location.search');
    await js('history.back()');
    await browser.until("!location.search.includes('status=unread')&&location.search.includes('category=support')", 'browser back restores filter');
    await js('history.forward()');
    await browser.until(`location.search===${JSON.stringify(filteredQuery)}&&${pageRows}>0`, 'browser forward restores filter');
    assert(await js("document.querySelector('.notification-trigger').getAttribute('aria-label').includes('22 unread')"), 'filters preserve global count');
    checks += 6;

    await js('window.notificationFixture.fail=true');
    await status('Read');
    await browser.until("Boolean(document.querySelector('.notification-center [role=alert]'))", 'error shown');
    assert.equal(await js("document.querySelectorAll('.notification-center .notification-empty').length"), 0, 'failure is not empty');
    const target = await js("(() => {const el=document.querySelector('.notification-error button');const r=el.getBoundingClientRect();return {width:r.width,height:r.height}})()");
    assert(target.width >= 44 && target.height >= 44, 'retry target size');
    await js('window.notificationFixture.fail=false'); await click('Try again');
    await browser.until("!document.querySelector('.notification-center [role=alert]')", 'retry recovers');
    await js('window.notificationFixture.empty=true'); await status('All');
    await browser.until("Boolean(document.querySelector('.notification-center .notification-empty'))", 'filtered empty');
    await js('window.notificationFixture.empty=false'); await category('all');
    await browser.until(`${pageRows}>0`, 'results recover');
    checks += 5;

    // Out-of-order requests must leave the latest filter in control.
    await js('window.notificationFixture.delay=450'); await status('Read');
    await js('window.notificationFixture.delay=0'); await status('Unread');
    await browser.until(`${pageRows}>0&&!document.querySelector('.notification-list').getAttribute('aria-busy').includes('true')`, 'latest filter ready');
    await new Promise(done => setTimeout(done, 550));
    assert(await js("[...document.querySelectorAll('.notification-center .notification-row')].every(el=>el.dataset.unread==='true')"));
    checks++;

    await js("document.querySelector('.notification-trigger').click()");
    await browser.until(`Boolean(${dialog})`, 'preview ready for error');
    await js('window.notificationFixture.fail=true;document.querySelector(\'[aria-label="Refresh notifications"]\').click()');
    await browser.until("Boolean(document.querySelector('.notification-popover [role=alert]'))", 'preview refresh error');
    assert.equal(await js("document.querySelectorAll('.notification-popover .notification-row').length"), 5, 'failed refresh retains preview');
    await js('window.notificationFixture.fail=false;document.querySelector(\'[aria-label="Refresh notifications"]\').click()');
    await browser.until("!document.querySelector('.notification-popover [role=alert]')", 'preview retry');
    await js("document.querySelector('[aria-label=\"Close notifications\"]').click()");
    await browser.viewport(390, 320, true);
    await js("document.querySelector('.notification-trigger').click()");
    await browser.until(`Boolean(${dialog})`, 'short viewport panel');
    assert(await js(`(() => {const r=${dialog}.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`), 'short viewport bounded');
    assert.equal(await js("document.querySelector('.notification-view-all').getAttribute('href')"), '/notifications');
    await js("document.querySelector('.notification-center').focus();document.body.focus();document.querySelector('.notification-category-select select').focus()");
    await browser.until(`!${dialog}`, 'outside focus dismisses without trapping focus');
    assert(await js("document.activeElement.matches('.notification-category-select select')"));
    await browser.viewport(390);
    checks += 5;

    if (role === 'admin') {
      await browser.until("Boolean(document.querySelector('.notification-center .notification-row button:not(:disabled)'))", 'admin rows ready for mutation');
      await js('window.notificationFixture.failRead=true');
      await js("document.querySelector('.notification-center .notification-row button').click()");
      await browser.until("Boolean(document.querySelector('.notification-center [role=alert]'))", 'read mutation failure');
      assert(await js("location.pathname==='/notifications'"), 'failed read prevents navigation');
      await js('window.notificationFixture.failRead=false');
      await click('Mark all read');
      await browser.until("window.notificationFixture.rows.every(row=>row.read_at)", 'global mark all read');
      assert(await js("window.notificationFixture.reads.some(path=>path.endsWith('/read-all'))"));
      await status('All');
      await browser.until(`${pageRows}>0`, 'read rows after bulk update');
      checks += 3;
    } else {
      await category('support');
      await browser.until("Boolean(document.querySelector('.notification-center .notification-row a[href*=\"support-tickets?ticket=\"]'))&&!document.querySelector('.notification-list').getAttribute('aria-busy').includes('true')", 'support available');
      const first = await js("document.querySelector('.notification-center .notification-row a').getAttribute('href')");
      assert(first.includes('support-tickets?ticket='), `${role} support destination`);
      // Execute the real link handler without leaving the notification route.
      await js("document.addEventListener('click',event=>event.preventDefault(),{once:true,capture:true});document.querySelector('.notification-center .notification-row a').click()");
      await browser.until('window.notificationFixture.reads.length>0', 'support read mutation');
      checks++;
    }
    await browser.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert(await js("parseFloat(getComputedStyle(document.querySelector('.notification-row-action')).transitionDuration)<=0.00002"));
    await browser.cdp('Emulation.setEmulatedMedia', { features: [] });
    checks++;
    const capture = await js(`(() => {const root=document.documentElement.cloneNode(true);root.querySelectorAll('script,nextjs-portal').forEach(el=>el.remove());const base=document.createElement('base');base.href=location.origin;root.querySelector('head').prepend(base);return '<!doctype html>'+root.outerHTML})()`);
    writeFileSync(resolve(artifacts, `${role}-inspection.html`), capture);
    await js("document.querySelector('.notification-trigger').click()");
    await browser.until(`Boolean(${dialog})`, 'panel before logout');
    await js("window.notificationFixture.delay=150;document.querySelector('[aria-label=\"Refresh notifications\"]').click()");
    if (role === 'customer') {
      await js("document.querySelector('[aria-label^=\"Account menu for\"]').click()");
      await browser.until("[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='Logout')", 'logout menu');
    }
    await js(`[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(role === 'customer' ? 'Logout' : 'Sign out')}).click()`);
    await browser.until("!document.querySelector('.notification-trigger')&&!document.querySelector('.notification-row')", 'logout clears inbox and panel');
    await new Promise(done => setTimeout(done, 250));
    assert(await js("!document.querySelector('.notification-row')"), 'late refresh cannot restore signed-out previews');
    checks += 2;
  }
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors));
  console.log(`Passed ${checks} notification route, panel, filter, state, navigation and responsive checks.`);
  console.log(`Screenshots: ${artifacts}`);
} catch (error) {
  if (browser) console.error(await browser.evaluate(`({url:location.href,body:document.body.innerText.slice(-1500),events:window.notificationEvents,active:document.activeElement?.outerHTML,dialog:document.querySelector('.notification-popover')?.outerHTML})`));
  throw error;
} finally {
  if (browser) await browser.close();
  for (const server of servers) server.kill();
}
