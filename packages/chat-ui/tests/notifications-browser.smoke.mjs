// Chromium against unchanged production builds and controlled API fixtures.
// Run from the repository root with the three app previews and ChromeDriver running.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifacts = resolve('node_modules/.cache/chat-notifications-browser');
await mkdir(artifacts, { recursive: true });
const driver = process.env.CHAT_BROWSER_DRIVER ?? 'http://127.0.0.1:19515';
const origins = { customer: 'http://127.0.0.1:15300', seller: 'http://127.0.0.1:15174', logistics: 'http://127.0.0.1:15176' };
const results = [];
async function command(method, path, body) {
  const response = await fetch(`${driver}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`);
  return payload.value;
}
function mockApi(role) {
  const original = window.fetch.bind(window);
  const kinds = role === 'customer' ? ['customer_shop', 'customer_logistics', 'courier_customer']
    : role === 'seller' ? ['seller_logistics', 'customer_shop', 'courier_seller']
    : ['logistics_courier', 'customer_logistics', 'seller_logistics'];
  const ids = [1, 2, 3].map((i) => `20000000-0000-4000-8000-00000000000${i}`);
  const state = window.chatNoticeFixture = { counts: [101, 2, 3], calls: 0, reads: 0, error: 0, delay: 0, inflight: 0, maxInflight: 0, account: '30000000-0000-4000-8000-000000000001', details: [] };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const thread = (index = 0) => ({
    id: ids[index], kind: kinds[index], counterparty_label: 'Receiver fixture', counterparty_role: 'courier',
    shop: { id: '40000000-0000-4000-8000-000000000001', name: 'Fixture Shop' }, customer_name: 'Fixture Buyer',
    order_id: '50000000-0000-4000-8000-000000000001', order_reference: 'ORDER-TEST',
    pickup_request_id: '60000000-0000-4000-8000-000000000001', pickup_request_reference: 'PICKUP-TEST',
    task_id: '70000000-0000-4000-8000-000000000001', task_reference: 'TASK-TEST', leg: 'final_mile',
    last_message_preview: 'Hello receiver — a new message', last_message_at: '2026-10-06T01:00:00Z',
    last_sequence: 101, last_read_sequence: state.counts[index] ? 0 : 101, unread_count: state.counts[index], send_allowed: true, read_only_reason: null,
  });
  window.fetch = async (input, options = {}) => {
    const path = new URL(input instanceof Request ? input.url : String(input), location.origin).pathname;
    if (!path.startsWith('/api/') && !path.startsWith('/sanctum/')) return original(input, options);
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (path.endsWith('/auth/me')) return json({
      [role]: { id: state.account, role, status: 'active', displayName: 'Test Customer', avatarUrl: null, email: 'fixture@example.test',
        profile: { first_name: 'Test', last_name: role, profile_photo_url: null },
        shop: { id: '40000000-0000-4000-8000-000000000001', name: 'Fixture Shop', status: 'active' },
        organization: { id: '80000000-0000-4000-8000-000000000001', business_name: 'Fixture Logistics', hub: { id: '90000000-0000-4000-8000-000000000001', name: 'Fixture Hub' } },
      },
    });
    if (path === '/api/v1/policy-consent/status') return json({ data: { all_required_accepted: true } });
    if (path.endsWith('/chat-notifications')) {
      state.calls++; state.inflight++; state.maxInflight = Math.max(state.maxInflight, state.inflight);
      try {
        if (state.delay) await new Promise((done) => setTimeout(done, state.delay));
        if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (state.error) return json({ message: 'Controlled fixture failure' }, state.error);
        return json({ data: ids.map((id, index) => ({ ...thread(index), id })).filter((item) => item.unread_count), meta: { unread_count: state.counts.reduce((a, b) => a + b, 0) } });
      } finally { state.inflight--; }
    }
    if (path.includes('/notifications')) return json({ data: [], unread_count: 0, meta: { total: 0 }, ...(path.endsWith('/unread-count') ? { data: { unread_count: 0 } } : {}) });
    if (path.endsWith('/chat-attachments')) return json({ data: { enabled: false } });
    const index = ids.findIndex((id) => path.includes(id));
    if (index >= 0) {
      if (path.endsWith('/read')) { state.reads++; state.counts[index] = 0; return json({ data: thread(index) }); }
      if (path.endsWith('/messages')) {
        const message = { id: 'a0000000-0000-4000-8000-000000000001', sequence: 101, body: 'Hello receiver — a new message', mine: false, sender_role: 'courier', created_at: '2026-10-06T01:00:00Z', context: null };
        return json({ items: [message], data: [message], next_cursor: null, meta: { next_cursor: null } });
      }
      state.details.push(ids[index]);
      return json({ data: thread(index) });
    }
    return json({ items: [], data: [], next_cursor: null, unread_count: 0, meta: { next_cursor: null, unread_count: 0 }, cart: { items: [], itemCount: 0 } });
  };
}
for (const role of Object.keys(origins)) {
  if (process.env.CHAT_BROWSER_ROLES && !process.env.CHAT_BROWSER_ROLES.split(',').includes(role)) continue;
  await mkdir(`${artifacts}/chrome-${role}`, { recursive: true });
  const session = await command('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'chrome', 'goog:chromeOptions': { binary: '/usr/bin/chromium', args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', `--user-data-dir=${artifacts}/chrome-${role}`, '--window-size=390,850'] } } } });
  const base = `/session/${session.sessionId}`;
  const js = (script, args = []) => command('POST', `${base}/execute/sync`, { script, args });
  const cdp = (cmd, params = {}) => command('POST', `${base}/goog/cdp/execute`, { cmd, params });
  const go = () => command('POST', `${base}/url`, { url: `${origins[role]}/notifications` });
  async function until(script, label, timeout = 25000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await js(script)) return; await new Promise((done) => setTimeout(done, 150)); }
    throw new Error(`${role}: ${label}: ${await js('return document.body.innerText.slice(-1800)')}`);
  }
  async function click(selector) {
    const element = await command('POST', `${base}/element`, { using: 'css selector', value: selector });
    return command('POST', `${base}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {});
  }
  const trigger = 'button[aria-label^="Chat messages"]';
  try {
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${mockApi.toString()})(${JSON.stringify(role)});chatNoticeFixture.delay=1800;` });
    if (role === 'customer') await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await go();
    await until(`return !!document.querySelector('${trigger}')`, 'header control');
    await click(trigger);
    await until('return document.querySelector("[role=dialog]")?.textContent.includes("Loading messages")', 'initial loading feedback');
    await until(`return document.querySelector('${trigger}')?.textContent === '99+'`, 'initial aggregate badge');
    await js('chatNoticeFixture.delay=0;document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
    // WebDriver sends actual keyboard input to the focused trigger and dialog.
    const triggerElement = await command('POST', `${base}/element`, { using: 'css selector', value: trigger });
    await command('POST', `${base}/element/${triggerElement['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: '\uE007' });
    await until('return document.activeElement?.getAttribute("role") === "dialog"', 'Enter opens and focuses dialog');
    let focused = await command('GET', `${base}/element/active`);
    await command('POST', `${base}/element/${focused['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: '\uE004' });
    assert.equal(await js('return document.activeElement?.textContent'), 'Close', 'Tab reaches Close');
    focused = await command('GET', `${base}/element/active`);
    await command('POST', `${base}/element/${focused['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: '\uE00C' });
    assert.equal(await js(`return document.activeElement === document.querySelector('${trigger}')`), true, 'keyboard Escape restores focus');
    results.push({ role, state: 'loading/keyboard' });
    for (const width of [390, 768, 1280]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width === 390 });
      for (const dark of role === 'customer' ? [false] : [false, true]) {
        await js('document.documentElement.classList.toggle("dark", arguments[0])', [dark]);
        await click(trigger);
        await until('return document.querySelector("[role=dialog]")?.querySelectorAll("li").length === 3', 'three chat previews');
        assert.equal(await js('return chatNoticeFixture.reads'), 0, 'preview must not mark read');
        if (role === 'customer') assert.equal(await js('return getComputedStyle(document.querySelector("[role=dialog]")).backgroundColor'), 'rgb(255, 255, 255)', 'Customer stays light under OS dark preference');
        assert.equal(await js('const r=document.querySelector("[role=dialog]").getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight'), true, 'viewport bounds');
        assert.equal(await js('return document.documentElement.scrollWidth <= innerWidth'), true, 'no page overflow');
        const shot = await command('GET', `${base}/screenshot`);
        await writeFile(`${artifacts}/${role}-${width}-${dark ? 'dark' : 'light'}.png`, Buffer.from(shot, 'base64'));
        await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
        assert.equal(await js(`return document.activeElement === document.querySelector('${trigger}')`), true, 'Escape restores focus');
        results.push({ role, width, dark, state: 'unread' });
      }
    }
    await click(trigger);
    const href = await js('return document.querySelector("[role=dialog] li a").getAttribute("href")');
    await click('[role=dialog] li a');
    await until('return chatNoticeFixture.reads > 0', 'deep link opens and reads selected thread');
    assert.equal(await js('return location.pathname + location.search'), href);
    await until(`return document.querySelector('${trigger}')?.getAttribute('aria-label') === 'Chat messages, 5 unread'`, 'read acknowledgment refreshes total');
    assert.ok((await js('return chatNoticeFixture.details')).length > 0, 'direct thread detail loaded despite empty first inbox page');
    // Refresh errors retain a labelled stale count. Retry recovers without showing a false empty inbox.
    await js('chatNoticeFixture.error=503');
    await click(trigger);
    await until('return document.querySelector("[role=dialog]")?.textContent.includes("Could not refresh")', 'error state');
    await js('chatNoticeFixture.error=0;chatNoticeFixture.counts=[0,0,0]');
    await click('[role=dialog] button.underline');
    await until('return document.querySelector("[role=dialog]")?.textContent.includes("No unread messages.")', 'retry and empty state');
    await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
    if (role === 'logistics') {
      await js('chatNoticeFixture.counts=[0,1,0]');
      await until(`return document.querySelector('${trigger}')?.getAttribute('aria-label') === 'Chat messages, 1 unread'`, 'periodic message detection away from selected thread', 18000);
      results.push({ role, state: 'periodic-refresh' });
    }
    await js('chatNoticeFixture.delay=500;window.dispatchEvent(new Event("focus"));window.dispatchEvent(new Event("online"));window.dispatchEvent(new Event("focus"))');
    await until('return chatNoticeFixture.inflight===0', 'serialized refresh');
    assert.equal(await js('return chatNoticeFixture.maxInflight'), 1, 'no overlapping notification requests');
    await js('chatNoticeFixture.delay=0;Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});window.dispatchEvent(new Event("focus"));');
    const before = await js('return chatNoticeFixture.calls');
    await new Promise((done) => setTimeout(done, 600));
    assert.equal(await js('return chatNoticeFixture.calls'), before, 'hidden document pauses polling');
    await js('delete document.visibilityState;chatNoticeFixture.counts=[1,0,0];document.dispatchEvent(new Event("visibilitychange"))');
    await until(`return document.querySelector('${trigger}')?.getAttribute('aria-label') === 'Chat messages, 1 unread'`, 'visibility recovery');
    await click(trigger);
    // The actual offline property is controlled to test the reconnect branch.
    await js('Object.defineProperty(navigator,"onLine",{configurable:true,get:()=>false});window.dispatchEvent(new Event("offline"));');
    await until('return document.querySelector("[role=dialog]")?.textContent.includes("You are offline")', 'offline feedback');
    await js('delete navigator.onLine;window.dispatchEvent(new Event("online"))');
    await until('return !document.querySelector("[role=dialog]")?.textContent.includes("You are offline")', 'reconnect refresh');
    if (role === 'customer') {
      await js('chatNoticeFixture.delay=1200;window.dispatchEvent(new Event("focus"));chatNoticeFixture.account="30000000-0000-4000-8000-000000000099";chatNoticeFixture.counts=[0,0,0];const channel=new BroadcastChannel("aisley-customer-session");channel.postMessage("session-changed");setTimeout(()=>channel.close(),100)');
      await until(`return document.querySelector('${trigger}')?.getAttribute('aria-label') === 'Chat messages' && !document.querySelector('[role=dialog]')`, 'account switch clears old dropdown and badge');
      await new Promise((done) => setTimeout(done, 1400));
      assert.equal(await js(`return document.querySelector('${trigger}')?.getAttribute('aria-label')`), 'Chat messages', 'old account response stays discarded');
      await js('chatNoticeFixture.delay=0');
      await click(trigger);
      results.push({ role, state: 'account-switch' });
    }
    await js('chatNoticeFixture.delay=1200;window.dispatchEvent(new Event("focus"));window.dispatchEvent(new Event("aisley:chat-private-cleared"))');
    await until('return !document.querySelector("[role=dialog] li")', 'authorization clear removes private previews');
    await new Promise((done) => setTimeout(done, 1400));
    assert.equal(await js('return document.querySelector("[role=dialog] li")'), null, 'obsolete response cannot restore previews');
    await js('chatNoticeFixture.delay=0;chatNoticeFixture.error=403;window.dispatchEvent(new Event("focus"))');
    await until('return document.querySelector("[role=dialog]")?.textContent.includes("Chat is unavailable")', 'forbidden feedback');
    assert.equal(await js('return document.querySelector("[role=dialog] li")'), null);
    await js('chatNoticeFixture.error=401;window.dispatchEvent(new Event("focus"))');
    if (role === 'customer') {
      await until(`return !document.querySelector('button[aria-label^="Chat messages"]') && (location.pathname === '/login' || document.querySelector('a[aria-label="Chat messages"]'))`, 'expired session clears Customer control');
    } else {
      await until('return document.querySelector("[role=dialog]")?.textContent.includes("Your session expired")', 'expired session feedback');
    }
    results.push({ role, state: 'navigation/read/error/retry/empty/hidden/offline/reconnect/private-clear/403' });
  } finally { await command('DELETE', base); }
}
const suffix = process.env.CHAT_BROWSER_ROLES ? `-${process.env.CHAT_BROWSER_ROLES.replaceAll(",", "-")}` : "";
await writeFile(`${artifacts}/results${suffix}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ passed: results.length, artifacts }));
