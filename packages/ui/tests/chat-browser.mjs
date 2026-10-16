import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { openChatBrowser } from "./chat-browser-driver.mjs";
import { verifyMediaSend } from "./chat-media-checks.mjs";

const artifacts = resolve(process.env.CHAT_SCREENSHOTS ?? "node_modules/.cache/messages-ui/screenshots");
mkdirSync(artifacts, { recursive: true });
const browser = await openChatBrowser();
const checks = [];
const { evaluate: js, until, cdp } = browser;
const record = (name) => checks.push(name);
const pause = () => new Promise(yes => setTimeout(yes, 150));
async function mode(value) { await js(`window.setMode(${JSON.stringify(value)})`); await pause(); }
async function type(value) {
  await js(`document.querySelector('#fixture-message').focus()`);
  await cdp("Input.insertText", { text: value });
  await pause();
}
try {
  await browser.viewport(390);
  await browser.navigate(`file://${resolve("node_modules/.cache/messages-ui/fixture.html")}`);
  await until("Boolean(window.addChatFiles)", "media validation ready");
  assert.deepEqual(await js(`(() => {
    const results = [];
    for (const extension of ['png', 'mp4']) for (const size of [7999999, 8000000, 8000001]) {
      const key = 'boundary-' + extension + size;
      const error = window.addChatFiles(key, [new File([new Uint8Array(size)], 'edge.' + extension)], {channel:'shop'});
      results.push(Boolean(error)); window.chatExports.clearChatAttachments(key);
    }
    return results;
  })()`), [false, false, true, false, false, true]);
  record("image/video 8,000,000-byte inclusive client boundary");
  assert.deepEqual(await js(`(() => {
    const results = [];
    for (const extension of ['png', 'jpg', 'jpeg', 'mp4', 'webp', 'pdf', 'txt', 'csv', 'docx', 'gif', 'svg', 'mov']) {
      const key = 'format-' + extension;
      results.push(Boolean(window.addChatFiles(key, [new File(['test'], 'file.' + extension)], {channel:'shop'})));
      window.chatExports.clearChatAttachments(key);
    }
    return results;
  })()`), [false, false, false, false, true, true, true, true, true, true, true, true]);
  record("only PNG/JPG/JPEG/MP4 can be selected for a new upload");
  await until(`Boolean(document.querySelector('aside li button'))`, "inbox");
  assert.equal(await js(`window.compatibility.writeChatDraft === window.chatExports.writeChatDraft`), true);
  await js(`window.compatibility.writeChatDraft('fixture-state', 'saved draft')`);
  assert.equal(await js(`window.chatExports.readChatDraft('fixture-state')`), "saved draft");
  await js(`window.chatExports.clearChatPrivateState()`);
  assert.equal(await js(`window.compatibility.readChatDraft('fixture-state')`), "");
  record("compatibility facade preserves one private-state store and cleanup");
  for (const width of [320, 390, 768, 1440]) {
    await browser.viewport(width);
    await pause();
    assert.equal(await js(`document.documentElement.scrollWidth <= innerWidth + 1`), true, `${width}: inbox overflow`);
    await browser.screenshot(resolve(artifacts, `inbox-${width}.png`));
    await js(`document.querySelector('aside li button').click()`);
    await until(`Boolean(document.querySelector('#fixture-message'))`, "selected thread");
    await mode("long");
    assert.equal(await js(`document.documentElement.scrollWidth <= innerWidth + 1`), true, `${width}: thread overflow`);
    assert.equal(await js(`document.querySelector('form button[type=submit]').getBoundingClientRect().bottom <= innerHeight`), true, `${width}: send outside viewport`);
    assert.equal(await js(`document.querySelector('article').getBoundingClientRect().width < document.querySelector('section[aria-label=Conversation]').getBoundingClientRect().width`), true);
    await browser.screenshot(resolve(artifacts, `thread-${width}.png`));
    await mode("ready");
    await browser.screenshot(resolve(artifacts, `thread-normal-${width}.png`));
    if (width < 800) await js(`document.querySelector('section[aria-label=Conversation] > button').click()`);
    record(`${width}px inbox/thread/long text/visible send/no overflow`);
  }
  // A dark browser preference must never activate storefront dark utilities.
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  assert.equal(await js(`getComputedStyle(document.querySelector('aside').parentElement).backgroundColor`), "rgb(255, 255, 255)");
  await browser.screenshot(resolve(artifacts, "customer-os-dark.png"));
  record("Customer stays light under dark browser preference");
  await type("Desktop test");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await until(`window.checks.sends.length === 1`, "Enter sends");
  assert.equal(await js(`document.querySelector('#fixture-message').value`), "");
  await type("New line");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r", modifiers: 8 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r", modifiers: 8 });
  assert.equal(await js(`window.checks.sends.length`), 1);
  await pause();
  assert.equal(await js(`document.querySelector('#fixture-message').value.includes('\\n')`), true);
  record("desktop Enter sends / Shift+Enter keeps newline");
  await js(`document.querySelector('#fixture-message').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true}))`);
  assert.equal(await js(`window.checks.sends.length`), 1);
  record("IME composition does not send");
  for (const state of ["offline", "readonly", "sending", "uncertain", "senderror", "emptythread"]) {
    await mode(state);
    if (["offline", "readonly", "sending"].includes(state)) assert.equal(await js(`document.querySelector('form button[type=submit]').disabled`), true);
    if (state === "uncertain") assert.equal(await js(`document.querySelector('#fixture-message').disabled`), true);
    await browser.screenshot(resolve(artifacts, `${state}.png`));
    record(`${state} state`);
  }
  await mode("media");
  await js(`window.dispatchEvent(new Event("focus"))`);
  await until(`document.body.innerText.includes('Attach files')`, "media capabilities");
  await js(`document.querySelector('button[aria-label^="View image"]').focus(); document.querySelector('button[aria-label^="View image"]').click()`);
  await until(`document.querySelector('dialog').open`, "image viewer");
  await js(`document.querySelector('dialog img').dispatchEvent(new Event('error'))`);
  await until(`document.querySelector('dialog').innerText.includes('Image unavailable')`, "viewer image error");
  await js(`[...document.querySelectorAll('dialog button')].find(button => button.textContent === 'Retry').click()`);
  await pause();
  assert.equal(await js(`Boolean(document.querySelector('dialog img'))`), true, "viewer Retry renders the image again");
  await until(`document.querySelector('dialog img')?.complete && document.querySelector('dialog img')?.naturalWidth > 0`, "viewer image recovered");
  assert.equal(await js(`document.querySelector('dialog').innerText.includes('Image unavailable')`), false);
  record("failed viewer image Retry renders and decodes the image again");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await until(`!document.querySelector('dialog').open`, "viewer Escape");
  assert.equal(await js(`document.activeElement.getAttribute('aria-label')?.startsWith('View image')`), true);
  await browser.screenshot(resolve(artifacts, "media.png"));
  record("media capabilities/image viewer/Escape/focus restoration");
  checks.push(...await verifyMediaSend(browser, artifacts));
  await mode("ready");
  await browser.viewport(390, 500);
  await pause();
  assert.equal(await js(`document.querySelector('form button[type=submit]').getBoundingClientRect().bottom <= innerHeight`), true, "short viewport composer");
  await browser.screenshot(resolve(artifacts, "short-390x500.png"));
  record("390x500 short viewport Send visible");
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await browser.viewport(390);
  await pause();
  await js(`document.querySelector("#fixture-message").focus()`);
  const before = await js(`window.checks.sends.length`);
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  assert.equal(await js(`window.checks.sends.length`), before);
  record("touch Enter keeps a newline");
  await js(`document.querySelector('section[aria-label=Conversation] > button').click()`);
  for (const state of ["loading", "empty", "error"]) {
    await mode(state);
    await browser.screenshot(resolve(artifacts, `${state}-inbox.png`));
    record(`${state} inbox`);
  }
  await js(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Retry').click()`);
  await until(`document.body.innerText.includes('Maya Shop')`, "inbox retry");
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors));
  record("inbox retry / no runtime exceptions");
  writeFileSync(resolve(artifacts, "results.json"), JSON.stringify({ status: "passed", checks }, null, 2));
  console.log(JSON.stringify({ status: "passed", checks }));
} finally {
  browser.close();
}
