import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/components/checkout/checkout-summary.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
});
const compiled = { exports: {} };
new Function("require", "module", "exports", outputText)(require, compiled, compiled.exports);
const { CheckoutSummary } = compiled.exports;
const quote = { summary: { merchandiseSubtotal: "100", shippingFee: "20", discount: "0", shippingDiscount: "0", payable: "120", orderCount: 1 } };
function render(status, currentQuote = quote) {
  return renderToStaticMarkup(createElement(CheckoutSummary, {
    quote: currentQuote, status, message: "Confirm the original checkout.", onPlaceOrder() {}, formatAmount: value => value,
  }));
}

test("pending placement disables the button and announces its action", () => {
  const html = render("placing");
  assert.match(html, /<button[^>]*disabled=""/);
  assert.match(html, /Placing order…/);
  assert.match(html, /role="alert"/);
});

test("reloaded uncertain placement exposes exact retry without a new quote", () => {
  const html = render("uncertain", null);
  assert.doesNotMatch(html, /<button[^>]*disabled=/);
  assert.match(html, /Retry original order/);
  assert.match(html, /original checkout with its reviewed items/);
});

test("missing quote, quote refresh and errors cannot enable a new placement", () => {
  for (const html of [render("ready", null), render("quoting"), render("error")]) {
    assert.match(html, /<button[^>]*disabled=""/);
  }
  assert.doesNotMatch(render("ready"), /<button[^>]*disabled=/);
});
