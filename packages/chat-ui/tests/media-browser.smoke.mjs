// Connected browsers against an explicitly isolated API; source and build bytes stay unchanged.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const fixtureRoot = resolve('src/api/storage/framework/testing/chat-browser');
const fixture = JSON.parse(await readFile(`${fixtureRoot}/fixture.json`, 'utf8'));
const artifacts = resolve('node_modules/.cache/chat-media-browser');
await mkdir(artifacts, { recursive: true });
const driver = process.env.CHAT_BROWSER_DRIVER ?? 'http://127.0.0.1:19515';
const api = process.env.CHAT_BROWSER_API ?? 'http://localhost:18000';
const origins = { customer: 'http://localhost:15300', seller: 'http://localhost:15174', logistics: 'http://localhost:15176' };
const results = [];

async function command(method, path, body) {
  const response = await fetch(`${driver}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) throw new Error(`${path}: ${payload.value?.message ?? response.status}`);
  return payload.value;
}

// Route browser API/media traffic to the test API, including same-origin Vite proxy URLs.
// Only explicit failure flags below simulate responses. Normal uploads/messages/bytes are real HTTP.
function isolatedApi(api) {
  const destination = (value) => {
    const parsed = new URL(value, location.origin);
    return parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/sanctum/') ? api + parsed.pathname + parsed.search : value;
  };
  const original = window.fetch.bind(window);
  const state = window.mediaSmoke = { loseSend: false, keys: [], sends: [], failStatus: false, unavailable: false };
  window.fetch = async (input, options = {}) => {
    const url = destination(input instanceof Request ? input.url : String(input));
    const pathname = new URL(url, location.origin).pathname;
    if (state.unavailable && pathname.endsWith('/chat-attachments')) return new Response(JSON.stringify({ data: { enabled: false } }), { headers: { 'Content-Type': 'application/json' } });
    if (state.failStatus && /chat-attachments\/[\w-]+$/.test(pathname) && !options.method) {
      state.failStatus = false;
      return new Response(JSON.stringify({ message: 'Temporary fixture outage' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    const sending = options.method === 'POST' && pathname.endsWith('/messages');
    if (sending) { state.keys.push(new Headers(options.headers).get('Idempotency-Key')); state.sends.push(JSON.parse(options.body)); }
    const response = await original(input instanceof Request ? new Request(url, input) : url, options);
    if (sending && state.loseSend && response.ok) { state.loseSend = false; throw new TypeError('Fixture loses a response after the real commit'); }
    return response;
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { return open.call(this, method, destination(String(url)), ...rest); };
  for (const [prototype, names] of [[HTMLImageElement.prototype, ['src']], [HTMLMediaElement.prototype, ['src']], [HTMLVideoElement.prototype, ['poster']], [HTMLAnchorElement.prototype, ['href']]]) {
    for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (descriptor?.set) Object.defineProperty(prototype, name, { ...descriptor, set(value) { descriptor.set.call(this, destination(String(value))); } });
    }
  }
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) { return setAttribute.call(this, name, ['src', 'poster', 'href'].includes(name) ? destination(String(value)) : value); };
}

async function run(role, surfaces) {
  if (process.env.CHAT_BROWSER_ROLES && !process.env.CHAT_BROWSER_ROLES.split(',').includes(role)) return;
  const session = await command('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'chrome', 'goog:chromeOptions': { binary: '/usr/bin/chromium', args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=390,850'] } } } });
  const path = `/session/${session.sessionId}`;
  const js = (script, args = []) => command('POST', `${path}/execute/sync`, { script, args });
  const asyncJs = (script, args = []) => command('POST', `${path}/execute/async`, { script, args });
  const cdp = (cmd, params = {}) => command('POST', `${path}/goog/cdp/execute`, { cmd, params });
  const go = (route) => command('POST', `${path}/url`, { url: `${origins[role]}${route}` });
  async function until(script, label, timeout = 30000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await js(script)) return; await new Promise((done) => setTimeout(done, 200)); }
    throw new Error(`${role}: ${label}: ${await js('return document.body.innerText.slice(-1800)')}`);
  }
  async function click(selector) {
    const element = await command('POST', `${path}/element`, { using: 'css selector', value: selector });
    await command('POST', `${path}/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {});
  }
  async function files(names) {
    const input = await command('POST', `${path}/element`, { using: 'css selector', value: 'input[aria-label="Choose chat attachments"]' });
    await command('POST', `${path}/element/${input['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: names.map((name) => `${fixtureRoot}/${name}`).join('\n') });
  }
  try {
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${isolatedApi.toString()})(${JSON.stringify(api)});` });
    await go('/login');
    await new Promise((done) => setTimeout(done, 1500));
    const login = await asyncJs(`const done=arguments[arguments.length-1]; (async()=>{await fetch(arguments[0]+'/sanctum/csrf-cookie',{credentials:'include'}); const token=decodeURIComponent(document.cookie.split('; ').find(x=>x.startsWith('XSRF-TOKEN='))?.split('=').slice(1).join('=')??''); const response=await fetch(arguments[0]+'/api/v1/'+arguments[1]+'/auth/login',{method:'POST',credentials:'include',headers:{'Accept':'application/json','Content-Type':'application/json','X-Requested-With':'XMLHttpRequest','X-XSRF-TOKEN':token},body:JSON.stringify({email:'chat-'+arguments[1]+'@example.test',password:'Chat-browser-password-123!'})});done({status:response.status,body:await response.json()});})().catch(e=>done({error:String(e)}));`, [api, role]);
    assert.equal(login.status, 200, JSON.stringify({ status: login.status, message: login.body?.message, error: login.error }));
    for (const [name, route, media] of surfaces) {
      await go(route);
      await until('return document.querySelector("input[type=file]") && !document.querySelector("form textarea")?.disabled', `${name} composer/capability`);
      for (const width of [390, 768, 1280]) {
        await cdp('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: width === 390 });
        for (const dark of role === 'customer' ? [false] : [false, true]) {
          await js(`document.documentElement.classList.toggle('dark',arguments[0]);`, [dark]);
          await new Promise((done) => setTimeout(done, 150));
          const layout = await js(`const form=document.querySelector('form:has(textarea)'); const attach=[...form.querySelectorAll('button')].find(b=>b.innerText==='Attach files'); attach.focus(); return {overflow:document.documentElement.scrollWidth>innerWidth+2, focused:document.activeElement===attach, width:form.getBoundingClientRect().width, attachHeight:attach.getBoundingClientRect().height};`);
          assert.equal(layout.overflow, false, `${name} ${width} page overflow`);
          assert.equal(layout.focused, true, `${name} keyboard attachment control`);
          assert.ok(layout.attachHeight >= 40 && layout.width <= width, `${name} usable controls`);
          if (width !== 768) await writeFile(`${artifacts}/${name}-${width}-${dark ? 'dark' : 'light'}.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'));
          results.push({ surface: name, width, theme: dark ? 'dark' : 'light', layout: 'passed' });
        }
      }
      if (name === 'customer-shop') await js('mediaSmoke.failStatus=true');
      await files(media);
      await until('return !!document.querySelector("ul[aria-label*=Selected]")', 'selection loading');
      assert.equal(await js('return document.querySelector("form:has(textarea) button[type=submit]").disabled'), true, 'checking blocks Send');
      if (name === 'customer-shop') {
        await until('return document.body.innerText.includes("Retry file")', 'recoverable checking outage');
        await js(`[...document.querySelectorAll('ul[aria-label*=Selected] button')].find(button=>button.innerText==='Retry file').click()`);
      }
      await until('return document.querySelector("ul[aria-label*=Selected]") && !document.querySelector("form:has(textarea) button[type=submit]").disabled', `${name} ready real scan`);
      assert.equal(await js('return document.querySelector("form textarea").value'), '', `${name} attachment only`);
      await click('form:has(textarea) button[type=submit]');
      await until('return !document.querySelector("ul[aria-label*=Selected]") && !!document.querySelector("ul[aria-label*=Message]")', `${name} send confirmed`);
      await writeFile(`${artifacts}/${name}-media.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'));
      if (media.includes('photo.png')) {
        await until('return [...document.querySelectorAll("ul[aria-label*=Message] img")].some(i=>i.complete&&i.naturalWidth>0)', 'private thumbnail');
        await click('button[aria-label^="View image:"]');
        await until('return document.querySelector("dialog[open] img")?.naturalWidth>0', 'private full image');
        assert.equal(await js('return document.activeElement?.innerText'), 'Close');
        await writeFile(`${artifacts}/${name}-viewer.png`, Buffer.from(await command('GET', `${path}/screenshot`), 'base64'));
        const active = await command('GET', `${path}/element/active`);
        await command('POST', `${path}/element/${active['element-6066-11e4-a52e-4f735466cecf']}/value`, { text: '\uE00C' });
        await until('return !document.querySelector("dialog[open]")', 'Escape closes image');
      }
      if (media.includes('clip.mp4')) {
        const video = await js('const v=document.querySelector("video"); return {controls:v.controls,autoplay:v.autoplay,preload:v.preload,src:v.src};');
        assert.ok(video.controls && !video.autoplay && video.preload === 'none');
        const range = await asyncJs(`const done=arguments[arguments.length-1];fetch(arguments[0],{credentials:'include',headers:{Range:'bytes=0-31'}}).then(async r=>done({status:r.status,bytes:(await r.arrayBuffer()).byteLength})).catch(e=>done({error:String(e)}));`, [video.src]);
        assert.deepEqual(range, { status: 206, bytes: 32 });
      }
      // Files rejected by content checks remain removable; text is safely retained.
      await js(`const input=document.querySelector('input[aria-label="Choose chat attachments"]');const transfer=new DataTransfer();transfer.items.add(new File(['not an image'],'spoof.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));`);
      await until('return document.body.innerText.includes("Remove it and choose another file")', `${name} rejected state`);
      assert.equal(await js('return document.querySelector("form:has(textarea) button[type=submit]").disabled'), true);
      await click('button[aria-label="Remove spoof.png"]');
      await until('return !document.querySelector("ul[aria-label*=Selected]")', 'remove rejected file');
      results.push({ surface: name, upload: 'real scanner + dedicated worker', send: 'attachment-only confirmed', rejected: 'blocked and removable' });
    }
    // One connected exact retry with a deliberately lost successful response.
    await files(['details.pdf']);
    await until('return !document.querySelector("form:has(textarea) button[type=submit]").disabled', 'ready PDF');
    await js('mediaSmoke.loseSend=true');
    await click('form:has(textarea) button[type=submit]');
    await until('return document.querySelector("form:has(textarea) button[type=submit]").innerText==="Retry"', 'uncertain send');
    assert.equal(await js('return document.querySelector("button[aria-label*=details]").disabled'), true);
    await click('form:has(textarea) button[type=submit]');
    await until('return !document.querySelector("ul[aria-label*=Selected]")', 'exact retry confirms');
    const attempts = await js('return {keys:mediaSmoke.keys.slice(-2),sends:mediaSmoke.sends.slice(-2)}');
    assert.equal(attempts.keys[0], attempts.keys[1]);
    assert.deepEqual(attempts.sends[0], attempts.sends[1]);
    await js('Object.defineProperty(navigator,"onLine",{configurable:true,value:false});window.dispatchEvent(new Event("offline"))');
    await until('return document.body.innerText.includes("You are offline")', 'offline feedback');
    assert.equal(await js('return [...document.querySelectorAll("form button")].find(b=>b.innerText==="Attach files").disabled'), true);
    await js('Object.defineProperty(navigator,"onLine",{configurable:true,value:true});window.dispatchEvent(new Event("online"))');
    await js('mediaSmoke.unavailable=true;window.dispatchEvent(new Event("focus"))');
    await until('return !document.querySelector("input[type=file]")', 'runtime disabled');
    results.push({ role, exactRetry: 'same IDs/body/key; one real commit', offline: 'disabled', runtimeDisabled: 'attachment control hidden' });
  } finally { await command('DELETE', path); }
}

await run('customer', [
  ['customer-shop', `/messages/${fixture.shop_thread}`, ['photo.png', 'details.pdf']],
  ['customer-logistics', `/delivery-messages?conversation=${fixture.customer_logistics}`, ['details.pdf']],
  ['customer-courier', `/courier-messages?conversation=${fixture.customer_courier}`, ['details.pdf']],
]);
await run('seller', [
  ['seller-customer', `/messages/${fixture.shop_thread}`, ['clip.mp4']],
  ['seller-logistics', `/logistics-messages?pickup_request_id=${fixture.pickup_id}`, ['details.pdf']],
  ['seller-courier', `/courier-messages?conversation=${fixture.seller_courier}`, ['details.pdf']],
]);
await run('logistics', [
  ['logistics-operational', `/messages?leg=final_mile&task_id=${fixture.task_id}`, ['photo.png']],
]);
// Courier authenticated private transport and recipient history use the external-mobile bearer contract.
const courierHeaders = { Authorization: `Bearer ${fixture.courier_token}`, Accept: 'application/json' };
const history = await fetch(`${api}/api/v1/courier/operational-conversations/${fixture.customer_courier}/messages`, { headers: courierHeaders });
assert.equal(history.status, 200);
const messages = (await history.json()).data;
const asset = messages.flatMap((message) => message.attachments).find((item) => item.kind === 'document');
assert.ok(asset && asset.content_url.startsWith('/api/v1/courier/'));
const bytes = await fetch(api + asset.content_url, { headers: courierHeaders });
assert.equal(bytes.status, 200);
assert.ok(bytes.headers.get('content-disposition').startsWith('attachment;'));
assert.ok((await bytes.arrayBuffer()).byteLength > 0);
const denied = await fetch(api + asset.content_url, { headers: { Accept: 'application/json' } });
assert.equal(denied.status, 401);
results.push({ courier: 'scoped bearer history + private document, unauthenticated denied' });
await writeFile(`${artifacts}/results.json`, JSON.stringify(results, null, 2));
console.log(`Passed ${results.filter((row) => row.width).length} responsive/theme states across ${new Set(results.filter((row) => row.surface).map((row) => row.surface)).size} chat surfaces, real media exchange, retries and scoped Courier reads.`);
