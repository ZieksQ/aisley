import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { checkoutModule, voucherFixture } from "./checkout-voucher.fixture.mjs";

const { ShopCheckoutGroup } = checkoutModule("shop-checkout-group");
const { voucherReasons, amount } = checkoutModule("checkout-display");
function render(disabled) {
  return renderToStaticMarkup(
    createElement(ShopCheckoutGroup, {
      ...voucherFixture(),
      disabled,
      onSelectProvider() {},
      onToggleVoucher() {},
      formatAmount: amount,
      voucherReasons,
    }),
  );
}

test("unfunded legacy candidate shows actionable feedback and cannot be selected", () => {
  const html = render(false);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-pressed="false"/);
  assert.match(
    html,
    /This Shop shipping voucher is unavailable for these items\. Choose another voucher\./,
  );
  assert.match(html, /Unavailable/);
  const buttons = html.match(/<button[^>]*>/g);
  assert.equal(buttons.length, 2);
  assert.doesNotMatch(buttons[1], / disabled=""/);
});

test("pending checkout disables funded and unfunded voucher candidates", () => {
  const buttons = render(true).match(/<button[^>]*>/g);
  assert.ok(buttons.every((button) => button.includes('disabled=""')));
});

test("claim-required candidate links to its collection surface and cannot be selected", () => {
  const props = voucherFixture();
  props.group.availableVouchers[0].reason = "VOUCHER_NOT_CLAIMED";
  props.group.availableVouchers[0].collectionUrl = "/shops/issuer#vouchers";
  const renderClaim = (disabled) =>
    renderToStaticMarkup(
      createElement(ShopCheckoutGroup, {
        ...props,
        disabled,
        onSelectProvider() {},
        onToggleVoucher() {},
        formatAmount: amount,
        voucherReasons,
      }),
    );
  assert.match(renderClaim(false), /href="\/shops\/issuer#vouchers"/);
  assert.match(
    renderClaim(false),
    /Collect this voucher before selecting it at checkout/,
  );
  assert.doesNotMatch(renderClaim(true), /href="\/shops\/issuer#vouchers"/);
});
