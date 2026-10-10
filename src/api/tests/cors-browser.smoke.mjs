// Requires installed PHP dependencies and Chromium. Synthetic transport only;
// exercises the checked-in CORS configuration and Laravel HandleCors middleware.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const artifacts = resolve(repo, "src/api/storage/framework/testing/cors-browser");
const temporaryDirectory = resolve(repo, ".next/b5");
mkdirSync(artifacts, { recursive: true });
mkdirSync(temporaryDirectory, { recursive: true });

const servers = [];
const processes = [];
let diagnostics = "";
let nextId = 0;
let buffer = "";
const pending = new Map();

async function listen(server, port) {
  servers.push(server);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server.address().port;
}

try {
  // Reserve an ephemeral port, then hand it to PHP's isolated fixture server.
  const reservation = createServer();
  const apiPort = await listen(reservation, 0);
  await new Promise(resolve => reservation.close(resolve));
  const fixtureEnvironment = { ...process.env };
  delete fixtureEnvironment.CORS_ALLOWED_ORIGINS;
  const php = spawn(process.env.PHP_BINARY ?? "php", [
    "-S", `127.0.0.1:${apiPort}`, "src/api/tests/Support/cors-browser-router.php",
  ], { cwd: repo, env: fixtureEnvironment, stdio: ["ignore", "ignore", "pipe"] });
  processes.push(php);
  php.stderr.on("data", data => { diagnostics += data.toString(); });
  php.on("error", error => { diagnostics += error.message; });

  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/v1/cors-browser`);
      if (response.status === 429) { ready = true; break; }
    } catch { /* Server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `PHP fixture did not start: ${diagnostics.slice(-1000)}`);

  for (const port of [8765, 8766, 8767]) {
    await listen(createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<!doctype html><title>CORS fixture</title>");
    }), port);
  }

  const browser = spawn(process.env.CHROMIUM_BINARY ?? "/usr/bin/chromium", [
    "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--disable-breakpad", "--disable-crash-reporter", "--remote-debugging-pipe",
    `--user-data-dir=${artifacts}/profile`, `--crash-dumps-dir=${artifacts}`, "about:blank",
  ], {
    cwd: repo, env: { ...process.env, TMPDIR: temporaryDirectory },
    stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"],
  });
  processes.push(browser);
  browser.stderr.on("data", data => { diagnostics += data.toString(); });
  function rejectPending(error) {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    pending.clear();
  }
  browser.on("error", rejectPending);
  browser.on("exit", code => rejectPending(new Error(`Chromium exited ${code}: ${diagnostics.slice(-1000)}`)));
  for (const pipe of [browser.stdio[3], browser.stdio[4]]) pipe.on("error", rejectPending);
  browser.stdio[4].on("data", data => {
    buffer += data.toString();
    let end;
    while ((end = buffer.indexOf("\0")) !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}; ${diagnostics.slice(-1000)}`));
      }, 10000);
      pending.set(id, { resolve, reject, timeout });
      browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0");
    });
  }

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const command = (method, params) => send(method, params, sessionId);
  await command("Page.enable");
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function navigate(origin) {
    await command("Page.navigate", { url: origin });
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(`location.origin === ${JSON.stringify(origin)} && document.readyState === "complete"`)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Navigation did not finish: ${origin}`);
  }

  let cases = 0;
  for (const port of [8765, 8766]) {
    await navigate(`http://localhost:${port}`);
    for (const [format, expected] of [["seconds", "60"], ["date", "Wed, 21 Oct 2026 07:28:00 GMT"]]) {
      for (const method of ["GET", "POST", "PATCH"]) {
        const url = `http://127.0.0.1:${apiPort}/api/v1/cors-browser?format=${format}`;
        const result = await evaluate(`(async () => {
          const response = await fetch(${JSON.stringify(url)}, {
            method: ${JSON.stringify(method)}, credentials: "include",
            headers: ${JSON.stringify(method === "GET" ? {} : {
              "Content-Type": "application/json", Authorization: "Bearer synthetic-fixture",
              "Idempotency-Key": "synthetic-fixture",
            })},
            ${method === "GET" ? "" : 'body: "{}",'}
          });
          return { status: response.status, delay: response.headers.get("retry-after"),
            hidden: response.headers.get("x-unexposed-fixture") };
        })()`);
        assert.deepEqual(result, { status: 429, delay: expected, hidden: null });
        cases++;
      }
    }
  }
  await navigate("http://localhost:8767");
  const denied = await evaluate(`fetch("http://127.0.0.1:${apiPort}/api/v1/cors-browser")
    .then(() => false, error => error instanceof TypeError)`);
  assert.equal(denied, true);
  console.log(`Passed ${cases} approved-origin browser header checks and 1 rejected-origin check.`);
} finally {
  for (const request of pending.values()) clearTimeout(request.timeout);
  for (const child of processes) child.kill();
  await Promise.all(servers.filter(server => server.listening)
    .map(server => new Promise(resolve => server.close(resolve))));
}
