---
feature: voucher-usage
title: Customer Voucher Usage
system: AISLEY
status: Draft
role: Customer, Seller, Admin
scope: Checkout and Laravel promotion domain
---

# Voucher Usage

## WHAT

- Vouchers reduce either merchandise cost (**discount voucher**) or delivery cost (**shipping voucher**) during Customer checkout.
- Each voucher has an issuer/scope: **App voucher** is funded/issued by Aisley; **Shop voucher** is funded/issued by one Shop.
- A Shop voucher applies only to the Order for its issuing Shop. An App voucher may be eligible across Shops, but in a multi-Shop checkout it is applied to one chosen eligible Shop Order only.
- Voucher eligibility and calculation are server-authoritative; a voucher is not consumed until the complete checkout transaction commits.
- Admin owns App-voucher lifecycle. An approved Seller owns only its own Shop vouchers. Customers can view and select vouchers they are eligible to redeem.
- Non-goals: wallet/coins, referral rewards, cash redemption, automatic post-order discounting, payment-provider promotions, and refund policy implementation.

## MUST

### Voucher taxonomy and scope

- Persist `issuer_type` as `app` or `shop`, and `benefit_type` as `discount` or `shipping`; database columns are strings and PHP enum casts enforce values.
- An App voucher has no Shop owner and can define campaign/category/product/customer/payment eligibility.
- A Shop voucher has exactly one `shop_id`; it cannot reduce a different Shop Order or aggregate spend across Shops.
- A discount voucher applies only to its eligible Order merchandise subtotal after approved line-level promotions. It must not discount shipping, COD fee, tax, or unrelated Orders unless its stored terms explicitly say so.
- A shipping voucher applies only to the eligible Order's quoted shipping charge. It cannot produce a negative shipping fee, cash balance, or transfer to another Order.
- Every voucher displays issuer, benefit, amount/percentage, cap, minimum spend basis, scope/exclusions, valid dates/time zone, usage limit, stackability, and payment restriction where applicable.

### Multi-Shop allocation rule

- Checkout first creates an in-memory Order group per Shop, then evaluates vouchers independently against each group.
- Shop vouchers are selectable only in their own group and may be used on every eligible Shop group, subject to each voucher's own availability/usage rule.
- An App voucher is a single redemption per checkout batch. With one eligible group it applies there; with multiple eligible groups the Customer must choose one target Shop group before placement.
- The target group must independently meet every App-voucher requirement. The platform must not combine merchandise subtotals or shipping charges across Shops to qualify it.
- If the target becomes ineligible during final placement, reject the batch with a field-addressable reason (for example `VOUCHER_TARGET_NO_LONGER_ELIGIBLE`); never silently retarget it to another Shop.
- When the UI needs a recommended target, calculate the highest actual saving server-side; ties break by largest eligible merchandise subtotal, then stable Shop UUID. Recommendation never replaces explicit Customer confirmation in a multi-Shop batch.

### Combination and order of calculation

- Default MVP cap per Shop Order: at most one discount voucher and one shipping voucher; both may be selected only when their stored stacking policies permit the pair.
- A voucher's `stacking_policy` must explicitly allow/deny combination with App/Shop issuer and discount/shipping benefit. Absent policy means it cannot stack with another voucher of the same benefit.
- Apply deterministically:
  1. calculate eligible merchandise subtotal from authoritative current prices;
  2. calculate the approved discount-voucher saving, capped by its terms and subtotal;
  3. calculate shipping quote;
  4. calculate shipping-voucher saving, capped by its terms and shipping charge;
  5. calculate payable COD total, never below zero.
- Do not let a shipping voucher satisfy a merchandise minimum spend unless its terms expressly define that basis.
- A percent voucher must store a finite percentage and a maximum discount where relevant; a fixed voucher must store a non-negative fixed amount.

### Eligibility and redemption controls

- Validate at quote and again under transaction lock at placement: active status, start/end time, claim/redemption availability, global/per-Customer/per-Shop usage limits, Customer eligibility, payment method, minimum spend, Shop/product/category inclusion/exclusion, and stackability.
- Voucher rules use server time in UTC. An expired, exhausted, unclaimed, duplicate, or otherwise ineligible voucher returns a stable `422`/`409` reason and no saving.
- Store vouchers in an immutable definition/history model; changes to campaigns cannot rewrite the applied savings on a placed Order.
- Claiming and redemption are separate when claims are enabled. A claimed voucher is not spent until committed redemption; claimed stock/reservation behavior is an explicit future decision.
- Use a Customer-scoped unique redemption constraint appropriate to the voucher's limit and lock/update capacity atomically so concurrent tabs cannot oversubscribe a limited code.
- Repeated placement with the same checkout idempotency key must return its original result and must not consume the voucher twice.

### Security, role boundaries, and records

- Only an Admin with the relevant permission may create/change/disable App vouchers. Sellers require active approval and must be scoped through their own Shop for Shop-voucher management.
- Customers may never create vouchers, set discount amounts, change validity/limits, or submit a Shop ID as authorization proof.
- Do not expose private campaign budget, redemption-risk controls, other Customers' redemptions, or Seller data outside authorized Shop workflows.
- On successful placement, persist an Order-level voucher snapshot: definition ID/code, issuer/scope, benefit, qualifying basis, rule version/terms summary, calculated saving, currency, and redemption timestamp.
- Cancellation/refund/return treatment is not defined here. Preserve the redemption record and delegate restoration/reissue rules to the future order/payment policy; never automatically reissue a voucher merely because a request failed after commit.

### Customer experience and accessibility

- Each Shop group shows eligible, selected, unavailable, and ineligible vouchers separately by discount and shipping benefit, with a readable reason/terms link.
- In a multi-Shop checkout, App-voucher selection visibly names the one target Shop and shows that other Shop Orders receive no part of that voucher.
- Requote immediately after a voucher/address/line change and before placing; show savings and totals per Shop, not one misleading cross-Shop total.
- Do not preselect a voucher that would hide a better explicit choice. If a selected voucher is stale, preserve the user's intent, mark it unavailable, and require a new choice.
- Controls, validation messages, terms disclosure, and savings changes must be keyboard-accessible and announced without relying on color alone.

### Acceptance criteria

- [ ] A Shop discount or shipping voucher never applies outside its issuing Shop Order.
- [ ] A multi-Shop batch uses one App voucher on one Customer-selected eligible Shop Order only.
- [ ] The system never aggregates distinct Shop totals to meet a voucher threshold.
- [ ] A Shop can apply its own eligible voucher while another Shop in the same batch uses a different Shop voucher.
- [ ] Discount and shipping vouchers calculate against their correct bases and never make an Order total negative.
- [ ] Invalid/expired/exhausted/stale vouchers neither change totals nor consume capacity.
- [ ] Concurrent use respects global and per-Customer limits; retries with one idempotency key redeem once.
- [ ] Order history retains the applied voucher and savings after voucher edits/expiry.
- [ ] Customers see a per-Shop reason when a voucher cannot apply and never see private campaign data.

## HOW

### Laravel model and service design

- Add migrations only for a normalized promotion domain, for example `vouchers`, `voucher_product_rules`/category rules when needed, `customer_voucher_claims`, and `voucher_redemptions`; link redemptions to the eventual Order and checkout batch.
- Suggested voucher fields: UUID, code, issuer type, `shop_id` nullable only for App vouchers, benefit type, fixed/percent value, cap, minimum spend, starts/ends, limits, active flag, eligibility JSON/rule relations, stacking policy, terms/version, and timestamps.
- Use `VoucherEligibilityService` to return structured eligibility/reason data and `VoucherCalculator` for money math. `CheckoutService` calls both at quote and placement; neither React nor seller/admin controllers duplicate the formula.
- Suggested Customer APIs: `GET /api/v1/customer/vouchers/eligible?checkout=…`, `POST /api/v1/customer/vouchers/claim` when enabled, and checkout quote/place selections. Admin/Seller management endpoints belong to their existing role prefixes and RBAC middleware.

### Testing and rollout

- Laravel tests: role/Shop isolation; App versus Shop scope; benefit bases/caps; all eligibility dimensions; explicit multi-Shop target; no subtotal aggregation; stack rules; expiry and capacity races; transaction rollback; snapshot retention; and idempotency.
- Storefront tests: per-Shop voucher lists, target confirmation, terms/reasons, recalculated totals, stale selection, keyboard behavior, and no misleading combined saving.
- Start with simple fixed/percent discount and shipping caps plus explicit terms; add campaign/category/product rules only after their persistence and admin/seller UX exist.
- Track safe aggregate metrics (quote eligibility failures, redemptions, savings, exhaustion, conflicts) without logging codes when confidential, addresses, or Customer PII.

### Open decisions

- Whether vouchers must be claimed before use and how claimed capacity is reserved.
- Which Customer segments, categories, products, or campaigns are supported in MVP.
- Whether Shop and App vouchers of the same benefit may ever stack under an approved campaign policy.
- Whether cancelling before Seller processing reissues the same voucher, creates a replacement, or preserves its original use limit.
- Whether existing sale prices are included in the merchandise subtotal and the precise rounding convention.
- Whether a voucher code is public, wallet-only, or both, and the fraud/rate-limit policy for code attempts.

### Research references

- Shopee's Philippines Help Center says checkout supports a platform voucher and one Shop voucher per Shop, subject to each voucher's terms: https://help.shopee.ph/portal/4/article/81465
- Shopee lists seller, shipping-discount, and platform voucher categories and surfaces seller eligibility per selected products: https://help.shopee.ph/portal/4/article/129874-%5BVouchers%5D-How-do-I-apply-vouchers-at-checkout-%28TAG%29
- Shopee's voucher terms list user, minimum-spend, item/service, validity, cap, and payment-method conditions: https://help.shopee.ph/portal/4/article/165965
- Lazada's Philippines terms require checkout-time application and review, and state that certain vouchers cannot be combined: https://pages.lazada.com.ph/wow/gcp/route/lazada/ph/upr_1000345_lazada/channel/ph/upr-router/render?at_iframe=1&data_prefetch=true&hybrid=1&prefetch_replace=1&wh_pid=%2Flazada%2Fchannel%2Fph%2Flegal%2Fterms-conditions
