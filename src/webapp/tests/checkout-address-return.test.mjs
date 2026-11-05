import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/checkout/address-return.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { saveAddressReturn, takeAddressReturn, clearAddressReturn } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const values = new Map();
globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
const intent = { mode: 'buy_now', productId: 'product', variantId: null, quantity: 1 };
const review = { customerId: 'customer', intent, vouchers: [{ voucher_id: 'voucher', target_shop_id: 'shop' }], logistics: { shop: 'provider' } };

test('retains review IDs for one return and requires the same customer and intent', () => {
  saveAddressReturn(review);
  assert.deepEqual(takeAddressReturn('customer', intent), review);
  assert.equal(takeAddressReturn('customer', intent), null);
  saveAddressReturn(review);
  assert.equal(takeAddressReturn('other', intent), null);
  saveAddressReturn(review);
  assert.equal(takeAddressReturn('customer', { ...intent, quantity: 2 }), null);
  saveAddressReturn(review);
  clearAddressReturn();
  assert.equal(takeAddressReturn('customer', intent), null);
});
