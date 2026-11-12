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
const artifacts = resolve(app, "node_modules/.cache/order-preparation-browser");
mkdirSync(artifacts, { recursive: true });
// Unix-domain socket paths need a short temporary directory inside the repo.
const temporaryDirectory = resolve(app, "../../.next/b3");
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
  "@/lib/orders/format": compile("src/lib/orders/format.ts"),
  "@/lib/orders/pending-mutations": compile("src/lib/orders/pending-mutations.ts"),
  "@/lib/auth/session-events": 'exports.sessionRevision = () => window.revision;',
  "./order-contact-correction": 'exports.OrderContactCorrection = () => null;',
  actions: compile("src/components/orders/order-buyer-actions.tsx"),
  "@/lib/api": 'exports.ApiError = class ApiError extends Error { constructor(status, code) { super(code); this.status=status; this.code=code; this.errors={}; } };',
  "@/lib/orders/client": 'exports.orderMutationKey = () => "key-" + ++window.keys; exports.extendOrderPreparation = (...args) => window.mutate("extend", ...args); exports.cancelOrder = (...args) => window.mutate("cancel", ...args);',
};
const script = `
const process={env:{NODE_ENV:"production"}};
const sources=${JSON.stringify(modules)};
const cache={};
function require(name) { if(cache[name]) return cache[name].exports; const module={exports:{}}; cache[name]=module; new Function("require","module","exports",sources[name])(require,module,module.exports); return module.exports; }
const React=require("react");
const {OrderBuyerActions}=require("actions");
window.revision=1;window.keys=0;window.mode="ready";window.requests=[];
window.order={id:"order",reference:"ASL-PREPARATION-1",status:"seller_processing",actions:{canCancel:true,canModify:false,canExtendPreparation:true,modifiableFields:[]},preparation:{acceptedAt:"2026-11-01T00:00:00Z",initialDeadlineAt:"2026-11-04T00:00:00Z",deadlineAt:"2026-11-04T00:00:00Z",extendedAt:null,extensionUsed:false,active:true,overdue:true,serverTime:"2026-11-05T00:00:00Z"}};
window.mutate=async(...args)=>{window.requests.push(args);if(window.mode==="pending")await new Promise(resolve=>window.finish=resolve);if(window.mode==="uncertain")throw new Error("lost response");if(window.mode==="conflict")throw new (require("@/lib/api").ApiError)(409,"ORDER_PREPARATION_NOT_EXTENDABLE");if(window.mode==="invalid")throw new (require("@/lib/api").ApiError)(422,"Invalid request");return {...window.order,status:args[0]==="cancel"?"cancelled":"seller_processing",preparation:{...window.order.preparation,extensionUsed:args[0]==="extend",overdue:false,extendedAt:"2026-11-05T00:00:00Z",deadlineAt:"2026-11-08T00:00:00Z"},actions:{canCancel:false,canModify:false,canExtendPreparation:false,modifiableFields:[]}};};
function App(){const[order,setOrder]=React.useState(window.order);const[stale,setStale]=React.useState(false);const[version,setVersion]=React.useState(1);window.setOrder=setOrder;window.setStale=setStale;window.remount=()=>setVersion(v=>v+1);const refresh=React.useCallback(async()=>{window.refreshes=(window.refreshes||0)+1;if(window.mode==="conflict")setOrder({...window.order,status:"ready_for_pickup",actions:{...window.order.actions,canCancel:false,canExtendPreparation:false}});},[]);return React.createElement("main",{style:{padding:16,maxWidth:1180,margin:"auto"}},React.createElement(OrderBuyerActions,{key:version,order,stale,onUpdated:setOrder,onRefresh:refresh}));}
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
    throw new Error(`Condition failed: ${expression}; ${await evaluate('JSON.stringify({text:document.querySelector("#root").textContent,requests:window.requests,buttons:[...document.querySelectorAll("button")].map(b=>({text:b.textContent,disabled:b.disabled}))})')}`);
  }
  async function reset() {
    await command("Page.navigate", { url: "about:blank" });
    await until('document.readyState === "complete" && !document.querySelector("#root")');
    const { frameTree } = await command("Page.getFrameTree");
    await command("Page.setDocumentContent", { frameId: frameTree.frame.id, html });
    await until('document.querySelector("button")');
  }
  const click = text => evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)}).click()`);
  const key = async key => {
    await command("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: key === "Escape" ? 27 : 9 });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: key === "Escape" ? 27 : 9 });
  };
  for (const [width,height] of [[320,740],[390,844],[768,1024],[1440,900],[390,400]]) {
    await command("Emulation.setDeviceMetricsOverride", { width,height,deviceScaleFactor:1,mobile:false });
    await reset();
    let shot=await command("Page.captureScreenshot",{format:"png"});
    writeFileSync(`${artifacts}/${width}x${height}-panel.png`,Buffer.from(shot.data,"base64"));
    await evaluate('document.querySelector("button").focus()');
    await click("Extend preparation by 3 days");
    await until('document.querySelector("dialog[open]")');
    assert.equal(await evaluate('window.requests.length'),0);
    const layout=await evaluate(`(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,dialogOverflow:d.scrollWidth>d.clientWidth,left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()`);
    assert.equal(layout.overflow,false);assert.equal(layout.dialogOverflow,false);
    assert.ok(layout.left>=0&&layout.right<=width&&layout.top>=0&&layout.bottom<=height);
    shot=await command("Page.captureScreenshot",{format:"png"});
    writeFileSync(`${artifacts}/${width}x${height}-dialog.png`,Buffer.from(shot.data,"base64"));
    await key("Escape");await until('!document.querySelector("dialog")');
    assert.equal(await evaluate('document.activeElement.textContent'),"Extend preparation by 3 days");
    await click("Extend preparation by 3 days");await until('document.querySelector("dialog[open]")');
    await click("Confirm 3-day extension");await until('!document.querySelector("dialog")');
    assert.match(await evaluate('document.querySelector("main").textContent'),/Preparation extended by 3 days/);
    assert.equal(await evaluate('document.querySelector("main").textContent.includes("Cancel Order")'),false);
    console.log(`${width}x${height}: panel/dialog bounds, explicit confirmation, focus restoration and success passed`);
  }
  await reset();await evaluate('window.setStale(true)');
  await until('[...document.querySelectorAll("button")].every(b=>b.disabled)');
  await reset();await click("Cancel Order");await until('document.querySelector("textarea")');
  await evaluate('const input=document.querySelector("textarea");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(input,"Late preparation");input.dispatchEvent(new Event("input",{bubbles:true}))');
  await click("Confirm cancellation");await until('!document.querySelector("dialog")');
  assert.equal(await evaluate('window.requests[0][0]'),"cancel");
  assert.equal(await evaluate('window.requests[0][3]'),"Late preparation");
  await reset();await evaluate('window.mode="pending"');
  await click("Extend preparation by 3 days");await until('document.querySelector("dialog[open]")');
  await click("Confirm 3-day extension");await until('window.requests.length===1');
  await key("Escape");assert.equal(await evaluate('!!document.querySelector("dialog[open]")'),true);
  await evaluate('window.mode="uncertain";window.finish()');await until('document.querySelector("dialog").textContent.includes("Retry exact request")');
  assert.equal(await evaluate('document.querySelector("dialog button").disabled'),true);
  await evaluate('window.remount()');await until('document.querySelector("dialog[open]")');
  await evaluate('window.mode="ready"');await click("Retry exact request");await until('!document.querySelector("dialog")');
  assert.deepEqual(await evaluate('window.requests'),[["extend","order","key-1"],["extend","order","key-1"]]);
  await reset();await evaluate('window.mode="conflict"');
  await click("Extend preparation by 3 days");await until('document.querySelector("dialog[open]")');
  await click("Confirm 3-day extension");await until('window.refreshes===1');
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Extend preparation by 3 days")'),false);
  await reset();await evaluate('window.mode="pending"');
  await click("Extend preparation by 3 days");await until('document.querySelector("dialog[open]")');
  await click("Confirm 3-day extension");await until('window.requests.length===1');
  await evaluate('window.revision++;window.order={...window.order,reference:"OTHER-ACCOUNT"};window.remount();window.finish()');
  await until('!document.querySelector("dialog")');
  assert.equal(await evaluate('document.querySelector("main").textContent.includes("Preparation extended by 3 days.")'),false);
  console.log("Browser checks passed: responsive panels/dialogs, explicit extension/cancel, stale disabling, uncertain frozen retry across remount, conflict refresh and session response disposal.");
  console.log(`Screenshots: ${artifacts}`);
} finally {
  browser.kill();
  for (const request of pending.values()) clearTimeout(request.timeout);
}
