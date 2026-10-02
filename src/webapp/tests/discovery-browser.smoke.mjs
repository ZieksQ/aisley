// Start discovery-api.fixture.mjs, Next (API URL http://127.0.0.1:18080, port 15173), and chromedriver (19515).
// Run from src/webapp. Uses mock public HTTP reads, never seeded accounts or a database.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifacts = resolve('node_modules/.cache/discovery-browser');
await mkdir(artifacts, { recursive: true });
const origin = 'http://127.0.0.1:15173';
const fixture = 'http://127.0.0.1:18080';
const run = Date.now();
const keyword = `Canvas browser ${run}`;
async function configure(input) {
  await fetch(`${fixture}/__configure`, { method: 'POST', body: JSON.stringify(input) });
}
async function command(method, path, body) {
  const response = await fetch(`http://127.0.0.1:19515${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`);
  return payload.value;
}
const session = await command('POST', '/session', { capabilities: { alwaysMatch: {
  browserName: 'chrome', 'goog:chromeOptions': { args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=390,850', `--user-data-dir=${artifacts}/profile`] },
} } });
const path = `/session/${session.sessionId}`;
const js = (script, args = []) => command('POST', `${path}/execute/sync`, { script, args });
const cdp = (cmd, params = {}) => command('POST', `${path}/goog/cdp/execute`, { cmd, params });
const go = (route) => command('POST', `${path}/url`, { url: `${origin}${route}` });
async function element(selector) {
  const result = await command('POST', `${path}/element`, { using: 'css selector', value: selector });
  return `${path}/element/${result['element-6066-11e4-a52e-4f735466cecf']}`;
}
async function click(selector) { await command('POST', `${await element(selector)}/click`, {}); }
async function type(selector, text) {
  const input = await element(selector);
  await command('POST', `${input}/clear`, {});
  await command('POST', `${input}/value`, { text });
}
async function until(script, label, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await js(script)) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
const contains = (text) => `return document.body.innerText.includes(${JSON.stringify(text)})`;
const next = 'main nav[aria-label$="pages"] a:last-child';
const localSubmit = 'form[aria-label="Search in this Shop"] button[type=submit]';

async function checkWidths(label) {
  for (const width of [390, 768, 1280]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 1024 });
    assert.equal(await js('return document.documentElement.scrollWidth <= innerWidth + 2'), true, `${label} overflow at ${width}px`);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 850, deviceScaleFactor: 1, mobile: true });
}

try {
  await configure({ failure: null, delay: 0, reset: true });
  const html = await (await fetch(`${origin}/search?type=shops&q=Canvas`)).text();
  assert.match(html, /Canvas Shop 1-0/);
  assert.match(html, /noindex, follow/);
  assert.match(html, /rel="canonical"[^>]*\/search/);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 850, deviceScaleFactor: 1, mobile: true });
  await configure({ reset: true });
  await go('/search?type=shops');
  await until(contains('Enter a Shop name'), 'no-query prompt');
  assert.equal((await (await fetch(`${fixture}/__state`)).json()).requests.some((item) => item.path.endsWith('/search/shops') || item.path.endsWith('/products/search')), false, 'No-query page issued keyword search');
  await configure({ reset: true });
  await type('#marketplace-search-mobile', ` ${keyword} `);
  await click('form:has(#marketplace-search-mobile) button[type=submit]');
  await until(contains('Canvas Shop 1-0'), 'Shop search submit');
  assert.equal(await js('return new URLSearchParams(location.search).get("type")'), 'shops');
  let state = await (await fetch(`${fixture}/__state`)).json();
  assert.ok(state.requests.some((item) => item.path.endsWith('/search/shops') && item.query.q === keyword));
  assert.equal(state.requests.some((item) => item.path.endsWith('/products/search')), false);
  assert.equal(state.requests.filter((item) => item.path.endsWith('/search/shops')).some((item) => item.cookie || item.authorization), false);
  await checkWidths('Shop search');
  await click(next);
  await until(contains('Page 2 of 2'), 'Shop search pagination');
  await click('nav[aria-label="Search result type"] a:first-child');
  await until(contains('Canvas Shirt 0'), 'switch to Product mode');
  await checkWidths('Product search');
  assert.equal(await js('return new URLSearchParams(location.search).has("page")'), false);
  await command('POST', `${path}/back`, {});
  await until(contains('Page 2 of 2'), 'mode and page restored by back');
  await command('POST', `${path}/forward`, {});
  await until(contains('Canvas Shirt 0'), 'Product mode restored by forward');
  await command('POST', `${path}/refresh`, {});
  await until(contains('Canvas Shirt 0'), 'refresh preserves mode/query');

  await go('/shops/canvas?q=shirt&category=clothing&page=2');
  await until(contains('Page 2 of 2'), 'combined Shop filters');
  assert.equal(await js('return document.querySelector("#shop-product-search").value'), 'shirt');
  assert.equal(await js('return document.querySelector("#category-filter").value'), 'clothing');
  await click('main nav[aria-label$="pages"] a:first-child');
  await until(contains('Page 1 of 2'), 'Shop previous page');
  assert.equal(await js('return new URLSearchParams(location.search).get("q") === "shirt" && new URLSearchParams(location.search).get("category") === "clothing"'), true);
  await click(next);
  await until(contains('Page 2 of 2'), 'Shop next page retains both filters');
  await command('POST', `${path}/back`, {});
  await until(contains('Page 1 of 2'), 'Shop back restores page and filters');
  await command('POST', `${path}/forward`, {});
  await until(contains('Page 2 of 2'), 'Shop forward restores page and filters');
  await command('POST', `${path}/refresh`, {});
  await until(contains('Page 2 of 2'), 'Shop refresh retains both filters');
  await type('#shop-product-search', 'absent');
  await click(localSubmit);
  await until(contains('No products matched these Shop filters'), 'truthful Shop zero matches');
  assert.equal(await js('return location.pathname === "/shops/canvas" && !new URLSearchParams(location.search).has("page")'), true);
  assert.equal(await js('return document.querySelectorAll("#category-filter option").length'), 3, 'Category options disappeared on zero matches');
  assert.equal(await js('return document.activeElement.id'), 'shop-products-heading');
  await click('a[href="/shops/canvas?category=clothing"]');
  await until('return document.querySelector("#shop-product-search")?.value === "" && document.querySelector("#category-filter")?.value === "clothing"', 'clear keyword keeps category');
  await type('#shop-product-search', 'shirt');
  await click(localSubmit);
  await until('return new URLSearchParams(location.search).get("q") === "shirt"', 'restore keyword');
  await click('a[href="/shops/canvas?q=shirt"]');
  await until('return document.querySelector("#category-filter")?.value === "" && document.querySelector("#shop-product-search")?.value === "shirt"', 'clear category keeps keyword');
  await js('const select = document.querySelector("#category-filter"); select.value = "clothing"; select.dispatchEvent(new Event("change", { bubbles: true }));');
  await until('return new URLSearchParams(location.search).get("category") === "clothing"', 'category intersects keyword');
  await click('a[href="/shops/canvas"]');
  await until('return !location.search && document.querySelector("#shop-product-search")?.value === ""', 'clear both stays in Shop');
  assert.equal(await js('return [...document.querySelectorAll("p")].some(p => p.textContent === "Plain <script> text")'), true, 'Shop description executed as markup');
  for (const width of [390, 768, 1280]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width < 1024 });
    assert.equal(await js('return document.documentElement.scrollWidth <= innerWidth + 2'), true, `Overflow at ${width}px`);
    assert.equal(await js('return getComputedStyle(document.querySelector("#shop-product-search")).backgroundColor'), 'rgb(255, 255, 255)');
    assert.equal(await js(`return document.querySelector('${localSubmit}').getBoundingClientRect().height >= 44`), true);
  }
  await writeFile(`${artifacts}/shop-light.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'));
  await js('document.querySelector("#shop-product-search").focus()');
  assert.equal(await js('return document.activeElement.id'), 'shop-product-search');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  assert.equal(await js('return getComputedStyle(document.querySelector("#shop-product-search")).backgroundColor'), 'rgb(255, 255, 255)', 'Customer must stay light-only');
  await type('#shop-product-search', 'offline draft');
  await js('Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); window.dispatchEvent(new Event("offline"));');
  await click(localSubmit);
  await until(contains('You are offline'), 'offline submit preserves draft');
  assert.equal(await js('return document.querySelector("#shop-product-search").value'), 'offline draft');
  await js('Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); window.dispatchEvent(new Event("online"));');
  await configure({ delay: 1200 });
  await type('#shop-product-search', `keyboard-${run}`);
  await command('POST', `${await element('#shop-product-search')}/value`, { text: '\uE007' });
  await until('return document.querySelector(\'form[aria-label="Search in this Shop"] button\')?.disabled === true || Boolean(document.querySelector("main[aria-busy=true]"))', 'keyboard submit loading state');
  await until(`return new URLSearchParams(location.search).get('q') === 'keyboard-${run}' && document.querySelector('#shop-product-search')?.value === 'keyboard-${run}'`, 'keyboard submit result');
  await configure({ delay: 0 });

  await go('/shops?shop_category=clothing&page=3');
  await until(contains('No shops on this page'), 'directory beyond-last page is not an empty catalogue');
  await click('main nav[aria-label="Shop directory pages"] a');
  await until(contains('Canvas Shop 2-0'), 'directory previous page retains category');
  assert.equal(await js('return new URLSearchParams(location.search).get("shop_category")'), 'clothing');
  await go('/shops/missing');
  await until(contains('Shop not found'), 'unavailable Shop is not an empty success');

  for (const route of ['/search?type=invalid&q=Canvas', '/search?q=a&q=b', `/search?q=${'x'.repeat(101)}`, '/search?q=Canvas&page=0', '/shops/canvas?q=a&q=b', '/shops?shop_category=a&shop_category=b']) {
    await configure({ reset: true });
    await go(route);
    await until(contains('Check your search or filters'), `invalid URL ${route.slice(0, 50)}`);
    state = await (await fetch(`${fixture}/__state`)).json();
    assert.equal(state.requests.some((item) => ['/api/v1/customer/search/shops', '/api/v1/customer/products/search', '/api/v1/customer/shops/canvas/products', '/api/v1/customer/shops'].includes(item.path)), false);
  }
  await go('/search?type=shops&q=absent');
  await until(contains('No shops'), 'Shop search no match');
  for (const [status, message] of [[422, 'Fixture filter is invalid.'], [500, 'The service could not be reached.'], [429, 'Too many requests.']]) {
    await configure({ failure: status });
    await go(`/shops/canvas?q=error-${status}-${run}&category=clothing`);
    await until(contains(message), `HTTP ${status} feedback`);
    assert.equal(await js('return document.body.innerText.includes("No products matched")'), false);
    assert.equal(await js('return document.querySelector("#shop-product-search").value'), `error-${status}-${run}`);
    if (status === 429) {
      assert.equal(await js(`return document.querySelector('section[aria-label="Shop products feedback"] button').disabled`), true);
      await until(`return !document.querySelector('section[aria-label="Shop products feedback"] button').disabled`, 'Retry-After cooldown');
      await click('section[aria-label="Shop products feedback"] button');
      await until(`return document.querySelector('section[aria-label="Shop products feedback"] button').textContent.startsWith('Try again in')`, 'repeated 429 starts a fresh cooldown');
      await until(`return !document.querySelector('section[aria-label="Shop products feedback"] button').disabled`, 'repeated Retry-After cooldown');
    }
    if (status !== 422) {
      await configure({ failure: null });
      await click('section[aria-label="Shop products feedback"] button');
      await until(contains('Canvas Shirt 0'), 'retry restores filtered products');
    }
  }
  await configure({ failure: null, delay: 17000 });
  await go(`/search?type=shops&q=timeout-${run}`);
  await until(contains('The request timed out.'), 'bounded server deadline');
  await configure({ delay: 0 });
  await click('section[aria-label="Search feedback"] button');
  await until(contains('Canvas Shop 1-0'), 'timeout retry');
  console.log('Discovery browser smoke passed: SSR/privacy, modes, URL/back/forward/refresh, scoped filtering/clears, empty/malformed states, widths/light/focus, offline, 422/429/500 retry, and timeout.');
} finally {
  await configure({ failure: null, delay: 0 });
  await command('DELETE', path);
}
