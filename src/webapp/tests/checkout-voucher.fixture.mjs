import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
export function compileCheckoutModule(file) {
  return ts.transpileModule(readFileSync(new URL(`../src/components/checkout/${file}.tsx`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}

export function checkoutModule(name) {
  const compiled = { exports: {} };
  const localRequire = path => path === "./shipping-provider-selector" ? checkoutModule("shipping-provider-selector") : require(path);
  new Function("require", "module", "exports", compileCheckoutModule(name))(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

export function voucherFixture() {
  const voucher = {
    id: "legacy", name: "Legacy shipping", code: "LEGACY-SHIP", issuerType: "shop", benefitType: "shipping",
    valueType: "fixed", value: "20.00", maximumDiscount: null, minimumSpend: "0.00",
    termsSummary: "Shipping savings on eligible items.", eligible: false, saving: "0.00", reason: "VOUCHER_FUNDING_INSUFFICIENT",
  };
  return {
    group: {
      shop: { id: "shop", name: "Example Shop" },
      items: [{ productId: "product", variantId: null, productName: "Example product", selectedOptions: [], quantity: 1, sku: "EXAMPLE", lineSubtotal: "10.00" }],
      availableVouchers: [voucher, { ...voucher, id: "funded", name: "Funded shipping", code: "FUNDED", value: "5.00", eligible: true, saving: "5.00", reason: null }],
      shippingQuote: { shippingFee: "20.00", logisticsBusinessName: "Example Logistics" },
      totals: { merchandiseSubtotal: "10.00", shippingFee: "20.00", discount: "0.00", shippingDiscount: "0.00", payable: "30.00" },
    },
    shippingOptions: { shop: { id: "shop" }, options: [{ organizationId: "provider", businessName: "Example Logistics", shippingFee: "20.00" }] },
    selectedProviderId: "provider", selectedVouchers: [], disabled: false,
  };
}
