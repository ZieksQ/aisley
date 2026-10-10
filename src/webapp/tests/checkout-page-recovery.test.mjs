// Read-only reproduction: executes functions extracted from the actual TSX.
// All transport and React state are synthetic; no application files are written.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const ts = require('typescript');
const controllerSource = readFileSync(new URL('src/lib/checkout/placement.ts', root), 'utf8');
const controllerJs = ts.transpileModule(controllerSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createPlacementController } = await import(`data:text/javascript;base64,${Buffer.from(controllerJs).toString('base64')}`);
const source = readFileSync(new URL('src/components/checkout/checkout-page-content.tsx', root), 'utf8');
const ast = ts.createSourceFile('checkout.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const printer = ts.createPrinter();
function extract(name, env) {
  let found;
  function visit(node) {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `Source function ${name} exists`);
  const expression = ts.isFunctionDeclaration(found) ? found : found.initializer.arguments[0];
  const text = printer.printNode(ts.EmitHint.Unspecified, expression, ast);
  const program = ts.isFunctionDeclaration(found) ? text : `const ${name} = ${text};`;
  const js = ts.transpileModule(program, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('env', `with (env) { ${js}; return ${name}; }`)(env);
}
function fixture() {
  const requests = [];
  const store = new Map();
  const checkoutPlacement = createPlacementController(() => ({
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
    removeItem: key => store.delete(key),
  }));
  let quoteNumber = 0;
  const env = {
    crypto: webcrypto, checkoutPlacement, customerId: "customer", placementBusy: { current: false }, activeCustomer: { current: "customer" },
    ApiError: class ApiError extends Error {},
    intent: { mode: 'buy_now', productId: 'product', variantId: null, quantity: 1 },
    selectedAddressId: 'address', selectedVouchers: [], selectedLogistics: { shop: 'provider' },
    quote: { quoteId: 'original-quote' }, status: 'ready',
    quoteSequence: { current: 0 }, idempotencyKey: { current: null },
    setStatus(value) { env.status = value; },
    setMessage() {}, setQuote(value) { env.quote = value; },
    setSelectedVouchers(value) { env.selectedVouchers = value; },
    setSelectedLogistics(value) { env.selectedLogistics = value; },
    setLogisticsOptions() {}, setAddresses() {},
    quoteCheckout: async () => ({ quoteId: `new-quote-${++quoteNumber}` }),
    fetchCheckoutLogisticsOptions: async () => ({ groups: [{ shop: { id: 'shop' }, options: [{ organizationId: 'provider' }] }] }),
    payload: (intent, address, vouchers, logistics) => ({ ...intent, address, vouchers, logistics }),
    logisticsSelectionList: selected => Object.entries(selected).map(([shop_id, logistics_organization_id]) => ({ shop_id, logistics_organization_id })),
    clearCheckoutIntent() {}, refreshCart: async () => {}, router: { replace() {} },
    placeCheckout: async (payload, key) => { requests.push({ payload, key }); throw new TypeError('Lost response'); },
  };
  env.loadQuote = extract('loadQuote', env);
  env.loadShippingOptions = extract('loadShippingOptions', env);
  env.placeOrder = extract('placeOrder', env);
  env.toggleVoucher = extract('toggleVoucher', env);
  env.selectLogisticsProvider = extract('selectLogisticsProvider', env);
  return { env, requests };
}

test('uncertain placement blocks shipping refresh and retries the original request', async () => {
  const { env, requests } = fixture();
  await env.placeOrder();
  const first = requests[0];
  assert.equal(env.status, 'uncertain');
  await env.toggleVoucher({ id: 'voucher', eligible: true }, 'shop');
  await env.selectLogisticsProvider('shop', 'different-provider');
  assert.deepEqual(env.selectedVouchers, []);
  assert.equal(env.selectedLogistics.shop, 'provider');
  await env.loadShippingOptions(env.intent, env.selectedAddressId, env.selectedVouchers, env.selectedLogistics);
  assert.equal(env.quote.quoteId, "original-quote");
  await env.placeOrder();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].key, first.key);
  assert.deepEqual(requests[1].payload, first.payload);
});

test('shipping refresh and repeated Place cannot bypass in-flight placement', async () => {
  const { env, requests } = fixture();
  let resolveFirst;
  env.placeCheckout = async (payload, key) => {
    requests.push({ payload, key });
    if (requests.length === 1) return new Promise(resolve => { resolveFirst = resolve; });
    return { id: 'second-batch' };
  };
  const firstFlight = env.placeOrder();
  assert.equal(env.status, 'placing');
  await env.loadShippingOptions(env.intent, env.selectedAddressId, env.selectedVouchers, env.selectedLogistics);
  assert.equal(env.status, 'placing');
  await env.placeOrder();
  assert.equal(requests.length, 1);
  resolveFirst({ id: 'first-batch' });
  await firstFlight;
});


test('late placement completion after leaving checkout does not navigate or clear recovery', async () => {
  const { env } = fixture();
  let finish;
  env.placeCheckout = () => new Promise(resolve => { finish = resolve; });
  let navigated = false;
  env.router.replace = () => { navigated = true; };
  const flight = env.placeOrder();
  await Promise.resolve();
  env.activeCustomer.current = null;
  finish({ id: 'batch' });
  await flight;
  assert.equal(navigated, false);
  assert.ok(env.checkoutPlacement.read('customer'));
});
