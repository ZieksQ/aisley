import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", js)(name => mocks[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
}
const { canCorrectOrderContact, isCurrentOrderAddress } = load("../src/lib/orders/address-correction.ts");
const { Button } = load("../../../packages/ui/src/button.tsx");
const { OrderContactDialog } = load("../src/components/orders/order-contact-dialog.tsx", {
  "@aisley/ui": { Button },
  "@/lib/orders/address-correction": { isCurrentOrderAddress },
  "@/lib/orders/format": load("../src/lib/orders/format.ts"),
  "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
});
const current = {
  version: 1, recipientName: "Ada Buyer", contactNumber: "09171234567",
  addressLine1: "123 Test Street", addressLine2: null, barangay: "San Antonio",
  cityMunicipality: "Makati City", province: "Metro Manila", region: "NCR",
  postalCode: "1203", country: "Philippines", latitude: null, longitude: null,
};
const selected = { ...current, id: "address", type: "shipping", label: "Home", recipientName: "Ada Corrected" };

test("contact-only corrections accept shipping/both rows and optional-line equivalence", () => {
  assert.equal(canCorrectOrderContact(current, selected), true);
  assert.equal(canCorrectOrderContact(current, { ...selected, type: "both", addressLine1: " 123 Test Street ", addressLine2: " " }), true);
  assert.equal(canCorrectOrderContact(current, { ...selected, recipientName: current.recipientName, contactNumber: "09179876543" }), true);
  assert.equal(canCorrectOrderContact(current, { ...selected, recipientName: " Ada Buyer " }), false);
  assert.equal(canCorrectOrderContact(current, { ...selected, type: "billing" }), false);
  assert.equal(canCorrectOrderContact(current, { ...selected, contactNumber: " " }), false);
});

test("every location field and unverifiable snapshots block the correction selector", () => {
  for (const field of ["addressLine1", "addressLine2", "barangay", "cityMunicipality", "province", "region", "postalCode", "country"]) {
    assert.equal(canCorrectOrderContact(current, { ...selected, [field]: "Another location" }), false, field);
    if (field !== "addressLine2") {
      assert.equal(canCorrectOrderContact({ ...current, [field]: " " }, { ...selected, [field]: " " }), false, `incomplete ${field}`);
    }
  }
});

test("coordinates must match at storage precision, including absent and partial pairs", () => {
  const pin = { latitude: "14.5000000", longitude: "121.1000000" };
  assert.equal(canCorrectOrderContact({ ...current, ...pin }, { ...selected, latitude: "14.5", longitude: "121.1" }), true);
  for (const changes of [
    { latitude: "14.5000001" }, { longitude: "121.1000001" },
    { latitude: null, longitude: null }, { longitude: null },
    { latitude: "NaN" }, { latitude: "91" }, { latitude: "" },
  ]) assert.equal(canCorrectOrderContact({ ...current, ...pin }, { ...selected, ...pin, ...changes }), false);
  assert.equal(canCorrectOrderContact(current, { ...selected, ...pin }), false);
  assert.equal(canCorrectOrderContact({ ...current, latitude: "14.5" }, selected), false);
  assert.equal(canCorrectOrderContact({ ...current, latitude: undefined, longitude: undefined }, selected), false);
});

function dialog(overrides = {}) {
  return renderToStaticMarkup(createElement(OrderContactDialog, {
    reference: "ASL-TEST", currentAddress: current, quote: null, addresses: [selected], loading: false, busy: false,
    uncertain: false, selectedId: selected.id, error: null, fieldError: null,
    onSelect() {}, onClose() {}, onSubmit() {}, ...overrides,
  }));
}
test("address form offers saved destinations, recipient/phone and review", () => {
  const html = dialog();
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /aria-describedby="order-contact-help"/);
  assert.match(html, /Select a saved shipping address/);
  assert.match(html, /Ada Corrected · 09171234567/);
  assert.match(html, /Review delivery total/);
  assert.doesNotMatch(html, /<button[^>]* disabled=""/);
});
test("loading, empty and failed address discovery remain distinguishable", () => {
  assert.match(dialog({ loading: true, addresses: [], selectedId: null }), /role="status"[^>]*>Loading saved addresses/);
  const empty = dialog({ addresses: [], selectedId: null });
  assert.match(empty, /No saved shipping addresses are available/);
  assert.doesNotMatch(empty, /href="\/account\/addresses"/);
  assert.match(empty, /<button[^>]*disabled[^>]*>Review delivery total/);
  const failed = dialog({ addresses: [], selectedId: null, error: "Could not load addresses" });
  assert.match(failed, /role="alert"[^>]*>Could not load addresses/);
  assert.doesNotMatch(failed, /No saved shipping addresses/);
});
test("pending and uncertain corrections lock editing; uncertain outcome permits only exact retry", () => {
  assert.match(dialog({ busy: true }), /<fieldset[^>]*disabled/);
  assert.match(dialog({ busy: true }), /Updating…/);
  const html = dialog({ uncertain: true, fieldError: "Select a matching address" });
  assert.match(html, /<fieldset[^>]*disabled/);
  assert.match(html, /aria-describedby="order-contact-field-error"/);
  assert.match(html, /<button[^>]*disabled[^>]*>Keep current address/);
  assert.match(html, /<button(?![^>]* disabled="")[^>]*>Retry original change/);
});

class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; this.errors = { address_id: [code] }; }
}
function workflow() {
  const slots = [];
  const effects = [];
  let index = 0;
  const hooks = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], value => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }];
    },
    useRef(initial) {
      const slot = index++;
      slots[slot] ??= { current: initial };
      return slots[slot];
    },
    useEffect(callback) { const slot = index++; effects[slot] ??= callback(); },
  };
  const requests = [];
  const quote = { quoteId: "quote-1", expiresAt: "2099-01-01T00:00:00Z", expectedRevision: 1,
    address: selected, shippingProvider: { id: "provider", businessName: "Provider" },
    previous: { shippingFee: "10.00", shippingDiscount: "0.00", payable: "110.00", currency: "PHP" },
    proposed: { shippingFee: "20.00", shippingDiscount: "0.00", payable: "120.00", currency: "PHP" } };
  const client = {
    quoteOrderAddress: async () => quote,
    fetchOrder: async () => ({ ...props.order, deliveryAddress: { ...current, version: 2 } }),
    orderMutationKey: () => "original-key",
    modifyOrderAddress: async (...request) => { requests.push(request); throw new TypeError("lost response"); },
  };
  const api = { fetchAddresses: async () => [selected, { ...selected, id: "wrong", postalCode: "9999" }] };
  const { OrderContactCorrection } = load("../src/components/orders/order-contact-correction.tsx", {
    react: hooks, "@aisley/ui": { Button }, "@/lib/api": { ApiError },
    "@/lib/checkout/client": api, "@/lib/orders/address-correction": { isCurrentOrderAddress },
    "@/lib/orders/client": client, "./order-contact-dialog": { OrderContactDialog },
  });
  const props = {
    order: { id: "order", reference: "ASL-TEST", deliveryAddress: current }, disabled: false,
    onBusyChange: busy => { props.disabled = busy; },
    onUpdated: order => { props.order = order; }, onSuccess() {},
  };
  const render = () => { index = 0; return OrderContactCorrection(props).props.children; };
  return { client, api, requests, quote, props, render, unmount() { for (const cleanup of effects) cleanup?.(); } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });

test("workflow permits destination changes and freezes the key, address and revision after lost response", async () => {
  const state = workflow();
  state.render()[0].props.onClick(); await tick();
  let form = state.render()[1].props;
  assert.deepEqual(form.addresses.map(row => row.id), ["address", "wrong"]);
  form.onSelect("address");
  state.render()[1].props.onSubmit(); await tick();
  assert.equal(state.requests.length, 0, "Review must not mutate the Order");
  assert.equal(state.render()[1].props.quote.quoteId, "quote-1");
  state.render()[1].props.onSubmit(); await tick();
  assert.equal(state.props.disabled, true);
  form = state.render()[1].props;
  assert.equal(form.uncertain, true);
  form.onSelect("different"); form.onClose();
  state.props.order = { ...state.props.order, deliveryAddress: { ...current, version: 9 } };
  state.client.modifyOrderAddress = async (...args) => { state.requests.push(args); return state.props.order; };
  state.render()[1].props.onSubmit(); await tick();
  assert.deepEqual(state.requests, [["order", "address", "original-key", 1, "quote-1"], ["order", "address", "original-key", 1, "quote-1"]]);
  assert.equal(state.render()[1], null);
  assert.equal(state.props.disabled, false);
});
test("server field rejection preserves selection and releases the mutation lock", async () => {
  const state = workflow();
  state.client.modifyOrderAddress = async () => { throw new ApiError(422, "ADDRESS_LOCATION_CHANGE_NOT_ALLOWED"); };
  state.render()[0].props.onClick(); await tick();
  state.render()[1].props.onSelect("address");
  state.render()[1].props.onSubmit(); await tick();
  state.render()[1].props.onSubmit(); await tick();
  const form = state.render()[1].props;
  assert.equal(form.selectedId, "address");
  assert.equal(form.uncertain, false);
  assert.equal(form.fieldError, "ADDRESS_LOCATION_CHANGE_NOT_ALLOWED");
  assert.equal(state.props.disabled, false);
  form.onClose(); assert.equal(state.render()[1], null);
});
test("rapid submissions issue one write and late completion cannot update an unmounted account form", async () => {
  const state = workflow();
  let finish;
  state.client.modifyOrderAddress = (...args) => { state.requests.push(args); return new Promise(resolve => { finish = resolve; }); };
  let updates = 0;
  state.props.onUpdated = () => { updates++; };
  state.render()[0].props.onClick(); await tick();
  state.render()[1].props.onSelect("address");
  state.render()[1].props.onSubmit(); await tick();
  const form = state.render()[1].props;
  form.onSubmit(); form.onSubmit();
  assert.equal(state.requests.length, 1);
  state.unmount(); finish(state.props.order); await tick();
  assert.equal(updates, 0);
});

test("changing the selected address invalidates the reviewed quote without writing", async () => {
  const state = workflow();
  state.render()[0].props.onClick(); await tick();
  state.render()[1].props.onSelect("address");
  state.render()[1].props.onSubmit(); await tick();
  assert.equal(state.render()[1].props.quote.quoteId, "quote-1");
  state.render()[1].props.onSelect("wrong");
  assert.equal(state.render()[1].props.quote, null);
  assert.equal(state.requests.length, 0);
});

test("expired review cannot commit until a fresh quote is reviewed", async () => {
  const state = workflow();
  state.quote.expiresAt = "2000-01-01T00:00:00Z";
  state.render()[0].props.onClick(); await tick();
  state.render()[1].props.onSelect("address");
  state.render()[1].props.onSubmit(); await tick();
  state.render()[1].props.onSubmit(); await tick();
  assert.equal(state.render()[1].props.quote, null);
  assert.match(state.render()[1].props.error, /expired/);
  assert.equal(state.requests.length, 0);
});

test("quote discovery failures keep the selection and allow closing or retrying", async () => {
  const state = workflow();
  state.client.quoteOrderAddress = async () => { throw new Error("offline"); };
  state.render()[0].props.onClick(); await tick();
  state.render()[1].props.onSelect("wrong");
  state.render()[1].props.onSubmit(); await tick();
  const form = state.render()[1].props;
  assert.equal(form.selectedId, "wrong");
  assert.equal(form.uncertain, false);
  assert.equal(state.props.disabled, false);
  assert.equal(state.requests.length, 0);
  form.onClose();
  assert.equal(state.render()[1], null);
});
