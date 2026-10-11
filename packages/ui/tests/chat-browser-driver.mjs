import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Uses an existing Chromium-family installation. No downloaded browser or dependency.
export async function openChatBrowser() {
  const artifacts = resolve("node_modules/.cache/messages-ui");
  const temporaryDirectory = resolve(".next/mu");
  mkdirSync(temporaryDirectory, { recursive: true });
  const browser = spawn(process.env.CHROMIUM_BINARY ?? "/opt/brave.com/brave/brave", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--disable-breakpad", "--disable-crash-reporter", "--remote-debugging-pipe",
    `--user-data-dir=${artifacts}/test-profile`, `--crash-dumps-dir=${artifacts}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], env: { ...process.env, TMPDIR: temporaryDirectory } });
  let nextId = 0;
  let buffer = "";
  let diagnostics = "";
  const pending = new Map();
  const errors = [];
  browser.stderr.on("data", data => { diagnostics += data; });
  for (const pipe of [browser.stdio[3], browser.stdio[4]]) pipe.on("error", error => { diagnostics += error.message; });
  browser.on("exit", (code, signal) => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(`Browser exited ${code}/${signal}: ${diagnostics.slice(-2000)}`));
    }
    pending.clear();
  });
  browser.stdio[4].on("data", data => {
    buffer += data;
    let end;
    while ((end = buffer.indexOf("\0")) !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      if (pending.has(message.id)) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(request.timer);
        message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
      }
    }
  });
  function send(method, params = {}, sessionId) {
    return new Promise((yes, no) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); no(new Error(`${method} timed out: ${diagnostics.slice(-1000)}`)); }, 30000);
      pending.set(id, { resolve: yes, reject: no, timer });
      browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0");
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function until(expression, label) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(yes => setTimeout(yes, 100));
    }
    throw new Error(`Timed out: ${label}; ${JSON.stringify(errors)}`);
  }
  async function screenshot(path) {
    const result = await cdp("Page.captureScreenshot", { format: "png" });
    writeFileSync(path, Buffer.from(result.data, "base64"));
  }
  return {
    cdp, evaluate, until, screenshot, errors,
    navigate: url => cdp("Page.navigate", { url }),
    viewport: (width, height = 850, mobile = width < 800) => cdp("Emulation.setDeviceMetricsOverride", { width, height, mobile, deviceScaleFactor: 1 }),
    close: () => browser.kill(),
  };
}
