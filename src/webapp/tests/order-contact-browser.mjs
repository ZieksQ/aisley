// Requires Chromium and a production webpack build. Uses synthetic transport;
// exercises the actual React correction components, shared Button and built CSS.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const app = resolve(dirname(new URL(import.meta.url).pathname), "..");
const artifacts = resolve(app, "node_modules/.cache/order-contact-browser");
mkdirSync(artifacts, { recursive: true });
// Unix-domain socket paths need a short temporary directory inside the repo.
const temporaryDirectory = resolve(app, "../../.next/b2");
mkdirSync(temporaryDirectory, { recursive: true });
function compile(path) {
  return ts.transpileModule(readFileSync(resolve(app, path), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
}
function productionModule(packageName, file) {
  const dependencyRequire = createRequire(require.resolve("react-dom/client"));
  return readFileSync(resolve(dirname(dependencyRequire.resolve(`${packageName}/package.json`)), "cjs", file), "utf8");
}
const modules = {
  react: productionModule("react", "react.production.js"),
  "react/jsx-runtime": productionModule("react", "react-jsx-runtime.production.js"),
  "react-dom": productionModule("react-dom", "react-dom.production.js"),
  "react-dom/client": productionModule("react-dom", "react-dom-client.production.js"),
  scheduler: productionModule("scheduler", "scheduler.production.js"),
  "@aisley/ui": compile("../../packages/ui/src/button.tsx"),
  "@/lib/orders/address-correction": compile("src/lib/orders/address-correction.ts"),
  "./order-contact-dialog": compile("src/components/orders/order-contact-dialog.tsx"),
  correction: compile("src/components/orders/order-contact-correction.tsx"),
  "next/link": 'exports.default = props => require("react").createElement("a", props, props.children);',
  "@/lib/api": 'exports.ApiError = class ApiError extends Error { constructor(status, code) { super(code); this.status=status; this.code=code; this.errors={address_id:[code]}; } };',
  "@/lib/checkout/client": 'exports.fetchAddresses = () => window.addresses();',
  "@/lib/orders/client": 'exports.orderMutationKey = () => "original-key"; exports.fetchOrder = async () => window.order; exports.modifyOrderAddress = (...args) => window.submitCorrection(...args);',
};
const script = `
const process={env:{NODE_ENV:"production"}};
const sources=${JSON.stringify(modules)};
const cache={};
function require(name) { if(cache[name]) return cache[name].exports; const module={exports:{}}; cache[name]=module; new Function("require","module","exports",sources[name])(require,module,module.exports); return module.exports; }
const React=require("react");
const {OrderContactCorrection}=require("correction");
const current={version:1,recipientName:"Ada Buyer",contactNumber:"09171234567",addressLine1:"123 Test Street",addressLine2:null,barangay:"San Antonio",cityMunicipality:"Makati City",province:"Metro Manila",region:"NCR",postalCode:"1203",country:"Philippines",latitude:null,longitude:null};
window.order={id:"order",reference:"ASL-TEST",deliveryAddress:current};
window.mode="ready";window.requests=[];
window.addresses=async()=>window.mode==="loading"?new Promise(resolve=>window.resolveAddresses=resolve):window.mode==="empty"?[]:window.mode==="error"?Promise.reject(new Error("offline")):[{...current,id:"address",label:"Home",type:"shipping",recipientName:"CorrectedRecipient".repeat(12)},{...current,id:"elsewhere",label:"Other",type:"shipping",recipientName:"Different",postalCode:"9999"}];
window.submitCorrection=async(...args)=>{window.requests.push(args);if(window.mode==="pending")await new Promise(resolve=>window.finish=resolve);if(window.mode==="invalid")throw new (require("@/lib/api").ApiError)(422,"ADDRESS_LOCATION_CHANGE_NOT_ALLOWED");if(window.mode==="uncertain")throw new Error("lost response");return {...window.order,deliveryAddress:{...current,version:2}};};
function App(){const[busy,setBusy]=React.useState(false);const[order,setOrder]=React.useState(window.order);const[success,setSuccess]=React.useState("");return React.createElement("main",{style:{padding:16}},React.createElement(OrderContactCorrection,{order,disabled:busy,onBusyChange:setBusy,onUpdated:setOrder,onSuccess:setSuccess}),React.createElement("p",{role:"status"},success));}
require("react-dom/client").createRoot(document.getElementById("root")).render(React.createElement(App));
`;
const css = readdirSync(resolve(app, ".next/static/css"))
  .filter(file => file.endsWith(".css")).map(file => readFileSync(resolve(app, ".next/static/css", file), "utf8")).join("\n");
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
  async function reset(mode = "ready") {
    await command("Page.navigate", { url: "about:blank" });
    await until('document.readyState === "complete" && !document.querySelector("#root")');
    const { frameTree } = await command("Page.getFrameTree");
    await command("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
    await until('document.querySelector("button")');
    await evaluate(`window.mode=${JSON.stringify(mode)};document.querySelector("button").focus();document.querySelector("button").click()`);
    await until('document.querySelector("[role=dialog]")');
  }
  const key = async (key, modifiers = 0) => {
    await command("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, modifiers });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, modifiers });
  };
  for (const [width, height] of [[390, 844], [768, 1024], [1280, 900], [390, 400]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await reset();
    await until('document.querySelector("input[type=radio]")');
    const layout = await evaluate(`(()=>{const d=document.querySelector('[role=dialog]'),r=d.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:document.documentElement.scrollWidth>innerWidth,dialogOverflow:d.scrollWidth>d.clientWidth,radios:d.querySelectorAll('input[type=radio]').length};})()`);
    const shot = await command("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${artifacts}/${width}x${height}.png`, Buffer.from(shot.data, "base64"));
    console.log(`${width}x${height}: ${JSON.stringify(layout)}`);
    assert.equal(layout.overflow, false); assert.equal(layout.dialogOverflow, false);
    assert.equal(layout.radios, 1); assert.ok(layout.left >= 0 && layout.right <= width);
    assert.ok(layout.top >= 0 && layout.bottom <= height);
    await key("Tab"); assert.equal(await evaluate('document.activeElement.type'), "radio");
    await key("Tab", 8); assert.equal(await evaluate('document.activeElement.textContent'), "Confirm contact correction");
    await key("Tab"); assert.equal(await evaluate('document.activeElement.type'), "radio");
    await key("Escape"); await until('!document.querySelector("[role=dialog]")');
    assert.equal(await evaluate('document.activeElement.textContent'), "Correct delivery contact");
  }
  for (const mode of ["empty", "error", "loading"]) {
    await reset(mode);
    const expected = mode === "empty" ? "No saved contact corrections" : mode === "error" ? "We could not load" : "Loading saved addresses";
    await until(`document.body.textContent.includes(${JSON.stringify(expected)})`);
    assert.equal(await evaluate('document.querySelector("[role=dialog] button:last-child").disabled'), true);
    await key("Escape"); await until('!document.querySelector("[role=dialog]")');
  }
  await reset("invalid");
  await until('document.querySelector("input[type=radio]")');
  await evaluate('document.querySelector("[role=dialog] button:last-child").click()');
  await until('document.body.textContent.includes("ADDRESS_LOCATION_CHANGE_NOT_ALLOWED")');
  assert.equal(await evaluate('document.querySelector("input[type=radio]").checked'), true);
  await key("Escape"); await until('!document.querySelector("[role=dialog]")');
  await reset("pending");
  await until('document.querySelector("input[type=radio]")');
  await evaluate('document.querySelector("[role=dialog] button:last-child").click()');
  await until('document.body.textContent.includes("Updating…")');
  await key("Escape"); assert.equal(await evaluate('!!document.querySelector("[role=dialog]")'), true);
  assert.equal(await evaluate('document.querySelector("input[type=radio]").matches(":disabled")'), true);
  await evaluate('window.mode="uncertain";window.finish()');
  await until('document.body.textContent.includes("Retry original correction")');
  assert.equal(await evaluate('document.querySelector("[role=dialog] button:first-child").disabled'), true);
  await evaluate('window.mode="ready";document.querySelector("[role=dialog] button:last-child").click()');
  await until('!document.querySelector("[role=dialog]")');
  assert.match(await evaluate('document.body.textContent'), /Delivery contact corrected/);
  assert.deepEqual(await evaluate('window.requests'), [["order", "address", "original-key", 1], ["order", "address", "original-key", 1]]);
  console.log("Browser checks passed: 390/768/1280px and short viewport; location filtering, focus trap/restoration, Escape, loading/empty/error/validation, pending and exact uncertain retry/success.");
  console.log(`Screenshots: ${artifacts}`);
} finally {
  browser.kill();
  for (const request of pending.values()) clearTimeout(request.timeout);
}
