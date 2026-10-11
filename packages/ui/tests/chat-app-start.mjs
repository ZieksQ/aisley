import assert from "node:assert/strict";
import { resolve } from "node:path";

export async function verifyFirstSend(browser, origin, artifacts) {
  const { evaluate: js, until, cdp } = browser;
  const id = "20000000-0000-4000-8000-000000000001";
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  await browser.navigate(`${origin}/messages?shop=40000000-0000-4000-8000-000000000001`);
  await until(`Boolean(document.querySelector('#first-message'))`, "first-message composer");
  for (const [width, height] of [[320, 850], [390, 850], [768, 850], [1440, 850], [390, 500]]) {
    await browser.viewport(width, height);
    await new Promise(done => setTimeout(done, 200));
    assert.equal(await js(`document.documentElement.scrollWidth <= innerWidth + 1`), true);
    assert.equal(await js(`getComputedStyle(document.documentElement).colorScheme`), "light");
    assert.equal(await js(`document.querySelector('form button[type=submit]').getBoundingClientRect().bottom <= innerHeight`), true);
    await browser.screenshot(resolve(artifacts, `customer-start-${width}x${height}.png`));
  }
  await js(`document.querySelector('textarea').focus();window.chatAppFixture.loseResponse=true`);
  await cdp("Input.insertText", { text: "Synthetic first message" });
  await js(`document.querySelector('form button[type=submit]').click()`);
  await until(`document.querySelector('form button[type=submit]').textContent === 'Retry'`, "uncertain first send");
  assert.equal(await js(`document.querySelector('textarea').disabled`), true);
  await js(`document.querySelector('form button[type=submit]').click()`);
  await until(`location.pathname.endsWith('${id}') && Boolean(document.querySelector('textarea'))`, "committed thread navigation");
  assert.equal(await js(`window.chatAppFixture.sends.length`), 2);
  assert.equal(await js(`JSON.stringify(window.chatAppFixture.sends[0]) === JSON.stringify(window.chatAppFixture.sends[1])`), true);
  assert.equal(await js(`window.chatAppFixture.messages.filter(message => message.body === 'Synthetic first message').length`), 1);
  await js(`document.querySelector('section[aria-label=Conversation] > button').click()`);
  await until(`location.pathname === '/messages' && Boolean(document.querySelector('nav[aria-label="Message channels"]'))`, "Back to inbox");
  assert.deepEqual(await js(`[...document.querySelectorAll('nav[aria-label="Message channels"] a')].map(link=>[link.textContent,link.getAttribute('href')])`), [["Shops", "/messages"], ["Logistics", "/delivery-messages"], ["Couriers", "/courier-messages"]]);
  return ["Customer new conversation: five responsive light-only states", "uncertain first send retries exact payload/key once and navigates to committed thread", "Back restores inbox and channel links"];
}
