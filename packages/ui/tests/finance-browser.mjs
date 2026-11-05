// Actual Finance role components with synthetic APIs; run with the Finance fixture server.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openBrowser, pause } from './account-settings/browser.mjs';
const artifacts = resolve('node_modules/.cache/finance-browser');
mkdirSync(artifacts, { recursive: true });
const server = spawn(process.execPath, ['packages/ui/tests/finance/server.mjs'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });
let browser;
let combinations = 0;
try {
  for (let count = 0; !serverOutput.includes('Finance fixture ready'); count++) {
    if (count > 100 || server.exitCode !== null) throw new Error(serverOutput);
    await pause(100);
  }
  browser = await openBrowser();
  const page = await browser.page();
  await page.cdp('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: artifacts });
  const js = (code) => page.evaluate(code);
  async function until(expression) {
    for (let count = 0; count < 100; count++) { if (await js(`Boolean(${expression})`)) return; await pause(100); }
    throw new Error(`Timed out: ${expression}\n${await js('document.body.innerText')}`);
  }
  async function navigate(role, path = '/finance', theme = 'light', extra = '') {
    const previous = await js('window.fixture?.revision');
    await page.cdp('Page.navigate', { url: `http://127.0.0.1:15224${path}?role=${role}&theme=${theme}&keep=present${extra}` });
    await until(`window.fixture?.revision !== ${JSON.stringify(previous)} && document.querySelector('.finance-workspace')`);
    await until(`!document.querySelector('.finance-skeleton') && ![...document.querySelectorAll('[role="status"]')].some(el=>el.textContent.includes('Loading'))`);
  }
  const visible = (selector) => `[...document.querySelectorAll(${JSON.stringify(selector)})].filter(el => el.getClientRects().length)`;
  async function click(label) {
    await js(`(() => { const button=${visible('button')}.find(el=>el.textContent.trim()===${JSON.stringify(label)}); if(!button) throw new Error('Missing button ${label}'); button.click(); })()`);
    await pause(100);
  }
  async function choose(value) {
    await js(`(() => { const el=document.querySelector('.report-period select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  }
  async function fill(selector, value) {
    await js(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  }
  const screens = {
    admin: ['/finance', '/finance/payouts', '/finance/remittances', '/finance/automation', '/finance/sandbox', '/finance/remittances/invoices/invoice-1', '/finance/remittances/batch-1', '/finance-holds', '/finance-holds/hold-1'],
    seller: ['/finance', '/finance/payouts', '/finance/payment-settings'],
    logistics: ['/finance', '/finance/payouts', '/finance/remittances', '/finance/payment-settings', '/finance/courier-cash', '/finance/remittances/invoices/invoice-1', '/finance/remittances/batch-1'],
  };
  for (const [role, paths] of Object.entries(screens)) for (const theme of ['light', 'dark']) for (const path of paths) {
    await navigate(role, path, theme);
    for (const width of [390, 768, 1440]) {
      await page.viewport(width); await pause(100);
      assert.equal(await js('document.documentElement.scrollWidth <= innerWidth'), true, `${role}/${path}/${theme}/${width} overflow`);
      assert.equal(await js(`getComputedStyle(document.querySelector('.portal-shell')).fontFamily.includes('Geist')`), true);
      assert.equal(await js(`${visible('.report-period input,.report-period button,.report-period select')}.every(el=>el.getBoundingClientRect().height>=44)`), true, 'date targets');
      const hasPicker = !/settings|automation|\/invoices\/|\/remittances\/batch|sandbox|hold-1/.test(path);
      assert.equal(await js('!!document.querySelector(".report-period")'), hasPicker, `${path} date picker`);
      if (path === '/finance') {
        assert.equal(await js(`getComputedStyle(document.querySelector('.finance-workspace')).getPropertyValue('--finance-accent').trim()`), role === 'logistics' ? theme === 'dark' ? '#93c5fd' : '#1e40af' : theme === 'dark' ? '#c4b5fd' : '#4c1268');
      }
      if (width !== 768) {
        const { data } = await page.cdp('Page.captureScreenshot', { format: 'jpeg', quality: 65, captureBeyondViewport: false });
        writeFileSync(resolve(artifacts, `${role}-${theme}-${width}-${path.replaceAll('/', '_')}.jpg`), Buffer.from(data, 'base64'));
      }
      combinations++;
    }
  }
  for (const role of ['admin', 'seller', 'logistics']) {
    await navigate(role); await page.viewport(1440);
    const initial = await js('document.querySelector(".dashboard-stat-value").textContent');
    const original = await js('document.querySelector(".report-period input").value');
    await choose('last-month'); await click('Cancel');
    assert.equal(await js('document.querySelector(".report-period input").value'), original);
    await choose('last-month'); await click('Apply');
    await until(`new URLSearchParams(location.search).has('date_from') && document.querySelector('.dashboard-stat-value') && document.querySelector('.dashboard-stat-value').textContent !== ${JSON.stringify(initial)}`);
    assert.equal(await js('new URLSearchParams(location.search).get("keep")'), 'present');
    assert.equal(await js('!!document.querySelector(".finance-historical-note")'), true);
    await fill('#finance-search', 'AIS-0001'); await click('Search');
    await until('new URLSearchParams(location.search).get("search")==="AIS-0001" && document.querySelector(".finance-ledger")');
    const href = await js('document.querySelector(".finance-ledger a").href');
    assert.equal(new URL(href).searchParams.get('search'), 'AIS-0001');
    assert.ok(new URL(href).searchParams.get('date_from'));
    await click('Next'); await until('new URLSearchParams(location.search).get("page")==="2" && document.querySelector(".finance-ledger")');
    await choose('today'); await click('Apply');
    await until('!new URLSearchParams(location.search).has("page") && document.querySelector(".dashboard-stat-value")');
    await js('history.back()'); await until('new URLSearchParams(location.search).get("page")==="2" && document.querySelector(".finance-ledger")');
    await choose('all'); await click('Apply');
    await until('new URLSearchParams(location.search).get("all_time")==="1" && document.querySelector(".dashboard-stat-value")');
    assert.equal(await js('document.querySelectorAll(".report-period input").length'), 0);
    await choose('custom'); await fill('.report-period input[type=date]', '2099-01-01');
    assert.equal(await js('document.querySelector(".report-period").checkValidity()'), false);
    await click('Cancel');
    await js('window.fixture.mode="error"'); await click('Refresh');
    await until('document.querySelector("[role=alert]")?.textContent.includes("temporarily")');
    await js('window.fixture.mode="normal"'); await click('Retry');
    await until('!document.querySelector("[role=alert]") && document.querySelector(".dashboard-stat-value")');
    await js('window.fixture.mode="empty"'); await click('Refresh');
    await until('document.body.innerText.includes("No ledger entries")');
    assert.equal(await js('document.querySelector(".dashboard-stat-value").textContent.includes("0.00")'), true);
    await js('window.fixture.mode="normal";window.fixture.delay=400'); await choose('today'); await click('Apply');
    await choose('last-month'); await click('Apply');
    await until('document.querySelector(".finance-historical-note") && document.querySelector(".dashboard-stat-value")');
    await pause(600);
    assert.equal(await js('!!document.querySelector(".finance-historical-note")'), true);
    await js('window.fixture.delay=0;window.fixture.account="second";window.dispatchEvent(new Event("fixture-account"))');
    await until('document.querySelector(".dashboard-stat-value")?.textContent.includes("9,900")');
    await js('window.fixture.mode="denied"'); await click('Refresh');
    await until('!document.querySelector(".dashboard-stat-value") && document.querySelector("[role=alert]")');
  }
  await navigate('logistics', '/finance/remittances');
  await click('Payment history');
  await until('document.querySelector(".report-period").textContent.includes("submission")');
  await choose('last-month'); await click('Apply');
  await until('window.fixture.reads.some(path=>path.includes("/remittances?") && path.includes("date_from="))');
  await navigate('admin', '/finance/sandbox'); await click('Payments');
  assert.equal(await js('!!document.querySelector(".report-period")'), true);
  await click('Webhook deliveries');
  assert.equal(await js('document.querySelector(".report-period").textContent.includes("Event creation")'), true);
  await navigate('logistics', '/finance/courier-cash'); await click('Receipt history');
  await until('document.querySelector(".report-period").textContent.includes("received")');
  await choose('last-month'); await click('Apply');
  await until('window.fixture.reads.some(path=>path.includes("courier-cash/receipts?") && path.includes("date_from="))');
  await navigate('admin');
  await js('document.querySelector(".report-period select").focus()');
  await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await js('document.activeElement.type'), 'date');
  assert.equal(await js('getComputedStyle(document.activeElement).outlineStyle'), 'solid');
  // Downloads use authenticated bounded URLs and surface errors without leaving Finance.
  await js('window.fixture.downloadError=true');
  await js('document.querySelector(".report-csv-export a").click()');
  await until('document.querySelector(".report-csv-export [role=alert]")');
  await js('window.fixture.downloadError=false');
  await js('document.querySelector(".report-csv-export a").click()');
  await until('!document.querySelector(".report-csv-export [role=alert]") && window.fixture.downloads.length===2');
  // Existing payment actions retain their role-owned payloads and confirmations.
  await navigate('admin', '/finance/payouts');
  await js('window.confirm=()=>true; document.querySelector("input[type=checkbox][aria-label]").click()');
  await click('Send payout');
  await until('window.fixture.writes.some(write=>write.path.endsWith("payout-send"))');
  assert.equal(await js('window.fixture.writes[0].body.order_ids[0]'), 'order-1');
  await navigate('logistics', '/finance/remittances');
  await js('window.confirm=()=>true; document.querySelector("input[type=checkbox][aria-label]").click()');
  await click('Pay now');
  await until('window.fixture.writes.some(write=>write.path.endsWith("invoice-payments"))');
  await navigate('logistics', '/finance/courier-cash');
  await js('window.confirm=()=>true; document.querySelector("input[type=checkbox][aria-label]").click()');
  await click('Record cash received');
  await until('window.fixture.writes.some(write=>write.path.endsWith("courier-cash/receipts"))');
  await navigate('admin', '/finance/automation');
  await js('window.confirm=()=>true');
  await fill('#cod-deadline', '4');
  await click('Save settings');
  await until('window.fixture.writes.some(write=>write.path.endsWith("automation"))');
  assert.equal(await js('window.fixture.writes[0].body.cod_deadline_hours'), 96);
  await navigate('seller', '/finance/payment-settings');
  assert.equal(await js('[...document.querySelectorAll("button")].some(el=>el.textContent.includes("Save"))'), false);
  await navigate('admin', '/finance/remittances/invoices/invoice-1');
  await click('Download invoice PDF');
  await until('window.fixture.downloads.some(path=>path.endsWith("/pdf"))');
  await navigate('seller', '/finance/payouts');
  await click('Download PDF');
  await until('window.fixture.downloads.some(path=>path.endsWith("/receipt"))');
  await navigate('admin', '/finance-holds/hold-1');
  await until('document.querySelector("input[id^=allocation-amount]")');
  await fill('input[id^=allocation-amount]', '90');
  await js(`(() => { const el=document.querySelector('#hold-notes');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Confirmed last-mile evidence.');el.dispatchEvent(new Event('input',{bubbles:true})); window.confirm=()=>true; })()`);
  await click('Reconcile and release hold');
  await until('window.fixture.writes.some(write=>write.path.endsWith("reconcile-logistics"))');
  assert.equal(await js('window.fixture.writes[0].body.allocations[0].amount_cents'), 9000);
  for (const [role, path, button, suffix] of [
    ['admin', '/finance/payouts', 'Send payout', 'payout-send'],
    ['logistics', '/finance/remittances', 'Pay now', 'invoice-payments'],
    ['logistics', '/finance/courier-cash', 'Record cash received', 'courier-cash/receipts'],
  ]) {
    await navigate(role, path);
    await js('window.confirm=()=>true;window.fixture.writeMode="unknown";document.querySelector("input[type=checkbox][aria-label]").click()');
    await click(button);
    await until('window.fixture.writes.length===1 && document.querySelector("[role=alert]")');
    assert.equal(await js('document.querySelector(".report-period select").disabled'), true);
    const key = await js('window.fixture.writes[0].body.idempotency_key');
    await js('window.fixture.writeMode="normal"');
    await click(path.endsWith('courier-cash') ? 'Retry same receipt' : button);
    await until('window.fixture.writes.length===2');
    assert.equal(await js('window.fixture.writes[1].body.idempotency_key'), key, suffix + ' retry key');
    assert.equal(await js('window.fixture.writes[1].path.endsWith(' + JSON.stringify(suffix) + ')'), true);
  }
  await navigate('admin', '/finance/payouts');
  await js('window.fixture.permissions=["finance.view"];window.dispatchEvent(new Event("fixture-account"))');
  await until('!document.querySelector(".payment-loading") && document.querySelector(".payment-table")');
  assert.equal(await js('[...document.querySelectorAll("button")].some(el=>el.textContent.includes("Send payout"))'), false);
  assert.equal(browser.errors.length, 0, browser.errors.join('\n'));
  console.log(JSON.stringify({ result: 'passed', viewportThemeRoleScreens: combinations, checks: 'date presets/cancel/custom validation/URL/history/paging/CSV filters/stale requests/account changes/access loss/errors/empty/keyboard', screenshots: artifacts }));
} catch (error) { console.error(browser?.errors ?? serverOutput); throw error; } finally { if (browser) await browser.close(); server.kill(); }
