// Run homepage-api.fixture.mjs (18081), Next with its API URL (15174), and chromedriver (19516).
// Checks only mocked HTTP/browser contracts, not real users, services or PostgreSQL.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifacts = resolve('node_modules/.cache/homepage-browser');
await mkdir(artifacts, { recursive: true });
const origin = 'http://127.0.0.1:15174';
const fixture = 'http://127.0.0.1:18081';
async function configure(input) {
  await fetch(`${fixture}/__configure`, { method: 'POST', body: JSON.stringify(input) });
}
async function fixtureState() { return (await fetch(`${fixture}/__state`)).json(); }
async function command(method, path, body) {
  const response = await fetch(`http://127.0.0.1:19516${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`);
  return payload.value;
}
const session = await command('POST', '/session', { capabilities: { alwaysMatch: {
  browserName: 'chrome', 'goog:loggingPrefs': { browser: 'ALL' },
  'goog:chromeOptions': { args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=390,850', `--user-data-dir=${artifacts}/profile`] },
} } });
const path = `/session/${session.sessionId}`;
const js = (script, args = []) => command('POST', `${path}/execute/sync`, { script, args });
const cdp = (cmd, params = {}) => command('POST', `${path}/goog/cdp/execute`, { cmd, params });
const go = (route) => command('POST', `${path}/url`, { url: `${origin}${route}` });
async function element(selector) {
  const result = await command('POST', `${path}/element`, { using: 'css selector', value: selector });
  return `${path}/element/${result['element-6066-11e4-a52e-4f735466cecf']}`;
}
const click = async (selector) => command('POST', `${await element(selector)}/click`, {});
async function until(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out: ${label}. Page: ${await js('return document.body.innerText.slice(0,1200)')}`);
}
const contains = (text) => () => js(`return document.body.innerText.includes(${JSON.stringify(text)})`);
const customerKey = (name) => `aisley:homepage-discovery:v3:${encodeURIComponent(`customer:customer-${name}`)}`;
const hasPrivate = (name) => js(`return document.body.innerText.includes('${name} product') || document.body.innerText.includes('${name} history')`);
async function settled(name) {
  await js('document.querySelector("#discover")?.scrollIntoView();');
  await until(contains(`${name} product 1`), `${name} scoped base and next page`);
  await until(() => js(`return Boolean(sessionStorage.getItem(${JSON.stringify(customerKey(name))}))`), `${name} scoped storage`);
}

try {
  await configure({ viewer: null, homeDelay: 0, pageDelay: 0, authDelay: 0, homeFailure: false, pageFailure: false, reset: true });
  await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp('Network.setExtraHTTPHeaders', { headers: { 'Cache-Control': 'no-cache' } });
  await go('/robots.txt');
  await js('sessionStorage.clear();');
  await command('POST', `${path}/cookie`, { cookie: { name: 'homepage_test_session', value: '1', path: '/', sameSite: 'Lax' } });
  const primary = await command('GET', `${path}/window`);
  const other = await command('POST', `${path}/window/new`, { type: 'tab' });
  await command('POST', `${path}/window`, { handle: other.handle });
  await go('/robots.txt');
  await command('POST', `${path}/window`, { handle: primary });
  async function signal(value = 'session-changed') {
    await command('POST', `${path}/window`, { handle: other.handle });
    await js('const channel = new BroadcastChannel("aisley-customer-session"); channel.postMessage(arguments[0]); setTimeout(() => channel.close(), 100);', [value]);
    await command('POST', `${path}/window`, { handle: primary });
  }

  await configure({ viewer: 'A', authDelay: 800, pageDelay: 7000 });
  const html = await (await fetch(origin, { headers: { 'Cache-Control': 'no-cache' } })).text();
  assert.match(html, /Guest product 0/);
  assert.doesNotMatch(html, /A history product|A@example\.test/);
  await go('/');
  await until(contains('A history product 0'), 'A personalized Homepage');
  await js('document.querySelector("#discover").scrollIntoView();');
  await until(async () => (await fixtureState()).requests.some((item) => item.path.endsWith('/recommendations') && item.owner === 'A' && !item.completed), 'A page in flight');
  for (const width of [390, 768, 1280]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 1024 });
    assert.equal(await js('return document.documentElement.scrollWidth <= innerWidth + 2'), true, `Homepage overflow at ${width}px`);
  }
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  assert.equal(await js('return getComputedStyle(document.querySelector("#categories a")).backgroundColor'), 'rgb(255, 255, 255)');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await click('button[aria-label="Account menu for A"]');
  await command('POST', `${await element('button[role="menuitem"]')}/value`, { text: '\uE007' });
  await until(() => js('return Boolean(document.querySelector(\'a[aria-label="Sign in"]\'))'), 'keyboard logout');
  assert.equal(await hasPrivate('A'), false);
  await until(async () => (await fixtureState()).requests.some((item) => item.path.endsWith('/recommendations') && item.owner === 'A' && item.completed), 'old page completed after logout');
  assert.equal(await hasPrivate('A'), false, 'Late page resurrected logged-out data');
  assert.equal(await js(`return sessionStorage.getItem(${JSON.stringify(customerKey('A'))})`), null);

  await configure({ viewer: 'A', homeDelay: 4000, pageDelay: 0, authDelay: 0, reset: true });
  await signal();
  await until(async () => (await fixtureState()).requests.some((item) => item.path.endsWith('/home') && item.owner === 'A' && !item.completed), 'A refresh in flight');
  await configure({ viewer: 'B', homeDelay: 0, authDelay: 700 });
  await signal();
  await until(() => js('return Boolean(document.querySelector(\'[aria-label="Checking account session"]\'))'), 'cross-tab identity invalidation');
  assert.equal(await hasPrivate('A'), false);
  await settled('B');
  await until(async () => (await fixtureState()).requests.some((item) => item.path.endsWith('/home') && item.owner === 'A' && item.completed), 'old A Homepage response completed');
  assert.equal(await hasPrivate('A'), false);
  assert.equal(await hasPrivate('B'), true);

  // A and B deliberately have the same base signature/cursor, so ID scoping is essential.
  await configure({ viewer: 'A', authDelay: 0 });
  await signal();
  await settled('A');
  assert.equal(await hasPrivate('B'), false);
  assert.equal(await js(`return sessionStorage.getItem(${JSON.stringify(customerKey('B'))})`), null);
  await command('POST', `${path}/refresh`, {});
  await settled('A');
  assert.equal(await js(`return JSON.parse(sessionStorage.getItem(${JSON.stringify(customerKey('A'))})).cursor`), null, 'Reload must preserve exhausted paging');

  await configure({ viewer: 'B', homeDelay: 1200, authDelay: 0, pageFailure: true });
  await signal();
  await until(() => js('return Boolean(document.querySelector(\'[aria-label="Loading products"]\')) || document.body.innerText.includes("Guest product 0")'), 'public/loading state while B refreshes');
  assert.equal(await hasPrivate('A'), false);
  await until(contains("We couldn't load the next products"), 'next-page error');
  assert.equal(await hasPrivate('A'), false);
  await configure({ pageFailure: false });
  await click('#discover > div:last-child button');
  await settled('B');
  await js('document.querySelector("#marketplace-search-desktop").focus();');
  assert.equal(await js('return document.activeElement.id'), 'marketplace-search-desktop');
  await writeFile(`${artifacts}/session-safe-homepage.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'));

  await configure({ viewer: null, homeDelay: 0, pageDelay: 0, authDelay: 0 });
  await signal('signed-out');
  await until(contains('Guest product 1'), 'cross-tab logout reloads public discovery');
  assert.equal(await hasPrivate('B'), false);
  assert.equal(await js('return Object.keys(sessionStorage).some(key => key.includes("customer%3A"))'), false);
  await js('Object.defineProperty(Storage.prototype, "getItem", { configurable: true, value() { throw new Error("blocked storage"); } }); Object.defineProperty(Storage.prototype, "setItem", { configurable: true, value() { throw new Error("blocked storage"); } });');
  await configure({ viewer: 'A' });
  await signal();
  await until(contains('A product 1'), 'blocked storage leaves fresh discovery usable');
  const errors = (await command('POST', `${path}/log`, { type: 'browser' })).filter((entry) => entry.level === 'SEVERE' && (entry.message.includes('Uncaught') || entry.message.includes('hydration')));
  assert.deepEqual(errors, [], 'Uncaught client/hydration error');
  console.log('Homepage browser passed: public SSR, 390/768/1280px/light/focus, keyboard logout, second-tab A/B/A and logout, late refresh/page rejection, same-signature scoped restoration, exhausted paging, loading/error/retry, and blocked storage.');
} finally {
  await configure({ viewer: null, homeDelay: 0, pageDelay: 0, authDelay: 0, homeFailure: false, pageFailure: false });
  await command('DELETE', path);
}
