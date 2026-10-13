import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const checkoutRoot = resolve(sourceRoot, "components/checkout");
const modules = new Map();

function resolveSourceModule(path) {
  const candidates = [
    path,
    `${path}.ts`,
    `${path}.tsx`,
    resolve(path, "index.ts"),
    resolve(path, "index.tsx"),
  ];
  const filename = candidates.find((candidate) =>
    statSync(candidate, { throwIfNoEntry: false })?.isFile(),
  );
  if (!filename) {
    throw new Error(`Cannot resolve Checkout fixture source module: ${path}`);
  }
  return filename;
}

function compileSourceModule(filename) {
  return ts.transpileModule(
    readFileSync(filename, "utf8"),
    {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
}

export function compileCheckoutModule(file) {
  return compileSourceModule(resolveSourceModule(resolve(checkoutRoot, file)));
}

function loadSourceModule(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;

  const compiled = { exports: {} };
  modules.set(filename, compiled);
  const packageRequire = createRequire(filename);
  const localRequire = (specifier) => {
    if (specifier.startsWith("@/")) {
      return loadSourceModule(
        resolveSourceModule(resolve(sourceRoot, specifier.slice(2))),
      );
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      return loadSourceModule(
        resolveSourceModule(resolve(dirname(filename), specifier)),
      );
    }
    return packageRequire(specifier);
  };
  try {
    new Function(
      "require",
      "module",
      "exports",
      "__filename",
      "__dirname",
      compileSourceModule(filename),
    )(localRequire, compiled, compiled.exports, filename, dirname(filename));
  } catch (error) {
    modules.delete(filename);
    throw error;
  }
  return compiled.exports;
}

export function checkoutModule(name) {
  return loadSourceModule(resolveSourceModule(resolve(checkoutRoot, name)));
}

export function voucherFixture() {
  const voucher = {
    id: "legacy",
    name: "Legacy shipping",
    code: "LEGACY-SHIP",
    issuerType: "shop",
    benefitType: "shipping",
    valueType: "fixed",
    value: "20.00",
    maximumDiscount: null,
    minimumSpend: "0.00",
    termsSummary: "Shipping savings on eligible items.",
    validUntil: "2026-12-31T16:00:00Z",
    eligible: false,
    saving: "0.00",
    reason: "VOUCHER_FUNDING_INSUFFICIENT",
  };
  return {
    group: {
      shop: { id: "shop", name: "Example Shop" },
      items: [
        {
          productId: "product",
          variantId: null,
          productName: "Example product",
          imageUrl: null,
          selectedOptions: [],
          quantity: 1,
          sku: "EXAMPLE",
          lineSubtotal: "10.00",
        },
      ],
      availableVouchers: [
        voucher,
        {
          ...voucher,
          id: "funded",
          name: "Funded shipping",
          code: "FUNDED",
          value: "5.00",
          eligible: true,
          saving: "5.00",
          reason: null,
        },
      ],
      appliedVouchers: [],
      shippingQuote: {
        shippingFee: "20.00",
        logisticsBusinessName: "Example Logistics",
      },
      totals: {
        merchandiseSubtotal: "10.00",
        shippingFee: "20.00",
        discount: "0.00",
        shippingDiscount: "0.00",
        payable: "30.00",
      },
    },
    shippingOptions: {
      shop: { id: "shop" },
      options: [
        {
          organizationId: "provider",
          businessName: "Example Logistics",
          shippingFee: "20.00",
        },
      ],
    },
    selectedProviderId: "provider",
    selectedVouchers: [],
    disabled: false,
  };
}
