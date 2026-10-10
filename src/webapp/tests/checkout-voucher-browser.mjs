// Actual Checkout components, React/icons and built CSS; synthetic candidate/transport data.
// Run after a production webpack build; requires Chromium and sandbox socket access.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { compileCheckoutModule, voucherFixture } from "./checkout-voucher.fixture.mjs";

const require = createRequire(import.meta.url);
const app = resolve(dirname(new URL(import.meta.url).pathname), "..");
const artifacts = resolve(app, "node_modules/.cache/checkout-voucher-browser");
const temporaryDirectory = resolve(app, "../../.next/b6");
mkdirSync(artifacts, { recursive: true });
mkdirSync(temporaryDirectory, { recursive: true });
function productionModule(packageName, file) {
  const dependencyRequire = createRequire(require.resolve("react-dom/client"));
  return readFileSync(resolve(dirname(dependencyRequire.resolve(`${packageName}/package.json`)), "cjs", file), "utf8");
}
const icons = dirname(require.resolve("react-icons/fi"));
const modules = {
  react: productionModule("react", "react.production.js"),
  "react/jsx-runtime": productionModule("react", "react-jsx-runtime.production.js"),
  "react-dom": productionModule("react-dom", "react-dom.production.js"),
  "react-dom/client": productionModule("react-dom", "react-dom-client.production.js"),
  scheduler: productionModule("scheduler", "scheduler.production.js"),
  group: compileCheckoutModule("shop-checkout-group"),
  summary: compileCheckoutModule("checkout-summary"),
  display: compileCheckoutModule("checkout-display"),
  "./shipping-provider-selector": compileCheckoutModule("shipping-provider-selector"),
  "react-icons/fi": readFileSync(resolve(icons, "index.js"), "utf8"),
  "../lib": readFileSync(resolve(icons, "../lib/index.js"), "utf8"),
  "./iconsManifest": readFileSync(resolve(icons, "../lib/iconsManifest.js"), "utf8"),
  "./iconBase": readFileSync(resolve(icons, "../lib/iconBase.js"), "utf8"),
  "./iconContext": readFileSync(resolve(icons, "../lib/iconContext.js"), "utf8"),
  "next/link": 'exports.default = props => require("react").createElement("a", props, props.children);',
};
const script = `
const process={env:{NODE_ENV:"production"}};
const sources=${JSON.stringify(modules)};
const cache={};
function require(name) { if(cache[name]) return cache[name].exports; const module={exports:{}}; cache[name]=module; new Function("require","module","exports",sources[name])(require,module,module.exports); return module.exports; }
const React=require("react");
const root=require("react-dom/client").createRoot(document.getElementById("root"));
window.requests=[];
window.renderState=(state="ready")=>{
  const props=${JSON.stringify(voucherFixture())};
  if(state==="empty")props.group.availableVouchers=[];
  if(state==="loading")props.shippingOptions=undefined;
  props.disabled=state==="placing";
  props.voucherReasons=require("display").voucherReasons;
  props.formatAmount=require("display").amount;
  props.onToggleVoucher=(voucher)=>{window.requests.push(voucher.id);};
  props.onSelectProvider=()=>{};
  root.render(React.createElement("main",{style:{padding:16,maxWidth:700,margin:"auto"}},
    React.createElement(require("group").ShopCheckoutGroup,props),
    React.createElement(require("summary").CheckoutSummary,{
      quote:{summary:{...props.group.totals,orderCount:1}},status:state==="error"?"error":state==="placing"?"placing":"ready",
      message:state==="error"?"This Shop shipping voucher cannot fund its full saving. Remove it or choose another voucher.":null,
      onPlaceOrder:()=>{},formatAmount:props.formatAmount,
    })));
};
window.renderState();
`;
const css = readdirSync(resolve(app, ".next/static/css"))
  .filter(file => file.endsWith(".css"))
  .map(file => readFileSync(resolve(app, ".next/static/css", file), "utf8"))
  .join("\n");
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`;
const browser = spawn(process.env.CHROMIUM_BINARY ?? "/usr/bin/chromium", [
  "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--disable-breakpad", "--disable-crash-reporter", "--remote-debugging-pipe",
  `--user-data-dir=${artifacts}/profile`, `--crash-dumps-dir=${artifacts}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], env: { ...process.env, TMPDIR: temporaryDirectory } });
let nextId = 0;
let buffer = "";
let diagnostics = "";
const pending = new Map();
browser.stderr.on("data", data => { diagnostics += data.toString(); });
for (const pipe of [browser.stdio[3], browser.stdio[4]]) pipe.on("error", error => { diagnostics += error.message; });
browser.on("exit", code => {
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(new Error(`Chromium exited ${code}: ${diagnostics.slice(-1200)}`));
  }
  pending.clear();
});
browser.stdio[4].on("data", data => {
  buffer += data.toString();
  let end;
  while ((end = buffer.indexOf("\0")) !== -1) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id); clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}; ${diagnostics.slice(-500)}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0");
  });
}
try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const command = (method, params) => send(method, params, sessionId);
  await command("Page.enable");
  await command("Page.bringToFront");
  async function evaluate(expression) {
    const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 40; i++) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Condition failed: ${expression}`);
  }
  async function key(key) {
    const windowsVirtualKeyCode = key === "Enter" ? 13 : 9;
    await command("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode, ...(key === "Enter" ? { text: "\r" } : {}) });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode });
  }
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 900]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await command("Page.navigate", { url: "about:blank" });
    await until('document.readyState === "complete" && !document.querySelector("#root")');
    const { frameTree } = await command("Page.getFrameTree");
    await command("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
    await until('document.querySelector("summary")');
    await evaluate('document.querySelector("summary").focus()');
    await key("Enter");
    await until('document.querySelector("details").open');
    assert.equal(await evaluate('document.querySelector("details button").disabled'), true);
    assert.match(await evaluate('document.querySelector("details").textContent'), /Choose another voucher/);
    await key("Tab");
    assert.match(await evaluate('document.activeElement.textContent'), /Funded shipping/);
    await key("Enter");
    await until('window.requests.length === 1');
    assert.deepEqual(await evaluate('window.requests'), ["funded"]);
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    const screenshot = await command("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${artifacts}/${width}x${height}.png`, Buffer.from(screenshot.data, "base64"));
    await evaluate('window.renderState("placing")');
    await until('document.querySelectorAll("details button:disabled").length === 2');
    await evaluate('document.querySelector("details button").click()');
    assert.deepEqual(await evaluate('window.requests'), ["funded"]);
    await evaluate('window.renderState("loading")');
    await until('document.body.textContent.includes("Loading shipping options")');
    await evaluate('window.renderState("empty")');
    await until('!document.querySelector("details")');
    await evaluate('window.renderState("error")');
    await until('document.querySelector("[role=alert]")');
    assert.match(await evaluate('document.querySelector("[role=alert]").textContent'), /Remove it or choose another voucher/);
    assert.equal(await evaluate('document.querySelector("aside button").disabled'), true);
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    console.log(`${width}x${height}: funded/unfunded, focus/keyboard, pending, loading, empty and error passed`);
  }
  console.log(`Screenshots: ${artifacts}`);
} finally {
  browser.kill();
  for (const request of pending.values()) clearTimeout(request.timeout);
}
