import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/checkout/placement.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { createPlacementController } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}
const draft = () => ({
  intent: { mode: "buy_now", productId: "product", variantId: null, quantity: 1 },
  payload: { mode: "buy_now", buy_now: { product_id: "product", variant_id: null, quantity: 1 }, address_id: "address", payment_method: "cod", vouchers: [], logistics_selections: [{ shop_id: "shop", logistics_organization_id: "provider" }], quote_id: "quote" },
});

test("lost response after commit replays the exact purchase across reload and changed draft", async () => {
  const store = storage();
  let controller = createPlacementController(() => store);
  const purchases = new Map();
  const requests = [];
  const send = async (payload, key) => {
    requests.push({ payload: structuredClone(payload), key });
    if (!purchases.has(key)) {
      purchases.set(key, { id: "batch" });
      throw new TypeError("response lost after commit");
    }
    return purchases.get(key);
  };
  await assert.rejects(controller.submit("customer", draft(), send));
  controller = createPlacementController(() => store);
  const changed = draft();
  changed.payload.quote_id = "new-quote";
  changed.payload.buy_now.quantity = 2;
  assert.deepEqual(await controller.submit("customer", changed, send), { id: "batch" });
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(purchases.size, 1);
});

test("in-flight placement is recorded synchronously and concurrent calls share one request", async () => {
  const store = storage();
  const shared = createPlacementController(() => store);
  let finish;
  let calls = 0;
  const original = draft();
  const first = shared.submit("customer", original, () => {
    calls++;
    return new Promise((resolve) => { finish = resolve; });
  });
  assert.ok(shared.read("customer"));
  original.payload.buy_now.quantity = 10;
  assert.equal(shared.read("customer").payload.buy_now.quantity, 1);
  assert.equal(shared.submit("customer", draft(), () => { throw Error("duplicate"); }), first);
  await Promise.resolve();
  finish({ id: "batch" });
  await first;
  assert.equal(calls, 1);
});

for (const failure of [
  { status: 409, code: "IDEMPOTENCY_KEY_REUSED" },
  { status: 409, code: "QUOTE_ALREADY_PLACED" },
  { status: 409, code: "UNKNOWN" },
  { status: 429 }, { status: 500 }, { status: 503 }, { status: 422 },
]) {
  test(`retains exact identity after ${failure.status}/${failure.code ?? "error"}`, async () => {
    const store = storage();
    const controller = createPlacementController(() => store);
    await assert.rejects(controller.submit("customer", draft(), async () => { throw failure; }));
    const pending = controller.read("customer");
    await assert.rejects(controller.submit("customer", null, async (payload, key) => {
      assert.deepEqual(payload, pending.payload);
      assert.equal(key, pending.key);
      throw failure;
    }));
    assert.deepEqual(controller.read("customer"), pending);
  });
}

for (const code of ["QUOTE_EXPIRED", "QUOTE_STALE", "QUOTE_INPUT_CHANGED"]) {
  test(`${code} permits refresh only after server reconciliation`, async () => {
    const store = storage();
    const controller = createPlacementController(() => store);
    await assert.rejects(controller.submit("customer", draft(), async () => { throw new TypeError("offline"); }));
    const pending = controller.read("customer");
    await assert.rejects(controller.submit("customer", null, async (payload, key) => {
      assert.equal(key, pending.key);
      assert.deepEqual(payload, pending.payload);
      throw { status: 409, code };
    }));
    assert.equal(controller.read("customer"), null);
  });
}

test("account changes and explicit logout clear stored recovery", async () => {
  const store = storage();
  const controller = createPlacementController(() => store);
  await assert.rejects(controller.submit("customer", draft(), async () => { throw Error("offline"); }));
  assert.equal(controller.read("different-customer"), null);
  assert.equal(controller.read("customer"), null);
  await assert.rejects(controller.submit("customer", draft(), async () => { throw Error("offline"); }));
  controller.clear();
  assert.equal(controller.read("customer"), null);
});

test("unavailable storage prevents sending a purchase", () => {
  const controller = createPlacementController(() => ({ getItem: () => null, setItem: () => { throw Error("storage blocked"); } }));
  let sent = false;
  assert.throws(() => controller.submit("customer", draft(), async () => { sent = true; }));
  assert.equal(sent, false);
});

test("logout before queued transport prevents sending with a changed session", async () => {
  const store = storage();
  const controller = createPlacementController(() => store);
  let sent = false;
  const request = controller.submit("customer", draft(), async () => { sent = true; });
  controller.clear();
  await assert.rejects(request, /session changed/);
  assert.equal(sent, false);
});

test("a departed customer's late conflict cannot clear another customer's recovery", async () => {
  const store = storage();
  const controller = createPlacementController(() => store);
  let rejectOld;
  const old = controller.submit("customer", draft(), () => new Promise((resolve, reject) => { rejectOld = reject; }));
  await Promise.resolve();
  controller.clear();
  await assert.rejects(controller.submit("other-customer", draft(), async () => { throw Error("offline"); }));
  const current = controller.read("other-customer");
  rejectOld({ status: 409, code: "QUOTE_STALE" });
  await assert.rejects(old);
  assert.deepEqual(controller.read("other-customer"), current);
});

test("malformed success responses remain unresolved and preserve exact retry", async () => {
  const store = storage();
  const controller = createPlacementController(() => store);
  await assert.rejects(controller.submit("customer", draft(), async () => undefined), /confirmation/);
  const pending = controller.read("customer");
  const batch = await controller.submit("customer", null, async (payload, key) => {
    assert.equal(key, pending.key);
    assert.deepEqual(payload, pending.payload);
    return { id: "confirmed-batch" };
  });
  assert.equal(batch.id, "confirmed-batch");
});
