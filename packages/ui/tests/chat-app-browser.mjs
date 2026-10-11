import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openChatBrowser } from "./chat-browser-driver.mjs";
import { installChatFixture } from "./chat-app-fixture.mjs";
import { verifyFirstSend } from "./chat-app-start.mjs";

const id = "20000000-0000-4000-8000-000000000001";
const origins = { customer: "http://127.0.0.1:15300", seller: "http://127.0.0.1:15174", logistics: "http://127.0.0.1:15176" };
const routes = {
  customer: ["/messages", `/messages/${id}`, `/delivery-messages?conversation=${id}`, `/courier-messages?conversation=${id}`],
  seller: ["/messages", `/messages/${id}`, `/logistics-messages?conversation=${id}`, `/courier-messages?conversation=${id}`],
  logistics: [`/messages?conversation=${id}`],
};
const artifacts = resolve(process.env.CHAT_SCREENSHOTS ?? "node_modules/.cache/messages-ui/app-screenshots");
mkdirSync(artifacts, { recursive: true });
const browser = await openChatBrowser();
const results = [];
const checks = [];
let injection;
try {
  for (const role of Object.keys(origins)) {
    if (process.env.CHAT_BROWSER_ROLES && !process.env.CHAT_BROWSER_ROLES.split(",").includes(role)) continue;
    if (injection) await browser.cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection });
    ({ identifier: injection } = await browser.cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(${installChatFixture.toString()})(${JSON.stringify(role)})` }));
    for (const [index, route] of routes[role].entries()) {
      await browser.viewport(390);
      await browser.navigate(`${origins[role]}${route}`);
      await browser.until(`Boolean(document.querySelector('aside[aria-label="Conversation inbox"]'))`, `${role} ${route} inbox`);
      if (index || role === "logistics") await browser.until(`Boolean(document.querySelector('textarea'))`, `${role} ${route} composer`);
      for (const width of [320, 390, 768, 1440]) {
        await browser.viewport(width);
        for (const dark of role === "customer" ? [false] : [false, true]) {
          await browser.evaluate(`document.documentElement.classList.toggle('dark', ${dark})`);
          if (role === "customer") await browser.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
          await new Promise(done => setTimeout(done, 200));
          assert.equal(await browser.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`), true, `${role} ${route} ${width}: overflow`);
          if (index || role === "logistics") assert.equal(await browser.evaluate(`document.querySelector('form button[type="submit"]').getBoundingClientRect().bottom <= innerHeight`), true, `${role} ${route} ${width}: offscreen send`);
          if (role === "customer") assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('aside').parentElement).backgroundColor`), "rgb(255, 255, 255)");
          await browser.screenshot(resolve(artifacts, `${role}-${index}-${width}-${dark ? "dark" : "light"}.png`));
          results.push({ role, route, width, dark });
        }
      }
      if (index || role === "logistics") {
        await browser.evaluate(`document.querySelector('textarea').focus()`);
        await browser.cdp("Input.insertText", { text: "Synthetic browser reply" });
        await browser.evaluate(`document.querySelector('form button[type=submit]').click()`);
        await browser.until(`window.chatAppFixture.sends.length > 0 && document.querySelector('textarea').value === ''`, "synthetic send");
      }
    }
    if (role === "customer") checks.push(...await verifyFirstSend(browser, origins.customer, artifacts));
  }
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors));
  writeFileSync(resolve(artifacts, "results.json"), JSON.stringify({ status: "passed", results, checks }, null, 2));
  console.log(JSON.stringify({ status: "passed", layouts: results.length, checks }));
} catch (error) {
  console.error(await browser.evaluate(`({url:location.href, text:document.body.innerText.slice(-2200)})`).catch(() => null));
  throw error;
} finally {
  browser.close();
}
