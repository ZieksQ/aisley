import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installChatFixture } from './chat-app-fixture.mjs';
import { openChatBrowser } from './chat-browser-driver.mjs';

const browser = await openChatBrowser();
const artifacts = resolve('node_modules/.cache/messages-ui/unified');
mkdirSync(artifacts, { recursive: true });
const origins = { customer: 'http://127.0.0.1:15300', seller: 'http://127.0.0.1:15174', logistics: 'http://127.0.0.1:15176' };
let injection;
let checks = 0;
const click = (text) => browser.evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes(${JSON.stringify(text)}))?.click()`);
const rows = `document.querySelectorAll('aside[aria-label="Conversation inbox"] li').length`;
const refresh = () => click('Refresh');
try {
  for (const [role, origin] of Object.entries(origins)) {
    if (process.env.CHAT_BROWSER_ROLES && !process.env.CHAT_BROWSER_ROLES.split(',').includes(role)) continue;
    if (injection) await browser.cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection });
    ({ identifier: injection } = await browser.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(${installChatFixture.toString()})(${JSON.stringify(role)})` }));
    await browser.navigate(`${origin}/messages`);
    await browser.until(`${rows} === 3`, `${role} mixed rows`);
    const roles = role === 'customer' ? ['Seller', 'Logistics', 'Courier'] : role === 'seller' ? ['Customer', 'Logistics', 'Courier'] : ['Customer', 'Seller', 'Courier'];
    for (const label of roles) assert.equal(await browser.evaluate(`document.querySelector('aside[aria-label="Conversation inbox"]').textContent.includes(${JSON.stringify(label)})`), true);
    assert.equal(await browser.evaluate('window.chatAppFixture.reads'), 0, 'inbox browsing must not mark read');
    checks += 4;
    for (const width of [320, 390, 768, 1440]) {
      await browser.viewport(width);
      for (const dark of role === 'customer' ? [false] : [false, true]) {
        await browser.evaluate(`document.documentElement.classList.toggle('dark', ${dark})`);
        await new Promise(done => setTimeout(done, 200));
        assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, `${role}/${width} overflow`);
        await browser.screenshot(resolve(artifacts, `${role}-${width}-${dark ? 'dark' : 'light'}-inbox.png`));
        if (width === 1440) {
          const html = await browser.evaluate(`(() => { const root = document.documentElement.cloneNode(true); root.querySelectorAll('script,nextjs-portal').forEach(node => node.remove()); const base = document.createElement('base'); base.href = location.origin; root.querySelector('head').prepend(base); return '<!doctype html>' + root.outerHTML; })()`);
          writeFileSync(resolve(artifacts, `${role}-${dark ? 'dark' : 'light'}.html`), html);
        }
        checks++;
      }
    }
    await browser.viewport(390);
    await browser.evaluate(`document.querySelector('select[aria-label="Filter conversations by role"]').value = 'courier'; document.querySelector('select[aria-label="Filter conversations by role"]').dispatchEvent(new Event('change', {bubbles:true}))`);
    await browser.until(`${rows} === 1`, `${role} courier filter`);
    assert.equal(await browser.evaluate(`location.search.includes('role=courier')`), true);
    await browser.evaluate(`document.querySelector('aside li button').click()`);
    await browser.until(`Boolean(document.querySelector('textarea'))`, `${role} selected thread`);
    assert.equal(await browser.evaluate(`location.pathname === '/messages' && location.search.includes('conversation=')`), true);
    assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('aside[aria-label="Conversation inbox"]')).display === 'none'`), true);
    assert.equal(await browser.evaluate(`document.querySelector('form button[type="submit"]').getBoundingClientRect().bottom <= innerHeight`), true);
    await browser.screenshot(resolve(artifacts, `${role}-390-thread.png`));
    await click('← Inbox');
    await browser.until(`getComputedStyle(document.querySelector('aside[aria-label="Conversation inbox"]')).display !== 'none' && ${rows} === 1`, `${role} filtered back`);
    assert.equal(await browser.evaluate(`document.querySelector('select[aria-label="Filter conversations by role"]').value`), 'courier');
    checks += 5;
    await browser.evaluate(`document.querySelector('select[aria-label="Filter conversations by role"]').value = ''; document.querySelector('select[aria-label="Filter conversations by role"]').dispatchEvent(new Event('change', {bubbles:true}))`);
    await browser.until(`${rows} === 3`, `${role} all filter`);
    await browser.evaluate(`document.querySelector('aside[aria-label="Conversation inbox"] li button').click()`);
    const composer = role === 'customer' ? '#shop-chat-message' : role === 'seller' ? '#seller-chat-message' : '#operational-chat-message';
    await browser.until(`Boolean(document.querySelector(${JSON.stringify(composer)}))`, `${role} draft thread`);
    await new Promise(done => setTimeout(done, 250));
    await browser.evaluate(`document.querySelector('textarea').focus()`);
    await browser.cdp('Input.insertText', { text: `Draft for ${role}` });
    await browser.until(`document.querySelector('textarea')?.value === ${JSON.stringify(`Draft for ${role}`)}`, `${role} typed draft`);
    await click('← Inbox');
    await browser.until(`getComputedStyle(document.querySelector('aside[aria-label="Conversation inbox"]')).display !== 'none'`, `${role} draft back`);
    await browser.evaluate(`document.querySelector('aside[aria-label="Conversation inbox"] li button').click()`);
    await browser.until(`document.querySelector('textarea')?.value === ${JSON.stringify(`Draft for ${role}`)}`, `${role} restored draft`);
    await browser.evaluate(`window.chatAppFixture.loseResponse = true; document.querySelector('form button[type="submit"]').click()`);
    await browser.until(`document.querySelector('form button[type="submit"]')?.textContent === 'Retry'`, `${role} uncertain reply`);
    await browser.evaluate(`document.querySelector('form button[type="submit"]').click()`);
    await browser.until(`window.chatAppFixture.sends.length === 2 && document.querySelector('textarea')?.value === ''`, `${role} exact retry`);
    assert.equal(await browser.evaluate(`JSON.stringify(window.chatAppFixture.sends[0]) === JSON.stringify(window.chatAppFixture.sends[1])`), true);
    await click('← Inbox');
    await browser.until(`getComputedStyle(document.querySelector('aside[aria-label="Conversation inbox"]')).display !== 'none'`, `${role} sent back`);
    await browser.evaluate(`window.chatAppFixture.many = true`); await refresh();
    await browser.until(`${rows} === 20`, `${role} first page`);
    await click('Load older conversations');
    await browser.until(`${rows} === 25`, `${role} second page`);
    await browser.evaluate(`document.querySelector('aside[aria-label="Conversation inbox"] .marketplace-scroll').scrollTop = 600`);
    const scroll = await browser.evaluate(`document.querySelector('aside[aria-label="Conversation inbox"] .marketplace-scroll').scrollTop`);
    await browser.evaluate(`document.querySelectorAll('aside[aria-label="Conversation inbox"] li button')[21].click()`);
    await browser.until(`Boolean(document.querySelector('textarea'))`, `${role} older selection`);
    await click('← Inbox');
    await browser.until(`${rows} === 25 && getComputedStyle(document.querySelector('aside[aria-label="Conversation inbox"]')).display !== 'none'`, `${role} older back`);
    assert.equal(await browser.evaluate(`document.querySelector('aside[aria-label="Conversation inbox"] .marketplace-scroll').scrollTop`), scroll);
    await browser.evaluate(`window.chatAppFixture.many = false; document.querySelector('select[aria-label="Filter conversations by role"]').value = 'courier'; document.querySelector('select[aria-label="Filter conversations by role"]').dispatchEvent(new Event('change', {bubbles:true}))`);
    await browser.until(`${rows} === 1`, `${role} reset for errors`);
    checks += 7;
    await browser.evaluate(`window.chatAppFixture.error = true`); await refresh();
    await browser.until(`document.querySelector('[role="alert"]')?.textContent.includes('Messages could not be loaded')`, `${role} error`);
    assert.equal(await browser.evaluate(rows), 1);
    await browser.evaluate(`window.chatAppFixture.error = false; window.chatAppFixture.empty = true`); await click('Retry');
    await browser.until(`${rows} === 0 && document.querySelector('aside[aria-label="Conversation inbox"]').textContent.includes('No conversations yet')`, `${role} empty`);
    await browser.evaluate(`window.chatAppFixture.empty = false`); await refresh();
    await browser.until(`${rows} === 1`, `${role} recovery`);
    await browser.evaluate(`Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline'))`);
    await browser.until(`document.querySelector('[role="alert"]')?.textContent.includes('offline')`, `${role} offline`);
    await browser.evaluate(`delete navigator.onLine; window.dispatchEvent(new Event('online'))`);
    await browser.until(`!document.querySelector('[role="alert"]') && ${rows} === 1`, `${role} online recovery`);
    await browser.evaluate(`window.chatAppFixture.loading = true`);
    await refresh();
    await browser.evaluate(`document.querySelector('select[aria-label="Filter conversations by role"]').value = ${JSON.stringify(roles[0].toLowerCase())}; document.querySelector('select[aria-label="Filter conversations by role"]').dispatchEvent(new Event('change', {bubbles:true})); window.chatAppFixture.loading = false`);
    await browser.until(`${rows} === 1 && !document.querySelector('aside[aria-label="Conversation inbox"] li').textContent.includes('Courier')`, `${role} filter race`);
    await new Promise(done => setTimeout(done, 1100));
    assert.equal(await browser.evaluate(`document.querySelector('aside[aria-label="Conversation inbox"] li').textContent.includes('Courier')`), false);
    checks += 3;
    await browser.evaluate(`window.chatAppFixture.deny = true`); await refresh();
    await browser.until(`${rows} === 0 && !document.querySelector('textarea')`, `${role} denied clearing`);
    checks += 4;
    if (role !== 'logistics') {
      for (const path of ['/courier-messages?conversation=20000000-0000-4000-8000-000000000003', '/messages/20000000-0000-4000-8000-000000000001']) {
        await browser.navigate(origin + path);
        await browser.until(`location.pathname === '/messages' && Boolean(document.querySelector('textarea'))`, `${role} legacy ${path}`);
        checks++;
      }
    }
  }
  console.log(JSON.stringify({ checks, artifacts }));
} catch (error) {
  console.error(await browser.evaluate(`({url:location.href, textarea:document.querySelector('textarea')?.value, body:document.body.innerText.slice(-1500), state:window.chatAppFixture})`));
  throw error;
} finally { await browser.close(); }
