// Actual voucher, wallet, Shop identity/product composition and collection client.
// Synthetic HTTP/auth and Product card transport; no live account writes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const app = resolve(dirname(new URL(import.meta.url).pathname), "..");
const artifacts = resolve(app, "node_modules/.cache/customer-vouchers-browser");
const temporaryDirectory = resolve(app, "../../.next/vc");
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
  "@/lib/vouchers/client": compile("src/lib/vouchers/client.ts"),
  "@/lib/vouchers/model": compile("src/lib/vouchers/model.ts"),
  "./model": 'module.exports=require("@/lib/vouchers/model");',
  "@/lib/marketplace/discovery-url": compile(
    "src/lib/marketplace/discovery-url.ts",
  ),
  "@/components/auth/auth-provider":
    'exports.useAuth=()=>({auth:require("react").useSyncExternalStore(fn=>{window.authListeners.add(fn);return ()=>window.authListeners.delete(fn)},()=>window.auth,()=>window.auth)});',
  "next/link":
    'exports.default=props=>require("react").createElement("a",props,props.children);',
  "next/image":
    'exports.default=({fill,priority,...props})=>require("react").createElement("img",props);',
  "next/navigation":
    'exports.useRouter=()=>({push:path=>window.navigation.push(path),refresh:()=>window.navigation.push("refresh")});exports.usePathname=()=>"/shops/fixture-shop";exports.useSearchParams=()=>new URLSearchParams(window.parameters??"");',
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
  "@/components/marketplace/product-card":
    'exports.ProductCard=({product})=>require("react").createElement("a",{href:"/products/"+product.id,style:{minWidth:0,background:"white",border:"1px solid #e3dbe5",padding:12}},product.name);',
};
for (const name of [
  "voucher-offers",
  "voucher-card",
  "voucher-detail-content",
  "use-voucher-offers",
  "my-vouchers-content",
  "private-voucher-detail",
  "voucher-filters",
  "voucher-pagination",
  "shop-vouchers-section",
]) {
  modules[`./${name}`] = compile(
    `src/components/vouchers/${name}.${name === "use-voucher-offers" ? "ts" : "tsx"}`,
  );
}
for (const name of [
  "shop-header",
  "shop-products-content",
  "shop-search",
  "browse-controls",
])
  modules[`./${name}`] = compile(`src/components/shops/${name}.tsx`);
modules["@/components/search/public-read-failure"] = compile(
  "src/components/search/public-read-failure.tsx",
);
const offer = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Everyday savings on your next purchase",
  code: "SAVE-20",
  issuerType: "app",
  benefitType: "discount",
  valueType: "percent",
  value: "20.00",
  maximumDiscount: "100.00",
  minimumSpend: "500.00",
  currency: "PHP",
  validFrom: "2026-10-01T00:00:00Z",
  validUntil: "2027-01-01T00:00:00Z",
  paymentMethod: "cod",
  termsSummary: "Minimum spend applies to one Shop order. ".repeat(20),
  distributionMode: "claim_required",
  scope: {
    productIds: [],
    categoryIds: [],
    excludedProductIds: [],
    excludedCategoryIds: [],
  },
  shop: null,
  collectionUrl: "/vouchers/11111111-1111-4111-8111-111111111111",
  collectedAt: null,
  collected: null,
  remainingPersonalUses: null,
  availabilityReason: null,
  canCollect: true,
  walletStatus: null,
};
const shop = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "The very long shop name for responsive storefront testing",
  slug: "fixture-shop",
  category: { id: "category", name: "Home and living", slug: "home" },
  description: "Handpicked household products. ".repeat(80),
  bannerUrl: null,
  logoUrl: null,
};
const script = `
const process={env:{NODE_ENV:"production"}};
const sources=${JSON.stringify(modules)};const cache={};
function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function("require","module","exports",sources[name])(require,module,module.exports);return module.exports;}
window.errors=[];window.addEventListener("error",event=>window.errors.push(event.message));
Object.defineProperty(document,"cookie",{value:"",configurable:true});
const storage={};Object.defineProperty(window,"sessionStorage",{value:{getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=String(value)},removeItem:key=>{delete storage[key]}},configurable:true});
const React=require("react");window.auth={status:"guest"};window.authListeners=new Set();window.navigation=[];window.requests=[];window.mode="ready";window.surface="discovery";window.collected=new Set();window.fixture=${JSON.stringify(offer)};window.shop=${JSON.stringify(shop)};
window.offers=()=>[window.fixture,{...window.fixture,id:"33333333-3333-4333-8333-333333333333",name:"Automatic shipping savings",benefitType:"shipping",distributionMode:"automatic",canCollect:false},{...window.fixture,id:"44444444-4444-4444-8444-444444444444",name:"Shop merchandise savings",issuerType:"shop",shop:window.shop,collectionUrl:"/shops/fixture-shop#vouchers"}];
window.setAuth=(id)=>{require("@/lib/auth/session-events").advanceSessionRevision();window.auth=id?{status:"authenticated",customer:{id}}:{status:"guest"};window.authListeners.forEach(fn=>fn());};
window.fetch=async(url,options={})=>{
 const requestOwner=window.auth.customer?.id;window.requests.push({url,method:options.method??"GET"});
 if(url.includes("csrf-cookie"))return new Response(null,{status:204});
 if(window.mode==="offline")throw new TypeError("Offline: check your connection and try again.");
 if(window.mode==="throttle")return new Response(JSON.stringify({message:"Too many requests."}),{status:429,headers:{"Retry-After":"2"}});
 if(window.mode==="pending")await new Promise(resolve=>window.finish=resolve);
 const privateOffer=v=>({...v,collected:window.collected.has(requestOwner+v.id),collectedAt:window.collected.has(requestOwner+v.id)?"2026-10-11T00:00:00Z":null,remainingPersonalUses:2,walletStatus:"available",canCollect:v.distributionMode==="claim_required"&&!window.collected.has(requestOwner+v.id)});
 if(url.includes("/claim")){const id=url.split("/").at(-2);window.collected.add(requestOwner+id);return new Response(JSON.stringify({data:privateOffer(window.offers().find(v=>v.id===id))}));}
 if(url.includes("voucher-statuses"))return new Response(JSON.stringify({items:window.offers().map(privateOffer)}));
 const params=new URL(url).searchParams;const status=params.get("status");let items=window.offers().filter(v=>!url.includes("/shops/")||v.issuerType==="shop").map(privateOffer);
 if(window.mode==="empty")items=[];
 if(items.length && status==="upcoming")items=[{...items[0],availabilityReason:"VOUCHER_NOT_STARTED",validFrom:"2026-12-01T00:00:00Z",walletStatus:"upcoming",collected:true,canCollect:false}];
 if(items.length && status==="history")items=[{...items[0],availabilityReason:"VOUCHER_CUSTOMER_LIMIT",walletStatus:"history",remainingPersonalUses:0,collected:true,canCollect:false}];
 if(window.mode==="paused")items=[{...items[0],availabilityReason:"VOUCHER_INACTIVE",collected:true,canCollect:false}];
 return new Response(JSON.stringify({items,pagination:{currentPage:Number(params.get("page")??1),lastPage:2,perPage:20,total:23}}));
};
function App(){const[surface,setSurface]=React.useState(window.surface);window.openSurface=setSurface;let content;
 if(surface==="wallet")content=React.createElement(require("./my-vouchers-content").MyVouchersContent);
 else if(surface==="shop")content=React.createElement(React.Fragment,null,React.createElement(require("./shop-header").ShopHeader,{shop:window.shop}),React.createElement(require("./shop-vouchers-section").ShopVouchersSection,{slug:window.shop.slug,initial:{status:"success",data:{items:[window.offers()[2]],pagination:{currentPage:1,lastPage:2,perPage:20,total:23}}},returnPath:"/shops/fixture-shop?q=shirt#vouchers"}),React.createElement(require("./shop-products-content").ShopProductsContent,{slug:window.shop.slug,name:window.shop.name,query:"",category:null,result:{status:"success",data:{items:Array.from({length:6},(_,i)=>({id:String(i),name:"Product "+i})),categories:[window.shop.category],pagination:{currentPage:1,lastPage:2,perPage:20,total:30}}}}));
 else content=React.createElement(React.Fragment,null,React.createElement("header",{className:"voucher-page-heading"},React.createElement("h1",null,surface==="detail"?window.fixture.name:"Vouchers")),surface==="discovery"&&React.createElement(require("./voucher-filters").VoucherFiltersBar,{filters:{}}),React.createElement(require("./voucher-offers").VoucherOffers,{items:surface==="detail"?[window.fixture]:window.offers(),detail:surface==="detail",returnPath:"/vouchers?benefit=discount"}));
 return React.createElement("main",{className:"customer-vouchers voucher-public-container shop-storefront"},content,surface==="discovery"&&React.createElement(require("./voucher-pagination").VoucherPagination,{pagination:{currentPage:1,lastPage:2,perPage:20,total:23},filters:{benefit:"discount"}}));
}
require("react-dom/client").createRoot(document.getElementById("root")).render(React.createElement(App));
`;
const cssDirectory = resolve(app, ".next/static/css");
const css =
  readdirSync(cssDirectory)
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFileSync(resolve(cssDirectory, file), "utf8"))
    .join("\n") +
  readFileSync(resolve(app, "src/components/vouchers/vouchers.css"), "utf8") +
  readFileSync(
    resolve(app, "src/components/shops/shop-storefront.css"),
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
browser.on("exit", (code) => {
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(
      new Error(`Chromium exited ${code}: ${diagnostics.slice(-1200)}`),
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
  await until('document.querySelector(".customer-voucher-card")');
  for (const width of [320, 390, 768, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const surface of ["discovery", "detail", "shop", "wallet"]) {
      await evaluate(
        `window.setAuth(${surface === "wallet" ? '"customer-a"' : "null"});window.openSurface(${JSON.stringify(surface)})`,
      );
      await until(
        `document.querySelector(${JSON.stringify(surface === "wallet" ? ".voucher-wallet .customer-voucher-card" : surface === "shop" ? ".shop-identity" : surface === "detail" ? ".voucher-detail-layout" : ".voucher-filter-tabs")})`,
      );
      await until("document.documentElement.scrollWidth <= innerWidth");
      if (surface === "discovery")
        assert.equal(
          await evaluate(
            'getComputedStyle(document.querySelector(".customer-voucher-grid")).gridTemplateColumns.split(" ").length',
          ),
          width < 640 ? 1 : width < 1200 ? 2 : 3,
        );
      if (surface === "shop" && width < 640)
        assert.equal(
          await evaluate(
            'getComputedStyle(document.querySelector("#shop-products-heading").closest("section").querySelector(".grid.grid-cols-2")).gridTemplateColumns.split(" ").length',
          ),
          2,
        );
      const shot = await command("Page.captureScreenshot", { format: "png" });
      writeFileSync(
        `${artifacts}/${surface}-${width}.png`,
        Buffer.from(shot.data, "base64"),
      );
    }
  }
  await evaluate('window.setAuth(null);window.openSurface("discovery")');
  await until('document.querySelector("a.voucher-collect")');
  assert.equal(
    await evaluate(
      'document.querySelector(".voucher-pagination a").getAttribute("href")',
    ),
    "/vouchers?benefit=discount&page=2",
  );
  assert.match(
    await evaluate(
      'document.querySelector("a.voucher-collect").getAttribute("href")',
    ),
    /next=%2Fvouchers%3Fbenefit%3Ddiscount/,
  );
  await evaluate('window.setAuth("customer-a")');
  await until(
    'document.querySelector("button.voucher-collect:not(:disabled)")',
  );
  assert.equal(
    await evaluate(
      'window.requests.filter(r=>r.url.includes("/claim")).length',
    ),
    0,
  );
  await evaluate('document.querySelector("button.voucher-collect").focus()');
  await key("Enter");
  await until(
    'document.getElementById("root").textContent.includes("collected. Browse products")',
  );
  assert.equal(
    await evaluate(
      'window.requests.filter(r=>r.url.includes("/claim")).length',
    ),
    1,
  );
  await evaluate('window.setAuth("customer-b")');
  await until(
    'document.querySelector("button.voucher-collect:not(:disabled)")',
  );
  assert.equal(
    await evaluate(
      'document.getElementById("root").textContent.includes("collected. Browse products")',
    ),
    false,
  );
  await evaluate('window.openSurface("shop")');
  await until(
    'document.querySelector("button.voucher-collect:not(:disabled)")',
  );
  await evaluate('document.querySelector("button.voucher-collect").click()');
  await until(
    'document.getElementById("root").textContent.includes("collected. Browse products")',
  );
  assert.match(
    await evaluate(
      'window.requests.filter(r=>r.url.includes("/claim")).at(-1).url',
    ),
    /shops\/fixture-shop\/vouchers\/4444/,
  );
  await evaluate(
    'document.querySelector("#vouchers .voucher-pagination button").click()',
  );
  await until(
    'document.querySelector("#vouchers .voucher-pagination").textContent.includes("Page 2")',
  );
  assert.match(
    await evaluate(
      'window.requests.find(r=>r.url.includes("/shops/fixture-shop/vouchers?page=2")).url',
    ),
    /page=2/,
  );
  await evaluate('document.querySelector(".shop-description summary").focus()');
  await key("Enter");
  assert.equal(
    await evaluate('document.querySelector(".shop-description").open'),
    true,
  );
  await evaluate('window.openSurface("wallet")');
  await until(
    'document.querySelector(".voucher-wallet .customer-voucher-card")',
  );
  await evaluate(
    'document.querySelector(".voucher-wallet .voucher-pagination button").click()',
  );
  await until(
    'document.querySelector(".voucher-wallet .voucher-pagination").textContent.includes("Page 2")',
  );
  await evaluate(
    'window.mode="paused";document.querySelector(".voucher-wallet .voucher-pagination button").click()',
  );
  await until(
    'document.getElementById("root").textContent.includes("Paused by the issuer")',
  );
  await evaluate('window.mode="ready"');
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Upcoming").click()',
  );
  await until(
    'document.getElementById("root").textContent.includes("validity period starts")',
  );
  await evaluate(
    'Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="History").click()',
  );
  await until(
    'document.getElementById("root").textContent.includes("personal allowance")',
  );
  await evaluate(
    'window.mode="empty";document.querySelector("#wallet-issuer").value="app";document.querySelector("#wallet-issuer").dispatchEvent(new Event("change",{bubbles:true}))',
  );
  await until(
    'document.getElementById("root").textContent.includes("No vouchers here yet")',
  );
  await evaluate(
    'window.mode="offline";Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Available").click()',
  );
  await until(
    'document.getElementById("root").textContent.includes("Offline:")',
  );
  assert.equal(
    await evaluate(
      'document.getElementById("root").textContent.includes("No vouchers here yet")',
    ),
    false,
  );
  await evaluate(
    'window.mode="throttle";Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Try again").click()',
  );
  await until(
    'document.getElementById("root").textContent.includes("Retry in")',
  );
  assert.equal(
    await evaluate(
      'Array.from(document.querySelectorAll("button")).find(b=>b.textContent.startsWith("Retry in")).disabled',
    ),
    true,
  );
  await evaluate(
    'window.mode="ready";window.openSurface("discovery");window.setAuth("customer-c")',
  );
  await until(
    'document.querySelector("button.voucher-collect:not(:disabled)")',
  );
  await evaluate(
    'window.mode="offline";document.querySelector("button.voucher-collect").click()',
  );
  await until(
    'document.getElementById("root").textContent.includes("Offline:")',
  );
  await evaluate(
    'window.mode="pending";document.querySelector("button.voucher-collect").click()',
  );
  await until(
    'document.getElementById("root").textContent.includes("Collecting")',
  );
  await evaluate('window.mode="ready";window.setAuth(null);window.finish()');
  await until('document.querySelector("a.voucher-collect")');
  assert.equal(
    await evaluate(
      'document.getElementById("root").textContent.includes("collected. Browse products")',
    ),
    false,
  );
  console.log(
    "Passed: actual voucher/detail/wallet/Shop components at 320/390/768/1440px; column counts, overflow, long terms/description, missing imagery, keyboard collection/description, explicit post-login collection, Shop endpoint, account switching, wallet tabs/empty/offline/throttle and stale pending reply cleanup.",
  );
  console.log(`Screenshots: ${artifacts}`);
} finally {
  browser.kill();
  for (const request of pending.values()) clearTimeout(request.timeout);
}
