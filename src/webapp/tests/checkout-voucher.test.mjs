import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { checkoutModule, voucherFixture } from "./checkout-voucher.fixture.mjs";

const { ShopCheckoutGroup } = checkoutModule("shop-checkout-group");
const { VoucherTicket } = checkoutModule("voucher-ticket");
const { amount } = checkoutModule("checkout-display");
const compiled = ts.transpileModule(
  readFileSync(
    new URL("../src/lib/checkout/voucher-selection.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { toggleVoucherSelection } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function renderTicket(voucher, selected = false, disabled = false) {
  return renderToStaticMarkup(
    createElement(VoucherTicket, {
      voucher,
      selected,
      disabled,
      onSelect() {},
    }),
  );
}

test("checkout opens a dedicated Shop-targeted page instead of a dropdown", () => {
  const html = renderToStaticMarkup(
    createElement(ShopCheckoutGroup, {
      ...voucherFixture(),
      onSelectProvider() {},
      formatAmount: amount,
    }),
  );
  assert.match(html, /href="\/checkout\/vouchers\?shop=shop"/);
  assert.match(html, /Select vouchers for Example Shop/);
  assert.doesNotMatch(html, /<details|aria-pressed/);
});

test("pending checkout removes the voucher navigation action", () => {
  const html = renderToStaticMarkup(
    createElement(ShopCheckoutGroup, {
      ...voucherFixture(),
      disabled: true,
      onSelectProvider() {},
      formatAmount: amount,
    }),
  );
  assert.doesNotMatch(html, /href="\/checkout\/vouchers/);
  assert.match(html, /aria-disabled="true"/);
});

test("unfunded ticket shows a readable reason and cannot be selected", () => {
  const html = renderTicket(voucherFixture().group.availableVouchers[0]);
  assert.match(html, /<button[^>]*aria-pressed="false"[^>]*disabled=""/);
  assert.match(
    html,
    /This Shop shipping voucher is unavailable for these items\. Choose another voucher\./,
  );
});

test("selected ticket highlights selection without a radio control", () => {
  const html = renderTicket(voucherFixture().group.availableVouchers[1], true);
  assert.match(html, /data-selected="true"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Selected/);
  assert.doesNotMatch(html, /type="radio"|role="radio"/);
});

test("applying disables ticket changes and collection links", () => {
  const voucher = {
    ...voucherFixture().group.availableVouchers[1],
    reason: "VOUCHER_NOT_CLAIMED",
    eligible: false,
    collectionUrl: "/shops/issuer#vouchers",
  };
  assert.match(renderTicket(voucher), /href="\/shops\/issuer#vouchers"/);
  assert.match(
    renderTicket(voucher),
    /Collect this voucher before selecting it at checkout/,
  );
  assert.doesNotMatch(
    renderTicket(voucher, false, true),
    /href="\/shops\/issuer#vouchers"/,
  );
  assert.match(
    renderTicket(voucherFixture().group.availableVouchers[1], false, true),
    /disabled=""/,
  );
});

function selectionFixture() {
  const discount = {
    ...voucherFixture().group.availableVouchers[1],
    id: "platform-discount",
    issuerType: "app",
    benefitType: "discount",
  };
  const shipping = {
    ...discount,
    id: "platform-shipping",
    benefitType: "shipping",
  };
  const shopDiscount = { ...discount, id: "shop-discount", issuerType: "shop" };
  const groups = ["shop-a", "shop-b"].map((id) => ({
    shop: { id },
    availableVouchers: [
      discount,
      shipping,
      {
        ...shopDiscount,
        id: id === "shop-a" ? shopDiscount.id : "shop-b-discount",
      },
    ],
  }));
  return { discount, shipping, shopDiscount, groups };
}

test("moving a platform voucher keeps its explicit Shop target and opposite benefit", () => {
  const { discount, shipping, groups } = selectionFixture();
  const original = [
    { voucher_id: discount.id, target_shop_id: "shop-a" },
    { voucher_id: shipping.id, target_shop_id: "shop-a" },
  ];
  const next = toggleVoucherSelection(original, discount, "shop-b", groups);
  assert.deepEqual(next, [
    original[1],
    { voucher_id: discount.id, target_shop_id: "shop-b" },
  ]);
  assert.equal(
    original.length,
    2,
    "The applied selection remains untouched until Apply succeeds",
  );
});

test("same-benefit Shop replacement preserves other Shops and opposite benefit", () => {
  const { discount, shipping, shopDiscount, groups } = selectionFixture();
  const original = [
    { voucher_id: discount.id, target_shop_id: "shop-a" },
    { voucher_id: shipping.id, target_shop_id: "shop-a" },
    { voucher_id: "shop-b-discount", target_shop_id: "shop-b" },
  ];
  assert.deepEqual(
    toggleVoucherSelection(original, shopDiscount, "shop-a", groups),
    [
      original[1],
      original[2],
      { voucher_id: shopDiscount.id, target_shop_id: "shop-a" },
    ],
  );
});

test("tapping a selected ticket removes it; an unavailable ticket cannot be added", () => {
  const { discount, groups } = selectionFixture();
  const original = [{ voucher_id: discount.id, target_shop_id: "shop-a" }];
  assert.deepEqual(
    toggleVoucherSelection(original, discount, "shop-a", groups),
    [],
  );
  assert.equal(
    toggleVoucherSelection(
      original,
      { ...discount, eligible: false },
      "shop-b",
      groups,
    ),
    original,
  );
  assert.deepEqual(
    toggleVoucherSelection(
      original,
      { ...discount, eligible: false },
      "shop-a",
      groups,
    ),
    [],
  );
});
