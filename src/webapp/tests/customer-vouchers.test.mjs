import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function compile(file) {
  return ts.transpileModule(
    readFileSync(
      new URL(`../src/lib/vouchers/${file}.ts`, import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
}
const voucher = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Savings",
  code: "SAVE",
  issuerType: "app",
  benefitType: "discount",
  valueType: "fixed",
  value: "10.00",
  maximumDiscount: null,
  minimumSpend: "100.00",
  currency: "PHP",
  validFrom: "2026-10-01T00:00:00Z",
  validUntil: "2026-12-01T00:00:00Z",
  paymentMethod: "cod",
  termsSummary: "COD only",
  distributionMode: "claim_required",
  scope: {
    productIds: [],
    categoryIds: [],
    excludedProductIds: [],
    excludedCategoryIds: [],
  },
  shop: null,
  collectionUrl: "/vouchers/11111111-1111-4111-8111-111111111111",
  collected: null,
  collectedAt: null,
  remainingPersonalUses: null,
  availabilityReason: null,
  canCollect: true,
  walletStatus: null,
};
function model() {
  const module = { exports: {} };
  vm.runInNewContext(compile("model"), {
    module,
    exports: module.exports,
    URLSearchParams,
    Intl,
    Date,
  });
  return module.exports;
}
function client() {
  const state = {
    revision: 1,
    calls: [],
    reported: [],
    changeDuringCsrf: false,
    payload: null,
  };
  const modelExports = model();
  const module = { exports: {} };
  class ApiError extends Error {
    constructor(status, payload) {
      super(payload.message);
      this.status = status;
      this.code = payload.code;
    }
  }
  vm.runInNewContext(compile("client"), {
    module,
    exports: module.exports,
    AbortSignal,
    URLSearchParams,
    Date,
    document: { cookie: "XSRF-TOKEN=synthetic-private-token" },
    process: { env: {} },
    fetch: async (url, options) => {
      state.calls.push({ url, options });
      return new Response(JSON.stringify(state.payload));
    },
    require: (name) =>
      name === "./model"
        ? modelExports
        : name === "@/lib/api"
          ? {
              ApiError,
              initializeCsrf: async () => {
                if (state.changeDuringCsrf) state.revision++;
              },
            }
          : {
              sessionRevision: () => state.revision,
              reportSessionFailure: (...args) => state.reported.push(args),
            },
  });
  return { state, api: module.exports };
}

test("voucher DTO rejects malformed required fields and unsafe collection paths", () => {
  const { parseVoucher, parseVoucherPage } = model();
  assert.equal(parseVoucher(voucher).id, voucher.id);
  for (const change of [
    { scope: {} },
    { collected: "true" },
    { remainingPersonalUses: -1 },
    { maximumDiscount: {} },
    { collectionUrl: "https://elsewhere.test/claim" },
    { currency: "USD" },
  ]) {
    assert.throws(() => parseVoucher({ ...voucher, ...change }));
  }
  assert.throws(() => parseVoucherPage({ items: [], pagination: {} }));
});

test("filters keep pagination bounded and reject repeated values", () => {
  const { parseVoucherFilters } = model();
  assert.equal(
    parseVoucherFilters({ issuer: ["app", "shop"] }).error !== null,
    true,
  );
  assert.equal(parseVoucherFilters({ page: "10001" }).error !== null, true);
  assert.equal(parseVoucherFilters({ benefit: "" }).error, null);
});

test("public Shop paging omits credentials and CSRF while private wallet is no-store", async () => {
  const { api, state } = client();
  state.payload = {
    items: [voucher],
    pagination: { currentPage: 1, lastPage: 1, perPage: 20, total: 1 },
  };
  await api.shopVouchers("issuer", 1);
  assert.equal(state.calls[0].options.credentials, "omit");
  assert.equal(state.calls[0].options.headers["X-XSRF-TOKEN"], undefined);
  await api.myVouchers({ status: "available" });
  assert.equal(state.calls[1].options.credentials, "include");
  assert.equal(state.calls[1].options.cache, "no-store");
});

test("an account change during CSRF prevents collection from being sent", async () => {
  const { api, state } = client();
  state.changeDuringCsrf = true;
  await assert.rejects(api.collectVoucher(voucher), /account changed/);
  assert.equal(state.calls.length, 0);
});

test("malformed or unconfirmed collection response never becomes success", async () => {
  const { api, state } = client();
  state.payload = { data: { ...voucher, collected: false } };
  await assert.rejects(api.collectVoucher(voucher), /not confirmed/);
  state.payload = { data: { ...voucher, id: "another", collected: true } };
  await assert.rejects(api.collectVoucher(voucher), /not confirmed/);
});
