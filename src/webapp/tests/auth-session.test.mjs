import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}
const { createSessionController } = await import(await moduleUrl("../src/lib/auth/session-controller.ts"));
const eventsUrl = await moduleUrl("../src/lib/auth/session-events.ts");
const events = await import(eventsUrl);
const { apiRequest, apiBlobRequest, ApiError } = await import(await moduleUrl("../src/lib/api.ts", {
  '"./auth/session-events"': JSON.stringify(eventsUrl),
}));
const { isProtectedCustomerPath, safeReturnPath } = await import(await moduleUrl("../src/lib/auth/navigation.ts"));
const customer = { id: "customer-1", role: "customer", status: "active", displayName: "Customer", avatarUrl: null };
const invalid = (error) => events.isInvalidSession(error.status, error.code);
function controller(load) { return createSessionController(load, invalid, () => {}); }
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("startup is deduplicated and guest navigation does not check again", async () => {
  let calls = 0;
  const request = deferred();
  const session = controller(() => { calls += 1; return request.promise; });
  const first = session.start();
  assert.equal(session.start(), first);
  assert.equal(session.refresh(), first);
  request.reject({ status: 401 });
  await first;
  for (let i = 0; i < 5; i += 1) await session.start();
  assert.equal(calls, 1);
  assert.equal(session.getSnapshot().status, "guest");
});

test("authenticated session is reused across startup/navigation calls", async () => {
  let calls = 0;
  const session = controller(async () => { calls += 1; return customer; });
  await session.start();
  await session.start();
  assert.equal(calls, 1);
  assert.deepEqual(session.getSnapshot(), { status: "authenticated", customer });
});

test("startup network/5xx/rate-limit/CSRF errors remain unresolved and retry succeeds", async () => {
  for (const error of [new TypeError("offline"), { status: 500 }, { status: 429 }, { status: 419 }]) {
    let fail = true;
    const session = controller(async () => { if (fail) throw error; return customer; });
    await session.start();
    assert.equal(session.getSnapshot().status, "loading");
    assert.match(session.getSnapshot().error, /try again/);
    fail = false;
    await session.refresh();
    assert.equal(session.getSnapshot().status, "authenticated");
  }
});

test("temporary revalidation failures do not discard a known session", async () => {
  const session = controller(async () => { throw { status: 503 }; });
  session.setCustomer(customer);
  await session.refresh();
  assert.equal(session.getSnapshot().status, "authenticated");
});

test("confirmed expiry and account/role denial clear authentication", async () => {
  for (const error of [{ status: 401 }, { status: 403, code: "ACCOUNT_SUSPENDED" }, { status: 403, code: "FORBIDDEN_ROLE" }]) {
    const session = controller(async () => { throw error; });
    session.setCustomer(customer);
    await session.refresh();
    assert.equal(session.getSnapshot().status, "guest");
  }
  const session = controller(async () => ({ ...customer, role: "seller" }));
  await session.start();
  assert.equal(session.getSnapshot().status, "guest");
});

test("a late startup failure cannot overwrite successful login", async () => {
  const request = deferred();
  const session = controller(() => request.promise);
  const first = session.start();
  session.setCustomer(customer);
  request.reject({ status: 401 });
  await first;
  assert.equal(session.getSnapshot().status, "authenticated");
});

test("a late /me success cannot resurrect a logged-out session", async () => {
  const request = deferred();
  const session = controller(() => request.promise);
  const first = session.start();
  session.clear();
  request.resolve(customer);
  await first;
  assert.equal(session.getSnapshot().status, "guest");
});

test("ordinary forbidden resource errors do not end the session", async () => {
  const session = controller(async () => { throw { status: 403 }; });
  session.setCustomer(customer);
  await session.refresh();
  assert.equal(session.getSnapshot().status, "authenticated");
  assert.equal(events.isInvalidSession(403, "FORBIDDEN"), false);
});

test("shared API reports expiry, distinguishes CSRF and ignores stale/public auth failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.document = { cookie: "" };
  const failures = [];
  const unsubscribe = events.subscribeToSessionFailures((failure) => failures.push(failure));
  try {
    for (const [status, code, expected] of [[401, undefined, "invalid"], [403, "ACCOUNT_INACTIVE", "invalid"], [419, undefined, "recheck"], [403, undefined, undefined], [503, undefined, undefined]]) {
      failures.length = 0;
      globalThis.fetch = async () => new Response(JSON.stringify({ code }), { status });
      await assert.rejects(apiRequest("/api/v1/customer/orders"), ApiError);
      assert.deepEqual(failures, expected ? [expected] : []);
    }
    for (const path of ["/api/v1/customer/auth/login", "/api/v1/customer/auth/me", "/api/v1/seller/orders"]) {
      failures.length = 0;
      globalThis.fetch = async () => new Response("{}", { status: 401 });
      await assert.rejects(apiRequest(path), ApiError);
      assert.deepEqual(failures, []);
    }
    const request = deferred();
    globalThis.fetch = () => request.promise;
    const pending = apiRequest("/api/v1/customer/orders");
    events.advanceSessionRevision();
    request.resolve(new Response("{}", { status: 401 }));
    await assert.rejects(pending, ApiError);
    assert.deepEqual(failures, []);
    globalThis.fetch = async () => new Response("{}", { status: 401 });
    await assert.rejects(apiBlobRequest("/api/v1/customer/account/profile-photo"), ApiError);
    assert.deepEqual(failures, ["invalid"]);
  } finally {
    unsubscribe();
    globalThis.fetch = originalFetch;
    delete globalThis.document;
  }
});

test("protected routes are segment-aware and login return URLs stay local", () => {
  for (const path of ["/account/profile", "/cart", "/checkout/result/1", "/orders/1", "/notifications/1", "/messages"]) {
    assert.equal(isProtectedCustomerPath(path), true);
  }
  for (const path of ["/", "/bazaar", "/products/1", "/accounting", "/shops"]) {
    assert.equal(isProtectedCustomerPath(path), false);
  }
  for (const path of ["https://example.com", "//example.com", "/\\example.com", "/\n/example.com"]) {
    assert.equal(safeReturnPath(path), "/");
  }
  assert.equal(safeReturnPath("/account/addresses?returnTo=%2Fcheckout"), "/account/addresses?returnTo=%2Fcheckout");
});

test("a session change in another tab clears old identity before revalidation", async () => {
  const request = deferred();
  const session = controller(() => request.promise);
  session.setCustomer(customer);
  session.reset();
  assert.equal(session.getSnapshot().status, "loading");
  const refresh = session.refresh();
  request.resolve({ ...customer, id: "customer-2" });
  await refresh;
  assert.equal(session.getSnapshot().customer.id, "customer-2");
});
