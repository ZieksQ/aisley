// Run `next build` first. This isolated component smoke uses generated storefront CSS,
// synthetic upload responses, and a local ChromeDriver; it does not call a live API.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdirSync,
  rmSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(app, "node_modules/.cache/account-id-image-browser");
const temporaryDirectory = resolve(app, "../../.idimg");
const profileDirectory = resolve(artifacts, "profile");
const port = 19517;
rmSync(temporaryDirectory, { recursive: true, force: true });
mkdirSync(temporaryDirectory, { recursive: true });
rmSync(profileDirectory, { recursive: true, force: true });

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

function compile(path) {
  return ts.transpileModule(readFileSync(resolve(app, path), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

const iconStub = `
const React = require("react");
exports.FiCheckCircle = () => React.createElement("span", { "aria-hidden": true });
exports.FiTrash2 = () => React.createElement("span", { "aria-hidden": true });
exports.FiUpload = () => React.createElement("span", { "aria-hidden": true });
`;
const buttonStub = `
const React = require("react");
exports.Button = ({ children, isLoading, loadingLabel, ...props }) =>
  React.createElement("button", { ...props, "aria-busy": isLoading || undefined }, isLoading ? loadingLabel : children);
`;
const apiStub = `
exports.ApiError = class ApiError extends Error {
  constructor(status, body) { super(body.message); this.status = status; this.body = body; }
};
exports.firstFieldError = (error, field) => error?.body?.errors?.[field]?.[0] ?? null;
`;
const clientStub = `
exports.uploadCustomerIdImage = (file, onProgress) => window.idImageMock.upload(file, onProgress);
exports.removeCustomerIdImage = () => window.idImageMock.remove();
`;
const modules = {
  react: productionModule("react", "react.production.js"),
  "react/jsx-runtime": productionModule("react", "react-jsx-runtime.production.js"),
  "react-dom": productionModule("react-dom", "react-dom.production.js"),
  "react-dom/client": productionModule("react-dom", "react-dom-client.production.js"),
  scheduler: productionModule("scheduler", "scheduler.production.js"),
  "@aisley/ui": buttonStub,
  "@aisley/ui/account-settings": `exports.AccountRemovalConfirmation = require("./confirmation-dialog").ConfirmationDialog;`,
  "./confirmation-dialog": compile("../../packages/ui/src/portal/ConfirmationDialog.tsx"),
  "@/lib/api": apiStub,
  "@/lib/account/client": clientStub,
  "react-icons/fi": iconStub,
  "./id-image-section": compile("src/components/account/id-image-section.tsx"),
};

const script = `
const sources = ${JSON.stringify(modules)};
const cache = {};
function require(name) {
  if (cache[name]) return cache[name].exports;
  const module = { exports: {} };
  cache[name] = module;
  new Function("require", "module", "exports", sources[name])(require, module, module.exports);
  return module.exports;
}
const React = require("react");
const { createRoot } = require("react-dom/client");
const { ApiError } = require("@/lib/api");
window.idImageMock = {
  mode: "success",
  uploads: [],
  removals: 0,
  async upload(file, onProgress) {
    this.uploads.push({ name: file.name, type: file.type, size: file.size });
    onProgress(42);
    if (this.mode === "pending") {
      return new Promise((resolve) => { this.resolveUpload = resolve; });
    }
    if (this.mode === "failure") {
      throw new ApiError(422, { message: "Validation failed.", errors: { id_image: ["The server rejected this image."] } });
    }
    return {
      message: "ID image uploaded successfully.",
      account: { id: "customer-fixture", profile: { idImageUrl: "/api/v1/customer/account/id-image?v=" + this.uploads.length } },
    };
  },
  async remove() {
    this.removals += 1;
    return { message: "ID image removed successfully.", account: { id: "customer-fixture", profile: { idImageUrl: null } } };
  },
};
const account = { id: "customer-fixture", profile: { idImageUrl: null } };
function Harness() {
  const [current, setCurrent] = React.useState(account);
  const { IdImageSection } = require("./id-image-section");
  return React.createElement(IdImageSection, { account: current, onUpdated: (response) => setCurrent(response.account) });
}
window.revokeCalls = [];
const revoke = URL.revokeObjectURL.bind(URL);
URL.revokeObjectURL = (url) => { window.revokeCalls.push(url); revoke(url); };
window.errors = [];
window.addEventListener("error", (event) => window.errors.push(event.message));
createRoot(document.getElementById("root")).render(React.createElement(Harness));
`;

const cssDirectory = resolve(app, ".next/static/css");
const css = readdirSync(cssDirectory)
  .filter((file) => file.endsWith(".css"))
  .map((file) => readFileSync(resolve(cssDirectory, file), "utf8"))
  .join("\n");
const fixturePath = resolve(artifacts, "identity.png");
const secondFixturePath = resolve(artifacts, "identity-replacement.png");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=",
  "base64",
);
writeFileSync(fixturePath, png);
writeFileSync(secondFixturePath, png);
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${script.replaceAll("</script", "<\\/script")}</script></body></html>`;
const pagePath = resolve(artifacts, "index.html");
writeFileSync(pagePath, html);

const driver = spawn(
  process.env.CHROMEDRIVER_BINARY ?? "/usr/bin/chromedriver",
  [
    `--port=${port}`,
    `--log-path=${resolve(artifacts, "chromedriver.log")}`,
    "--allowed-ips=127.0.0.1",
  ],
  {
    stdio: "ignore",
    env: {
      ...process.env,
      CHROME_LOG_FILE: resolve(artifacts, "chrome.log"),
      TMPDIR: temporaryDirectory,
    },
  },
);

const driverOrigin = `http://127.0.0.1:${port}`;
async function command(method, path, body) {
  const response = await fetch(`${driverOrigin}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) {
    throw new Error(`${path}: ${payload.value?.message ?? response.status}`);
  }
  return payload.value;
}

async function waitForDriver() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${driverOrigin}/status`);
      return;
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  throw new Error("ChromeDriver did not start.");
}

let sessionPath;
try {
  await waitForDriver();
  const session = await command("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        "goog:chromeOptions": {
          binary: process.env.CHROMIUM_BINARY ?? "/usr/bin/chromium",
          args: [
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--allow-file-access-from-files",
            "--window-size=390,950",
            `--user-data-dir=${profileDirectory}`,
            `--crash-dumps-dir=${artifacts}`,
          ],
        },
      },
    },
  });
  sessionPath = `/session/${session.sessionId}`;
  const js = (source, args = []) =>
    command("POST", `${sessionPath}/execute/sync`, { script: source, args });
  const go = (path) => command("POST", `${sessionPath}/url`, { url: path });

  async function element(selector) {
    const result = await command("POST", `${sessionPath}/element`, {
      using: "css selector",
      value: selector,
    });
    return `${sessionPath}/element/${result["element-6066-11e4-a52e-4f735466cecf"]}`;
  }

  async function clickText(text) {
    await js(
      `const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === arguments[0] && !item.disabled); if (!button) throw new Error("Button not found: " + arguments[0]); button.click();`,
      [text],
    );
  }

  async function until(check, label) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await check()) return;
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error(`Timed out waiting for ${label}. Text: ${await js("return document.body.innerText")}; Focus: ${await js("return document.activeElement.outerHTML")}`);
  }

  await go(`file://${pagePath}`);
  await until(() => js('return Boolean(document.querySelector("#id-image-heading"))'), "ID image section");
  assert.match(await js("return document.body.innerText"), /ID image \(optional\)/);
  assert.match(await js("return document.body.innerText"), /Smaller than 10 MB/);
  assert.equal(await js('return Boolean(document.querySelector("img[alt=\'Your saved ID image\']"))'), false);

  await command("POST", `${await element('input[name="id_image"]')}/value`, { text: fixturePath });
  await until(() => js('return Boolean(document.querySelector("img[alt=\'Selected ID image preview\']"))'), "local preview");
  assert.equal(await js('return document.querySelector("button[type=submit]").disabled'), false);
  await clickText("Upload image");
  await until(() => js('return Boolean(document.querySelector("img[alt=\'Your saved ID image\']"))'), "saved image after upload");
  await until(() => js('return document.activeElement.getAttribute("role") === "status"'), "success feedback focus");
  assert.match(await js("return document.body.innerText"), /ID image uploaded successfully/);
  assert.deepEqual(await js("return window.idImageMock.uploads[0]"), { name: "identity.png", type: "image/png", size: png.length });
  assert.equal(await js("return window.revokeCalls.length"), 1);

  await command("POST", `${await element('input[name="id_image"]')}/value`, { text: secondFixturePath });
  await until(() => js('return Boolean(document.querySelector("img[alt=\'Selected ID image preview\']"))'), "replacement preview");
  await js('window.idImageMock.mode = "failure";');
  await clickText("Upload image");
  await until(() => js('return document.body.innerText.includes("The server rejected this image.")'), "recoverable upload error");
  await until(() => js('return document.activeElement.getAttribute("role") === "alert"'), "validation error focus");
  assert.equal(await js('return Boolean(document.querySelector("img[alt=\'Selected ID image preview\']"))'), true);
  assert.equal(await js('return document.querySelector("img[alt=\'Your saved ID image\']").getAttribute("src")'), "/api/v1/customer/account/id-image?v=1");

  await js('window.idImageMock.mode = "pending";');
  await clickText("Upload image");
  await until(() => js('return document.querySelector("progress")?.value === 42'), "upload progress");
  await js('window.idImageMock.resolveUpload({ message: "ID image uploaded successfully.", account: { id: "customer-fixture", profile: { idImageUrl: "/api/v1/customer/account/id-image?v=2" } } });');
  await until(() => js('return document.querySelector("img[alt=\'Your saved ID image\']")?.getAttribute("src")?.endsWith("v=2")'), "replacement saved");

  for (const width of [320, 390, 768, 1440]) {
    await command("POST", `${sessionPath}/goog/cdp/execute`, {
      cmd: "Emulation.setDeviceMetricsOverride",
      params: { width, height: 950, deviceScaleFactor: 1, mobile: width < 768 },
    });
    assert.equal(await js("return document.documentElement.scrollWidth <= innerWidth + 2"), true, `overflow at ${width}px`);
  }
  await command("POST", `${sessionPath}/goog/cdp/execute`, {
    cmd: "Emulation.setDeviceMetricsOverride",
    params: { width: 390, height: 950, deviceScaleFactor: 1, mobile: true },
  });

  await clickText("Remove");
  assert.match(await js("return document.body.innerText"), /Remove ID image\?/);
  await clickText("Cancel");
  assert.equal(await js('return Boolean(document.querySelector("img[alt=\'Your saved ID image\']"))'), true);
  await clickText("Remove");
  await clickText("Remove image");
  await until(() => js('return Boolean(document.querySelector("img[alt=\'Your saved ID image\']")) === false && document.body.innerText.includes("ID image removed successfully.")'), "confirmed removal");
  assert.equal(await js("return window.idImageMock.removals"), 1);

  assert.deepEqual(await js("return window.errors"), []);
  console.log("Account ID image browser passed: selection, preview, upload progress, success/error focus, failed-upload preservation, replacement, confirmed removal, and 320/390/768/1440px overflow.");
} finally {
  if (sessionPath) await command("DELETE", sessionPath).catch(() => {});
  driver.kill();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
