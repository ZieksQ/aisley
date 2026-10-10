---
feature: voucher-usage
title: Customer Voucher Usage
system: AISLEY
type: Feature Specification
version: 3.0
status: Implemented discovery, collection, wallet, Checkout usage and authoring
implementation_status: Per-Shop selection, eligibility, calculation, snapshots, and transactional redemption implemented
canonical: true
role: Customer
scope: Customer discovery, Shop collection, My Vouchers and Checkout
reviewed: 2026-10-11
---

# Customer Voucher Usage

## WHAT

### Purpose and implementation boundary

- Let an authenticated active Customer select existing App/Shop vouchers during COD Checkout and review server-calculated savings before placement.
- Persisted/API role is `customer`; Customers select definitions, not author voucher terms or set discount amounts.
- Existing Checkout quote/place/batch APIs and `/checkout` UI implement usage; a quote evaluates selection, while successful placement redeems it.
- Reuse the implemented `vouchers`, `order_vouchers`, and `voucher_redemptions` models/table contracts; eligible choices depend on existing server-stored definitions, not an invented catalogue.

| Area | Current status and owner |
| --- | --- |
| Checkout selection/redemption | Implemented; Customer Checkout owns intent, quote, placement, transaction, and result retrieval. |
| Voucher claiming/wallet/discovery | Public catalogue/detail and Shop reads; authenticated collection/status/My Vouchers, persisted collections and derived automatic offers. |
| App voucher authoring | Implemented Admin authoring, publication, revision and availability controls; see [Admin vouchers](../../admin/vouchers/spec.md). |
| Shop voucher authoring | Implemented Seller merchandise authoring, scoped to the authenticated Seller's Shop; see [Seller vouchers](../../seller/vouchers/spec.md). |
| Shipping and funding | Existing Shipping Quotation/Finance services own rates, commission, and funding snapshots; usage must not duplicate them. |

- Non-goals: claim-stock reservation, referral rewards, coins/cash redemption, automatic best-voucher selection, online payment, campaign publishing, or refund/reissue policy.
- This spec owns discovery/collection and preserves the owning Checkout calculation, redemption and replay contract.

## MUST

### Existing taxonomy and Shop allocation

- String-backed PHP enums use `issuer_type = app|shop`, `benefit_type = discount|shipping`, and `value_type = fixed|percent`.
- App definitions have no Shop owner; Shop definitions have one `shop_id`. PostgreSQL enforces this pairing in the existing migration.
- Checkout groups server-resolved selected lines by Shop; one batch creates one Order per Shop.
- A Shop voucher applies only to its issuing Shop group. Different Shops may use different eligible Shop vouchers in the same batch.
- At most one App discount and one App shipping voucher are allowed per batch. Each selection has its own explicit target Shop, even in single-Shop checkout.
- Target Shop must exist in that Customer's resolved checkout groups and independently qualify; never aggregate other Shops' spend or silently retarget savings.
- A Shop group accepts at most one discount and one shipping voucher. Same-benefit stacking is rejected even if stored permissions suggest otherwise.
- One discount and one shipping voucher combine by default, regardless of legacy `stacking_policy.allow_with` values.
- Two discounts or two shipping vouchers in the same Shop group remain invalid. Listing an individually eligible voucher does not bypass benefit or capacity limits.
- No highest-saving target recommendation or automatic voucher preselection currently exists.

### Eligibility and authoritative calculation

- Quote evaluates published App definitions and published definitions belonging to participating Shops, ordered by UUID; relevant unavailable definitions may remain with a reason. Unpublished drafts and permanently ended definitions are excluded and direct selections are rejected.
- Placement locks only selected definitions in UUID order and re-evaluates them. A quote does not reserve voucher capacity or create redemption records.
- Validate active flag, server-time start/end window, valid nonnegative terms, positive per-Customer limit, percentage at most 100, and applicable COD restriction.
- Start is inclusive; end is exclusive. Missing payment restriction or `cod` is compatible with the current COD-only flow.
- Global capacity uses `global_limit/redeemed_count`; per-Customer capacity counts that Customer's committed `voucher_redemptions`.
- Supported JSON rules are `customer_ids`, `excluded_customer_ids`, `product_ids`, `excluded_product_ids`, `category_ids`, and `excluded_category_ids`.
- Inclusion lists intersect and exclusions win; Product Category matching uses the line Product's stored category ID, not an inferred descendant taxonomy.
- The target Shop's full merchandise subtotal, before voucher discounts, is the implemented `minimum_spend` basis—not only eligible lines and never combined-Shop spend.
- A voucher needs positive eligible merchandise even for a shipping benefit; shipping-only eligibility does not bypass item exclusions.
- Discount basis is the sum of eligible lines at current Product/Variant price times quantity; shipping basis is that Shop's server-quoted shipping fee.
- Current Product/Variant price is used, not `original_price` or a separate client-side sale formula.
- Fixed savings use the stored monetary value; percentage savings use integer cents and hundredths-of-a-percent, rounded half-up to the nearest cent.
- Apply nullable `maximum_discount`, clamp saving to its own basis and at least zero; a zero shipping fee may produce an eligible voucher with zero saving.
- Selecting a zero-saving voucher still consumes one redemption on committed placement; automatic omission of zero-saving choices is not implemented.
- Per-Shop payable is `max(0, merchandiseSubtotal - discount + shippingFee - shippingDiscount)`; return fixed two-decimal strings and currency, currently `PHP`.
- Finance records issuer/benefit funding separately; platform commission does not increase Customer COD. Clients format amounts but never calculate authoritative totals.
- Persisted legacy Shop shipping vouchers remain usable only when their full calculated saving is covered by the target Shop's merchandise less Seller merchandise discounts and half-up rounded Seller commission. App discounts do not reduce this capacity; other Shops cannot fund it. Equality allows zero Seller proceeds. Do not reduce the offered saving to fit funding.
- Evaluate the complete selected pair before funding validation, independent of request/UUID ordering. Candidate shipping eligibility uses the selected merchandise voucher's funding effect; existing ineligibility reasons take precedence. Insufficient funding returns `eligible: false`, `reason: VOUCHER_FUNDING_INSUFFICIENT`, `saving: "0.00"` without exposing commissions or internal capacity.

### Actual selection and response contract

- Extend the normal `cart` or `buy_now` Checkout intent with optional `vouchers` (default empty), at most 20 selections:
  `vouchers: [{voucher_id: "<voucher UUID>", target_shop_id: "<participating Shop UUID>"}]`.
- Each voucher UUID must be distinct and every selection must include a target Shop UUID. Displayed code is not an accepted code-entry/redemption input.
- Customer-owned collection is required for every Shop voucher and `claim_required` App voucher. Automatic App vouchers need no collection. Quote returns `VOUCHER_NOT_CLAIMED` and `collectionUrl` for an otherwise eligible uncollected candidate.
- Customer, Shop ownership, eligibility, price, saving, shipping quote, and status are server-derived; the target ID is an allocation request, not authorization proof.
- Quote returns `data.groups[].availableVouchers[]` with `id`, customer-visible `name`, `code`, `issuerType`, `benefitType`, `valueType`, `value`, `maximumDiscount`, and `minimumSpend`.
- Other fields: `termsSummary`, `validFrom/validUntil`, `paymentMethod`, `stackableWith`, `scope`, `eligible`, `reason`, and two-decimal `saving`.
- `scope` contains Product/Category inclusion/exclusion ID arrays only; Customer targeting lists, global counts, budgets, and other users' redemptions are not exposed.
- `availableVouchers` means relevant candidates, not eligible-only or paginated wallet records; ineligible candidates have `saving = "0.00"`.
- `appliedVouchers[]` returns `id`, `name`, `code`, issuer/benefit, `qualifyingBasis`, and `discountAmount` for accepted selection.
- Group and batch summaries expose `merchandiseSubtotal`, `shippingFee`, `discount`, `shippingDiscount`, `payable`, and `currency`; combined totals do not imply cross-Shop allocation.
- Successful batch reads expose `data.orders[].vouchers[]` with the applied fields plus `termsSummary`; `name` is frozen at placement and falls back to code for historical snapshots; snapshot version/time are persisted, not returned by this DTO.

### Transaction, snapshots, and retries

- Checkout creates a Customer-owned expiring quote with normalized request/state hashes; default lifetime is 15 minutes under current configuration.
- Placement revalidates owned quote, intent, selected voucher state, stock, address, rates, and totals under the existing Checkout transaction.
- Commit Orders, financial/voucher snapshots, redemption rows, redeemed counters, inventory reservations, and selected-Cart cleanup atomically; failure before commit consumes nothing.
- Each applied snapshot stores source ID/code, issuer/benefit, qualifying basis, saving, currency, rule version, terms summary, and redemption time.
- Later definition changes/expiry cannot rewrite placed savings. Authoring records immutable published versions and separate working drafts; replacement preserves the UUID/code and cumulative usage. Checkout hashes the full live terms, published version and availability revision, detecting same-second publication/pause/resume changes while ignoring working-draft saves.
- Database uniqueness is per Order/voucher, not an unconditional one-use Customer/voucher constraint; per-Customer limits are counted under transaction locks.
- Placement requires a Customer-scoped UUID `Idempotency-Key`; replay the same quote ID and normalized intent to return the same batch without another redemption.
- Reusing the key with changed details returns `409 IDEMPOTENCY_KEY_REUSED`; using a placed quote under a new key returns `QUOTE_ALREADY_PLACED`.
- Quote retry creates a new quote and recalculates eligibility; it is not a replay-safe claim or redemption. Batch GET is a private read.
- Once committed, notification or Cart-refresh failure does not reverse voucher use. Reconcile an uncertain placement before submitting it as a new attempt.
- Current cancellation/rejection does not restore a voucher counter or delete redemption history; return/refund/reissue behavior needs its separately approved policy.

### Customer experience and integration gaps

- `/checkout` shows a per-Shop **Select vouchers** (or **Change**) link to `/checkout/vouchers?shop=<UUID>`. The dedicated page shows ticket-shaped vouchers with benefit, minimum spend, cap, expiry, concise ineligibility and a Details link. The Shop heading identifies the explicit App target. Selected tickets use a pink outline/background, checkmark and `aria-pressed`; no radio controls.
- Tapping a ticket edits a local draft, replaces a same-benefit choice for that Shop and removes another selected App voucher of the same benefit; opposite-benefit and unrelated Shop choices remain. **Apply vouchers** submits the complete draft for a server quote and returns to Checkout only after success. Back cancels the local draft. No discount is calculated locally.
- No choice is preselected. Selected intent and totals update only after a successful quote; failures preserve the draft with readable feedback. The shared Checkout review layout retains shipping and applied vouchers across the page transition, with one consent gate for these two views and server consent enforcement on each private API call. Account/session changes clear private state and invalidate late replies. Controls are disabled while quoting/placing or awaiting uncertain placement recovery; the latter also blocks voucher navigation.
- Storefront recovery freezes selected vouchers with the original placement payload/key. Only recognized quote-rejection codes release it for refreshed review; key collisions, unknown conflicts, throttling and uncertain transport retain exact replay. Refreshed review requires another Place action and preserves the rejection message.
- Preserve safe input and distinguish validation/conflict, session/consent loss, throttling, timeout/offline, and service failure; existing Checkout error handling is not full coverage of every state.
- Customer voucher/Shop surfaces use the explicit 2026-10-11 design exception: freely chosen layouts with existing AISLEY colors, responsive behavior and accessibility. Checkout retains keyboard-operable disclosure/buttons, `aria-pressed`, visible focus and announced feedback.
- Checkout requests currently lack dedicated timeout/throttle recovery; candidate lists are not independently bounded/paginated. These remain scoped hardening gaps.
- Clear account-scoped quotes/selections and ignore obsolete responses on account/session changes; current quote sequencing is not proof of Customer-ID isolation.

### Acceptance criteria

Checked items reflect inspected implementation and existing test sources; unverified behavior remains unchecked.

- [x] Customer Checkout lists relevant candidates with server eligibility/reasons and accepts UUID selections with required collection checks and no code-entry API.
- [x] Shop scope, explicit App targets, per-benefit limits, and default opposite-benefit pairing checks exist without cross-Shop threshold aggregation.
- [x] Supported item/Customer rules, full-Shop minimum spend, integer-cent rounding, caps, and nonnegative totals follow the existing calculator.
- [x] Placement stores per-Order snapshots/redemptions and increments capacity inside the Checkout transaction; same-key replay returns the same batch.
- [x] Private quote/batch responses omit targeting lists and use existing Customer role, ownership, and consent gates.
- [ ] Focused voucher tests cover every ineligibility, wrong target, pair incompatibility, zero/maximum basis, rounding, and definition-change snapshot case.
- [ ] PostgreSQL simultaneous limited-voucher placements and voucher-bearing retries/rollbacks prove no overuse or duplicate consumption.
- [ ] Stale removal, account switch, delayed replies, offline/timeout/throttle recovery, and uncertain placement preserve safe reviewed intent.
- [ ] Per-Shop/App-target keyboard, responsive, disclosure, savings announcements, and result-history browser checks are recorded.

## HOW

### Implemented endpoints

All routes require `auth:sanctum`, `customer.active`, and `policy.consent` within the existing `throttle:120,1` group.

| Method/path | Current request and response |
| --- | --- |
| `POST /api/v1/customer/checkout/quote` | Normal Checkout intent plus optional selections; `200 {data: {quoteId, expiresAt, mode, paymentMethod, address, groups, summary}}`. |
| `POST /api/v1/customer/checkout/place` | Same intent plus `quote_id` and UUID idempotency header; `200 {data: CheckoutBatch}`, including replay. |
| `GET /api/v1/customer/checkout/{batch}` | Owned batch UUID; `200 {data: CheckoutBatch}`; foreign/missing batch is `404`. |

- Successful responses are `private, no-store`; browser calls reuse the established credentialed Sanctum/CSRF client, not shared Homepage caching.
- Invalid selections use `422`: `VOUCHER_TARGET_INVALID`, `VOUCHER_SHOP_MISMATCH`, `APP_VOUCHER_LIMIT`, `VOUCHER_BENEFIT_LIMIT`.
- Selected ineligibility uses `409`: `VOUCHER_TERMS_INVALID`, `VOUCHER_INACTIVE`, `VOUCHER_NOT_STARTED`, `VOUCHER_EXPIRED`, `VOUCHER_PAYMENT_INELIGIBLE`, `VOUCHER_EXHAUSTED`, `VOUCHER_CUSTOMER_LIMIT`, `VOUCHER_MINIMUM_SPEND`, `VOUCHER_CUSTOMER_INELIGIBLE`, or `VOUCHER_ITEMS_INELIGIBLE`.
- Checkout conflicts include `QUOTE_EXPIRED`, `QUOTE_INPUT_CHANGED`, and `QUOTE_STALE`; domain errors return `{code, message, errors?}` with selection fields where applicable.
- A selected funding shortfall returns `409 VOUCHER_FUNDING_INSUFFICIENT` at quote with field `vouchers`. Placement revalidates and maps newly invalid `VOUCHER_*` eligibility to `409 QUOTE_STALE` on `vouchers`, permitting reviewed refresh through the existing recovery contract. Rejected placement consumes nothing; committed exact-key replay bypasses new pricing checks.
- Standard auth/approval/consent and rate-limit errors remain owned by middleware; never substitute conceptual voucher routes or invented error codes.

### Components, deferred work, and verification

- `CheckoutController`, quote/place Requests, `CheckoutService`, and `CheckoutBatchResource` implement this contract; private service methods own eligibility, saving, stacking, and redemption.
- `checkout-page-content.tsx` and `lib/checkout/{client,types}.ts` implement candidates, targeting, requotes, and replay; result/Order views consume stored savings.
- Preserve existing migration `2026_08_30_000125_create_checkout_orders_and_vouchers.php`; authoring adds `2026_10_08_000001_add_voucher_authoring.php` with published baseline backfill. Collection uses the separate additive migration documented below.
- Customer catalogue/collection endpoints are documented below. Checkout candidates remain on the existing quote response; no `/vouchers/eligible` or code-entry endpoint is introduced. Admin/Seller management retains isolated role prefixes and the [authoring contract](../../shared/voucher-authoring/spec.md).
- Collection does not reserve capacity; separate claim quotas, code-entry and cancellation reissue remain excluded. Authoring permissions, publication/version history and mutation receipts are specified separately; discovery/collection owns the additive Customer DTOs below.
- `CustomerCheckoutTest` currently covers one Shop percentage redemption, explicit multi-Shop App quote targeting, generic placement replay, stale rollback, and ownership; this is not exhaustive voucher-specific verification.
- PostgreSQL concurrency and live acceptance remain separate gates; scoped SQLite, Customer type/lint/build and synthetic browser results for each revision are recorded in the app-wide progress log.
- B06 regressions cover funding boundaries/rounding, selected pairing/caps, App funding, zero shipping, tenant isolation, whole-batch rollback, pre-fix quotes and committed replay. Connected real POD approval, recognition failure rollback, remittance and sandbox payout tests cover funded legacy Orders. Actual commands/results and limits are in the app-wide progress log; already-placed unfunded snapshots require separate remediation.
- Authority: `docs/schema.md` sections 9.10–9.14, Customer Checkout/Order Status/Modification specs, Buyer/Admin/Seller domains, shared Shipping Quotation/Finance contracts, and `docs/design.md`.


## Discovery, collection and wallet — 2026-10-11

- Flow: Collect → browse products → explicitly select at Checkout. Shop now never carries a selection into Checkout.
- String-backed distribution modes are `automatic` and `claim_required`. Admin defaults new platform drafts to claim-required and may choose automatic before first publication. Distribution locks at first publication; duplication creates an independently editable draft. Seller vouchers always require collection and expose no distribution control.
- Additive migration `2026_10_11_000001_add_voucher_collection.php` backfills existing App projections as automatic and Shop projections as claim-required. Historical versions/Orders remain immutable. The database default preserves imported platform definitions; authoring explicitly supplies its new default.
- `voucher_claims` stores UUID, Customer, Voucher and `collected_at`, with a unique Customer/Voucher pair. Collection locks the Voucher row shared with authoring/redemption. It neither reserves nor increments redemption capacity; repeated/concurrent calls return the original collection.
- First collection requires published, active, started, unexpired terms, compatible COD, Customer eligibility and remaining global/personal use. Start is inclusive and end exclusive. Already-collected replays retain the original timestamp even after publication/availability changes; the issuing Shop must remain storefront-visible for Shop endpoint access.
- Automatic offers derive from current eligible published platform definitions. No fan-out grant job or fabricated receipt exists. Upcoming automatic offers appear in Upcoming. Uncollected expired automatic offers without committed redemption never appear in History.
- Wallet includes persisted collections, committed redemption history and currently published eligible automatic offers. Available/Upcoming/History depend on current terms and committed counts; partial use stays available until personal allowance is exhausted. History includes expired, ended, globally exhausted and personally exhausted offers. Paused offers remain visible with an explanation. Hidden Shops reveal no identity and cannot accept new collection.

| Method/path under `/api/v1/customer` | Access and envelope |
| --- | --- |
| `GET /vouchers` | Public untargeted definitions; `{items, pagination}`. |
| `GET /vouchers/{voucher}` | Public published untargeted visible definition; `{data}`; otherwise 404. Expired published details remain readable. |
| `GET /shops/{slug}/vouchers` | Public issuing-Shop list; invisible/missing Shop 404. |
| `GET /my-vouchers` | Sanctum, active Customer, consent; `{items, pagination}`. |
| `GET /voucher-statuses?ids[]=UUID` | Same private gates; 1–50 distinct UUIDs; `{items}`. Eligible definitions or retained personal records only; unknown/foreign IDs omitted. |
| `POST /vouchers/{voucher}/claim` | Same gates; platform only; `{data}`. |
| `POST /shops/{slug}/vouchers/{voucher}/claim` | Same gates; exact issuing visible Shop only; `{data}`. |

- Collection accepts no body or owner/term fields and requires web CSRF or the existing Customer bearer flow. No mutation key is needed for a unique collection. Platform endpoint rejects Shop definitions; Shop endpoint rejects other Shops/platform definitions with 404. Ineligible new collections return 409 with `VOUCHER_*` availability reason; auth/consent and 429 are middleware-owned.
- Lists validate `issuer=app|shop`, `benefit=discount|shipping`, `page=1..10000`, `limit=1..50` (default 20). Wallet also validates `status=available|upcoming|history` (default available). Reject unknown/repeated/scalar-invalid filters; order by end time then UUID. Public discovery lists future published offers, including upcoming/paused/exhausted states.
- Safe DTO reuses customer-visible terms/scope and adds `currency`, `distributionMode`, `shop` (id/name/slug or null), `collectionUrl`, `collectedAt`, `collected`, `remainingPersonalUses`, `availabilityReason`, `canCollect`, `walletStatus`. Public personal fields are null. No Customer targeting lists, budgets, authoring drafts or internal funding fields appear. Private reads load only the current Customer's collections/counts.
- Public reads use credential-free shared caching (60 seconds); all personal reads/collection responses use `private, no-store`. Public resources stay unpersonalized even with cookies. Customer item targeting is omitted from discovery entirely; private enrichment never enters server caches.
- `/vouchers` provides issuer and benefit filters, pagination and expiry ordering. Shop discovery cards link to their issuing Shop; collection is available only on that Shop's section. `/vouchers/[id]` has explicit benefit/conditions/terms and collection action. Retained private history details use the bounded status read after public 404; guests see only unavailable feedback.
- `/account/vouchers` provides Available, Upcoming and History views with Platform/Shop filters, pagination and account navigation/menu entries. Shop pages place vouchers before the existing scoped product search/categories/grid/pagination.
- Guest Collect returns through login to the originating discovery/detail/Shop URL and requires another explicit click. No auto-collection or automatic application. Private state and pending replies are invalidated on Customer/session changes; malformed/offline/throttled reads never become empty successes.
- Recheck collection at quote and placement. Newly invalid placement eligibility requests reviewed refresh while committed exact-key replay still returns the original batch. Funding, rounding, explicit targets, limits, snapshots and cancellation behavior above remain authoritative.
- Deploy schema and API before dependent UI. No application database migration or production rollout is implied by source/tests. External Buyer adoption remains a separate documented gate.
