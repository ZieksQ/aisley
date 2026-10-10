// Runs real checkout/provider/consent components and transport with synthetic data.
// No live accounts, database writes or order placement are used.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";
const require = createRequire(import.meta.url);
const app = resolve(dirname(new URL(import.meta.url).pathname), "..");
const artifacts = resolve(app, "../../.next/checkout-voucher-browser");
const temporaryDirectory =
  process.env.AISLEY_BROWSER_TMPDIR ?? resolve(app, "../../.next/cv");
mkdirSync(artifacts, { recursive: true });
mkdirSync(temporaryDirectory, { recursive: true });
function compile(path) {
  return ts.transpileModule(readFileSync(resolve(app, path), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}
function productionModule(packageName, file) {
  const dependencyRequire = createRequire(require.resolve("react-dom/client"));
  return readFileSync(
    resolve(
      dirname(dependencyRequire.resolve(`${packageName}/package.json`)),
      "cjs",
      file,
    ),
    "utf8",
  );
}
const icons = dirname(require.resolve("react-icons/fi"));
const modules = {
  react: productionModule("react", "react.production.js"),
  "react/jsx-runtime": productionModule(
    "react",
    "react-jsx-runtime.production.js",
  ),
  "react-dom": productionModule("react-dom", "react-dom.production.js"),
  "react-dom/client": productionModule(
    "react-dom",
    "react-dom-client.production.js",
  ),
  scheduler: productionModule("scheduler", "scheduler.production.js"),
  "@aisley/ui": compile("../../packages/ui/src/button.tsx"),
  "@/lib/api": compile("src/lib/api.ts"),
  "@/lib/auth/session-events": compile("src/lib/auth/session-events.ts"),
  "./auth/session-events":
    'module.exports=require("@/lib/auth/session-events");',
  "@/lib/auth/navigation": compile("src/lib/auth/navigation.ts"),
  "@/lib/policies/client": compile("src/lib/policies/client.ts"),
  "@/components/auth/auth-provider":
    'exports.useAuth=()=>({auth:require("react").useSyncExternalStore(fn=>{window.authListeners.add(fn);return ()=>window.authListeners.delete(fn)},()=>window.auth,()=>window.auth)});',
  "./auth-provider":
    'module.exports=require("@/components/auth/auth-provider");',
  "@/components/cart/cart-provider":
    "exports.useCart=()=>({refresh:window.refreshCart});",
  "@/components/marketplace/product-image": compile(
    "src/components/marketplace/product-image.tsx",
  ),
  "next/image":
    'exports.default=({fill,priority,...props})=>require("react").createElement("img",props);',
  "next/link":
    'exports.default=({href,children,...props})=>require("react").createElement("a",{...props,href,onClick:e=>{e.preventDefault();window.router.push(href)}},children);',
  "next/navigation":
    'exports.useRouter=()=>window.router;exports.usePathname=()=>require("react").useSyncExternalStore(window.subscribeRoute,()=>window.route,()=>window.route).split("?")[0];',
  "react-icons/fi": readFileSync(resolve(icons, "index.js"), "utf8"),
  "../lib": readFileSync(resolve(icons, "../lib/index.js"), "utf8"),
  "./iconsManifest": readFileSync(
    resolve(icons, "../lib/iconsManifest.js"),
    "utf8",
  ),
  "./iconBase": readFileSync(resolve(icons, "../lib/iconBase.js"), "utf8"),
  "./iconContext": readFileSync(
    resolve(icons, "../lib/iconContext.js"),
    "utf8",
  ),
  "./auth-route-boundary": compile(
    "src/components/auth/auth-route-boundary.tsx",
  ),
};
for (const name of ["intent", "placement", "client", "voucher-selection"])
  modules[`@/lib/checkout/${name}`] = compile(`src/lib/checkout/${name}.ts`);
for (const name of [
  "checkout-provider",
  "checkout-page-content",
  "checkout-summary",
  "checkout-delivery-sections",
  "checkout-display",
  "shop-checkout-group",
  "shipping-provider-selector",
  "voucher-ticket",
  "voucher-selection-content",
])
  modules[`./${name}`] = compile(`src/components/checkout/${name}.tsx`);
modules["./voucher-selection.css"] = "";
const script = `
const process={env:{NODE_ENV:"production"}};const sources=${JSON.stringify(modules)};const cache={};
function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;if(!(name in sources))throw new Error("Missing module "+name);new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}
window.errors=[];window.addEventListener("error",e=>window.errors.push(e.message));
Object.defineProperty(document,"cookie",{value:"",configurable:true});const storage={};Object.defineProperty(window,"sessionStorage",{value:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=String(value),removeItem:key=>delete storage[key]},configurable:true});
let idempotencyCount=0;if(!crypto.randomUUID)Object.defineProperty(crypto,"randomUUID",{value:()=>"aaaaaaaa-aaaa-4aaa-8aaa-"+(++idempotencyCount).toString(16).padStart(12,"0")});
const React=require("react");window.auth={status:"authenticated",customer:{id:"customer-a"}};window.authListeners=new Set();window.routeListeners=new Set();window.route="/checkout";window.mode="ready";window.requests=[];window.navigation=[];window.refreshCart=async()=>{};
window.subscribeRoute=fn=>{window.routeListeners.add(fn);return ()=>window.routeListeners.delete(fn)};
window.router={push:path=>{window.navigation.push(path);window.route=path;window.routeListeners.forEach(fn=>fn())},replace:path=>window.router.push(path)};
window.setAuth=id=>{require("@/lib/auth/session-events").advanceSessionRevision();require("@/lib/checkout/placement").checkoutPlacement.clear();window.auth=id?{status:"authenticated",customer:{id}}:{status:"guest"};window.authListeners.forEach(fn=>fn())};
require("@/lib/checkout/intent").saveCheckoutIntent({mode:"buy_now",productId:"product",variantId:null,quantity:1});
const address={id:"address",type:"shipping",isDefault:true,label:"Home",recipientName:"Test Customer",contactNumber:"09000000000",addressLine1:"Test street",barangay:"Barangay",cityMunicipality:"Manila",province:"Metro Manila",region:"NCR",postalCode:"1000",country:"PH"};
const voucher={id:"platform-discount",name:"15% off your order",code:"SAVE15",issuerType:"app",benefitType:"discount",valueType:"percent",value:"15.00",maximumDiscount:"500.00",minimumSpend:"1000.00",validUntil:"2026-12-31T16:00:00Z",eligible:true,reason:null,saving:"150.00"};
window.offers=(shop)=>window.mode==="empty"?[]:[voucher,{...voucher,id:"platform-shipping",name:"Shipping discount",benefitType:"shipping",valueType:"fixed",value:"50.00",saving:"50.00",minimumSpend:"300.00",maximumDiscount:null},{...voucher,id:shop+"-discount",name:"Shop discount",issuerType:"shop",value:"10.00",maximumDiscount:"300.00",saving:"100.00"},{...voucher,id:shop+"-claim",name:"Collect for your next order",issuerType:"shop",eligible:false,reason:"VOUCHER_NOT_CLAIMED",collectionUrl:"/shops/issuer#vouchers"},{...voucher,id:shop+"-minimum",name:"Extra savings",eligible:false,reason:"VOUCHER_MINIMUM_SPEND",minimumSpend:"5000.00"},{...voucher,id:shop+"-funding",name:"Shipping savings",issuerType:"shop",benefitType:"shipping",eligible:false,reason:"VOUCHER_FUNDING_INSUFFICIENT"}];
window.longName=false;
window.fetch=async(url,options={})=>{
 const body=options.body?JSON.parse(options.body):null;window.requests.push({url,body});
 if(url.includes("csrf-cookie"))return new Response(null,{status:204});
 if(url.includes("policy-consent"))return new Response(JSON.stringify({data:{all_required_accepted:true}}));
 if(url.includes("/addresses"))return new Response(JSON.stringify({data:[address]}));
 if(url.includes("logistics-options"))return new Response(JSON.stringify({data:{address,groups:[{shop:{id:"shop-a",name:"Example Shop"},options:[{organizationId:"ncr-1",businessName:"NCR Logistics",shippingFee:"40.00"},{organizationId:"ncr-2",businessName:"NCR Express",shippingFee:"50.00"}]},{shop:{id:"shop-b",name:"Second Shop"},options:[{organizationId:"ncr-1",businessName:"NCR Logistics",shippingFee:"40.00"}]}]}}));
 if(url.includes("/place"))throw new TypeError("Lost confirmation");
 if(window.mode==="pending")await new Promise(resolve=>window.finish=resolve);
 if(window.mode==="offline")throw new TypeError("Offline. Check your connection and try again.");
 if(window.mode==="throttle")return new Response(JSON.stringify({message:"Too many requests. Try again shortly."}),{status:429,headers:{"Retry-After":"2"}});
 if(window.mode==="stale")return new Response(JSON.stringify({code:"VOUCHER_EXPIRED",message:"This voucher has expired. Remove it and try again."}),{status:409});
 const totals={merchandiseSubtotal:"1000.00",shippingFee:"50.00",discount:body.vouchers.some(v=>v.target_shop_id==="shop-a"&&v.voucher_id.includes("discount"))?"150.00":"0.00",shippingDiscount:body.vouchers.some(v=>v.target_shop_id==="shop-a"&&v.voucher_id==="platform-shipping")?"50.00":"0.00",payable:"900.00",currency:"PHP"};
 const groups=["shop-a","shop-b"].map(id=>({shop:{id,name:window.longName?"A long shop name that must wrap comfortably on small screens ".repeat(3):id==="shop-a"?"Example Shop":"Second Shop"},items:[{productId:"product",variantId:null,productName:"Everyday essentials",sku:"PRODUCT",quantity:1,selectedOptions:[],lineSubtotal:"1000.00",imageUrl:null}],availableVouchers:window.offers(id),appliedVouchers:body.vouchers.filter(v=>v.target_shop_id===id).map(v=>window.offers(id).find(offer=>offer.id===v.voucher_id)),shippingQuote:{logisticsOrganizationId:body.logistics_selections.find(v=>v.shop_id===id).logistics_organization_id,logisticsBusinessName:"NCR Express",shippingFee:"50.00"},totals}));
 return new Response(JSON.stringify({data:{quoteId:"quote-"+window.requests.length,groups,address,summary:{...totals,orderCount:2}}}));
};
function View(){const path=require("next/navigation").usePathname();if(path==="/checkout/vouchers")return React.createElement(require("./voucher-selection-content").VoucherSelectionContent,{shopId:new URLSearchParams(window.route.split("?")[1]).get("shop")??undefined});if(path!=="/checkout")return React.createElement("p",null,"Departed checkout");return React.createElement(require("./checkout-page-content").CheckoutPageContent)}
function App(){return React.createElement(require("./auth-route-boundary").AuthRouteBoundary,null,React.createElement(require("./checkout-provider").CheckoutProvider,null,React.createElement("main",{className:"mx-auto max-w-[1280px] px-4 py-6"},React.createElement(View))))}
require("react-dom/client").createRoot(document.getElementById("root")).render(React.createElement(App));
`;
const cssDirectory =
  process.env.AISLEY_BROWSER_CSSDIR ?? resolve(app, ".next/static/css");
const css =
  readdirSync(cssDirectory)
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(resolve(cssDirectory, file), "utf8"))
    .join("\n") +
  readFileSync(
    resolve(app, "src/components/checkout/voucher-selection.css"),
    "utf8",
  );
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="background:#f7f5f7"><div id="root"></div><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`;
const browser = spawn(
  process.env.CHROMIUM_BINARY ??
    "/home/zieks/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome",
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-breakpad",
    "--disable-crash-reporter",
    "--remote-debugging-pipe",
    `--user-data-dir=${artifacts}/profile`,
    `--crash-dumps-dir=${artifacts}`,
    "about:blank",
  ],
  {
    stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
    env: { ...process.env, TMPDIR: temporaryDirectory },
  },
);
let nextId = 0;
let buffer = "";
let diagnostics = "";
const pending = new Map();
browser.stderr.on("data", (data) => {
  diagnostics += data.toString();
});
for (const pipe of [browser.stdio[3], browser.stdio[4]])
  pipe.on("error", (error) => {
    diagnostics += error.message;
  });
browser.on("exit", (code, signal) => {
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(
      new Error(
        `Chromium exited ${code}/${signal}: ${diagnostics.slice(-1200)}`,
      ),
    );
  }
  pending.clear();
});
browser.stdio[4].on("data", (data) => {
  buffer += data.toString();
  let end;
  while ((end = buffer.indexOf("\0")) !== -1) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error)
        request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}; ${diagnostics.slice(-500)}`));
    }, 10000);
    pending.set(id, { resolve, reject, timeout });
    browser.stdio[3].write(
      JSON.stringify({
        id,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }) + "\0",
    );
  });
}
try {
  const { targetId } = await send("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const command = (method, params) => send(method, params, sessionId);
  await command("Page.enable");
  await command("Emulation.setFocusEmulationEnabled", { enabled: true });
  async function evaluate(expression) {
    const response = await command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails)
      throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 40; i++) {
      if (
        await evaluate(
          `(() => { try { return Boolean(${expression}) } catch { return false } })()`,
        )
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(
      `Condition failed: ${expression}; ${await evaluate("JSON.stringify({errors:window.errors,requests:window.requests.slice(-5),active:document.activeElement?.outerHTML.slice(0,300)})")}; ${await evaluate('document.getElementById("root").textContent.slice(0,700)')}`,
    );
  }

  const key = async (key) => {
    await command("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code: key,
      ...(key === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}),
      windowsVirtualKeyCode: key === "Enter" ? 13 : 0,
    });
    await command("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code: key,
      windowsVirtualKeyCode: key === "Enter" ? 13 : 0,
    });
  };
  await command("Page.navigate", { url: "about:blank" });
  const { frameTree } = await command("Page.getFrameTree");
  await command("Page.setDocumentContent", {
    frameId: frameTree.frame.id,
    html,
  });
  await until('document.querySelector("input[value=ncr-2]")');
  await evaluate('document.querySelector("input[value=ncr-2]").click()');
  await until(
    'document.querySelector("a[href=\\\"/checkout/vouchers?shop=shop-a\\\"]")',
  );
  const initialRequests = await evaluate("window.requests.length");
  await evaluate(
    'document.querySelector("a[href=\\\"/checkout/vouchers?shop=shop-a\\\"]").click()',
  );
  await until('document.querySelector(".checkout-voucher-ticket")');
  assert.equal(
    await evaluate("window.requests.length"),
    initialRequests,
    "Voucher navigation preserves the checkout provider/consent result",
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".checkout-voucher-page input[type=radio]").length',
    ),
    0,
  );
  await key("Tab");
  for (const width of [320, 390, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await until("document.documentElement.scrollWidth <= innerWidth");
    await evaluate(
      'document.querySelector("button[aria-label=\\\"Select 15% off your order\\\"]").focus()',
    );
    assert.equal(
      await evaluate("getComputedStyle(document.activeElement).outlineStyle"),
      "solid",
    );
    const shot = await command("Page.captureScreenshot", { format: "png" });
    writeFileSync(
      `${artifacts}/vouchers-${width}.png`,
      Buffer.from(shot.data, "base64"),
    );
  }
  await key("Enter");
  await until(
    'document.querySelector(".checkout-voucher-ticket[data-selected=true]")',
  );
  assert.equal(
    await evaluate(
      'document.querySelector(".checkout-voucher-ticket[data-selected=true] button").getAttribute("aria-pressed")',
    ),
    "true",
  );
  await evaluate(
    'document.querySelector("button[aria-label=\\\"Select Shipping discount\\\"]").click()',
  );
  await until(
    'document.querySelector(".checkout-voucher-footer").textContent.includes("2 selected")',
  );
  for (const width of [320, 390, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await until("document.documentElement.scrollWidth <= innerWidth");
    const selectedShot = await command("Page.captureScreenshot", {
      format: "png",
    });
    writeFileSync(
      `${artifacts}/selected-${width}.png`,
      Buffer.from(selectedShot.data, "base64"),
    );
  }
  await evaluate(
    'window.mode="offline";document.querySelector(".checkout-voucher-apply").click()',
  );
  await until('document.querySelector("[role=alert]")');
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".checkout-voucher-ticket[data-selected=true]").length',
    ),
    2,
  );
  assert.equal(
    await evaluate("window.route"),
    "/checkout/vouchers?shop=shop-a",
  );
  await evaluate(
    'window.mode="throttle";document.querySelector(".checkout-voucher-apply").click()',
  );
  await until(
    'document.querySelector("[role=alert]").textContent.includes("Too many")',
  );
  await evaluate(
    'window.mode="stale";document.querySelector(".checkout-voucher-apply").click()',
  );
  await until(
    'document.querySelector("[role=alert]").textContent.includes("expired")',
  );
  await evaluate(
    'window.mode="pending";document.querySelector(".checkout-voucher-apply").click()',
  );
  await until(
    'window.finish && document.querySelector(".checkout-voucher-apply").disabled',
  );
  assert.equal(
    await evaluate(
      'Array.from(document.querySelectorAll(".checkout-voucher-ticket-button")).every(button=>button.disabled)',
    ),
    true,
  );
  await evaluate('window.mode="ready";window.finish()');
  await until(
    'window.route === "/checkout" && document.querySelector("input[value=ncr-2]").checked',
  );
  assert.equal(
    await evaluate(
      'document.querySelector("a[href=\\\"/checkout/vouchers?shop=shop-a\\\"]").textContent.includes("Change")',
    ),
    true,
  );
  const applied = await evaluate(
    'window.requests.filter(r=>r.url.includes("/quote")).at(-1).body',
  );
  assert.deepEqual(applied.vouchers, [
    { voucher_id: "platform-discount", target_shop_id: "shop-a" },
    { voucher_id: "platform-shipping", target_shop_id: "shop-a" },
  ]);
  assert.ok(
    applied.logistics_selections.some(
      (item) =>
        item.shop_id === "shop-a" && item.logistics_organization_id === "ncr-2",
    ),
  );
  // Back discards a local draft and retains the previously accepted selection.
  await evaluate('window.router.push("/checkout/vouchers?shop=shop-a")');
  await until(
    'document.querySelectorAll(".checkout-voucher-ticket[data-selected=true]").length===2',
  );
  await evaluate(
    'document.querySelector("button[aria-label=\\\"Remove 15% off your order\\\"]").click();document.querySelector("a[aria-label=\\\"Back to checkout\\\"]").click()',
  );
  await until('window.route === "/checkout"');
  await evaluate('window.router.push("/checkout/vouchers?shop=shop-a")');
  await until(
    'document.querySelectorAll(".checkout-voucher-ticket[data-selected=true]").length===2',
  );
  // Same-benefit Shop replacement and filters.
  await evaluate(
    'document.querySelector("button[aria-label=\\\"Select Shop discount\\\"]").click()',
  );
  await until(
    'document.querySelector(".checkout-voucher-footer").textContent.includes("2 selected")',
  );
  assert.equal(
    await evaluate(
      'document.querySelector("button[aria-label=\\\"Select 15% off your order\\\"]").getAttribute("aria-pressed")',
    ),
    "false",
  );
  await evaluate(
    'Array.from(document.querySelectorAll(".checkout-voucher-filters button")).find(b=>b.textContent==="Shipping").click()',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".checkout-voucher-ticket").length',
    ),
    2,
  );
  await evaluate(
    'Array.from(document.querySelectorAll(".checkout-voucher-filters button")).find(b=>b.textContent==="All").click()',
  );
  // A new Shop receives no implicit platform allocation.
  await evaluate('window.router.push("/checkout/vouchers?shop=shop-b")');
  await until(
    'document.querySelector(".checkout-voucher-header p").textContent === "Second Shop"',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".checkout-voucher-ticket[data-selected=true]").length',
    ),
    0,
  );
  await evaluate(
    'document.querySelector("button[aria-label=\\\"Select 15% off your order\\\"]").click()',
  );
  await until(
    'document.querySelector(".checkout-voucher-footer").textContent.includes("1 selected")',
  );
  await evaluate('document.querySelector(".checkout-voucher-apply").click()');
  await until('window.route === "/checkout"');
  const moved = await evaluate(
    'window.requests.filter(r=>r.url.includes("/quote")).at(-1).body.vouchers',
  );
  assert.deepEqual(moved, [
    { voucher_id: "platform-shipping", target_shop_id: "shop-a" },
    { voucher_id: "platform-discount", target_shop_id: "shop-b" },
  ]);
  // Pending successful replies from a different account never restore its state.
  await evaluate('window.router.push("/checkout/vouchers?shop=shop-a")');
  await until('document.querySelector(".checkout-voucher-ticket")');
  await evaluate(
    'window.mode="pending";document.querySelector(".checkout-voucher-apply").click()',
  );
  await until('document.querySelector(".checkout-voucher-apply").disabled');
  await evaluate(
    'window.mode="ready";window.setAuth("customer-b");window.finish()',
  );
  await until(
    'document.getElementById("root").textContent.includes("Return to checkout")',
  );
  await evaluate('window.router.push("/checkout")');
  await until('document.querySelector("input[value=ncr-2]")');
  await evaluate('document.querySelector("input[value=ncr-2]").click()');
  await until(
    'document.querySelector("a[href=\\\"/checkout/vouchers?shop=shop-a\\\"]")',
  );
  await evaluate('window.router.push("/checkout/vouchers?shop=shop-a")');
  await until('document.querySelector(".checkout-voucher-ticket")');
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".checkout-voucher-ticket[data-selected=true]").length',
    ),
    0,
  );
  // Empty results, long content and invalid target feedback.
  await evaluate(
    'window.mode="empty";document.querySelector(".checkout-voucher-apply").click()',
  );
  await until('window.route === "/checkout"');
  await evaluate('window.router.push("/checkout/vouchers?shop=shop-a")');
  await until(
    'document.getElementById("root").textContent.includes("No vouchers")',
  );
  await evaluate(
    'window.mode="ready";window.longName=true;document.querySelector(".checkout-voucher-apply").click()',
  );
  await until('window.route === "/checkout"');
  await evaluate('window.router.push("/checkout/vouchers?shop=shop-a")');
  await until('document.querySelector(".checkout-voucher-ticket")');
  await command("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await until("document.documentElement.scrollWidth <= innerWidth");
  await evaluate('window.router.push("/checkout/vouchers?shop=foreign")');
  await until(
    'document.getElementById("root").textContent.includes("Return to checkout")',
  );
  await evaluate('window.router.push("/checkout")');
  await until(
    'document.getElementById("root").textContent.includes("Place order")',
  );
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Place order").click()',
  );
  await until(
    'document.getElementById("root").textContent.includes("Retry original order")',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll("a[href^=\\\"/checkout/vouchers\\\"]").length',
    ),
    0,
  );
  await evaluate('window.router.push("/checkout/vouchers?shop=shop-a")');
  await until(
    'document.getElementById("root").textContent.includes("Confirm your previous order")',
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".checkout-voucher-ticket").length',
    ),
    0,
  );
  assert.deepEqual(await evaluate("window.errors"), []);
  console.log(
    "Passed: real checkout/provider/consent flow, 320/390/768/1440px, keyboard/focus, ticket selection/no radios, draft cancellation, filters, empty/long content, exact Shop allocation, shipping retention, offline/429/stale retry, in-flight lock, account change/late reply cleanup and uncertain-placement navigation lock.",
  );
  console.log(`Screenshots: ${artifacts}`);
} finally {
  for (const request of pending.values()) clearTimeout(request.timeout);
  pending.clear();
  browser.kill();
}
