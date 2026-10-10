# Customer voucher discovery and collection — 2026-10-11

Additive Laravel contract on `feature/customer-voucher-collection`, identified by migration `2026_10_11_000001_add_voucher_collection.php`. Deploy schema/API before adopting these calls. Confirm the deployed revision; this document does not certify production deployment. Buyer Flutter adoption remains `57e9eb2`; discovery, collection and wallet client implementation are pending (G28). Preserve earlier Phase 1–5 evidence/status.

Collect → browse products → explicitly select at Checkout. A Shop-now link never selects a voucher or applies savings automatically. Codes remain display identifiers; Checkout submits UUID and explicit target Shop.

## Endpoints

All paths use `/api/v1/customer`. Public calls omit credentials and never personalize. Private calls require Sanctum, active Customer and required policy consent; bearer transport remains distinct from storefront cookie/CSRF sessions. All routes have the existing `120,1` throttle.

| Method/path | Envelope and behavior |
| --- | --- |
| `GET /vouchers` | `200 {items: CustomerVoucher[], pagination: Pagination}`; future published untargeted offers from visible Shops/platform. |
| `GET /vouchers/{voucher}` | `200 {data: CustomerVoucher}`; published untargeted definition, including expired details; missing/draft/ended/targeted/hidden Shop returns 404. |
| `GET /shops/{slug}/vouchers` | Same list envelope; issuing visible Shop only; missing/hidden Shop returns 404. |
| `GET /my-vouchers` | Private list envelope; Customer collections, committed redemptions and currently eligible automatic platform definitions. |
| `GET /voucher-statuses?ids[]=UUID` | Private `200 {items: CustomerVoucher[]}`; 1–50 distinct UUIDs, no other parameters. Eligible published definitions or retained owned records only; unknown/foreign/ineligible unowned IDs are omitted. |
| `POST /vouchers/{voucher}/claim` | Private `200 {data: CustomerVoucher}`; platform only; Shop voucher returns 404. No body. |
| `POST /shops/{slug}/vouchers/{voucher}/claim` | Private same envelope; exact issuing visible Shop; platform/foreign/hidden Shop returns 404. No body. |

Lists accept `issuer=app|shop`, `benefit=discount|shipping`, `page=1..10000`, `limit=1..50` (default 20). My Vouchers additionally accepts `status=available|upcoming|history` (default available). Unknown, repeated-array and invalid scalar filters produce field-addressable 422. Sort is end timestamp ascending, then UUID ascending. Pagination fields are `currentPage`, `lastPage`, `perPage`, `total`, all integers. Shop voucher paging is independent of Product paging.

## CustomerVoucher DTO

Required fields (nullable fields still present):

| Fields | Wire types |
| --- | --- |
| `id`, `name`, `code` | UUID, string, string |
| `issuerType`, `benefitType`, `valueType` | `app\|shop`, `discount\|shipping`, `fixed\|percent` |
| `value`, `minimumSpend`, `maximumDiscount`, `currency` | two-decimal money, money, money or null, `PHP` |
| `validFrom`, `validUntil` | ISO-8601 UTC timestamps; show Asia/Manila explicitly |
| `paymentMethod`, `termsSummary` | stored payment string or null; plain-text string or null |
| `distributionMode` | `automatic\|claim_required` |
| `scope` | existing Product/Category include/exclude arrays: `productIds`, `categoryIds`, `excludedProductIds`, `excludedCategoryIds` |
| `shop` | null or `{id: UUID, name: string, slug: string}`; hidden Shops return null |
| `collectionUrl` | relative storefront path or null; map to the Flutter issuing-Shop/detail surface, never launch as an API mutation |
| `collected`, `collectedAt` | boolean or null; timestamp or null; public reads always return null |
| `remainingPersonalUses` | nonnegative integer or null; public always null |
| `availabilityReason`, `canCollect` | reason string or null; boolean; public `canCollect` does not establish personalized eligibility |
| `walletStatus` | `available\|upcoming\|history` or null; public always null |

Never expose Customer targeting arrays, usage by other users, budgets, commissions, internal funding or working drafts. Item scope remains safe; Customer-targeted offers do not appear in public discovery. Private data/cache belongs to verified identity and session generation. Public cache is 60 seconds; private success responses are `private, no-store`.

## Availability and collection

First collection checks publication, activation, COD compatibility, start-inclusive/end-exclusive schedule, Customer targeting and global/personal remaining uses. Upcoming vouchers can be viewed but cannot be collected early. Minimum spend/item qualification and monetary savings are evaluated at Checkout, not collection.

Collection stores one Customer/Voucher timestamp, enforced by a unique constraint and the Voucher lock shared with authoring/redemption. It consumes/reserves no capacity. No idempotency header is required: retry the same endpoint after an uncertain response; repeated/concurrent calls return the original collection. An existing collection can be returned after expiry/pause/end, with its current availability reason. Shop endpoint access still requires visible issuing Shop. Automatic platform collection returns the available definition without fabricating a persisted claim.

`409` reasons include `VOUCHER_ENDED`, `VOUCHER_INACTIVE`, `VOUCHER_NOT_STARTED`, `VOUCHER_EXPIRED`, `VOUCHER_EXHAUSTED`, `VOUCHER_CUSTOMER_LIMIT`, `VOUCHER_CUSTOMER_INELIGIBLE`, `VOUCHER_PAYMENT_INELIGIBLE`, `VOUCHER_TERMS_INVALID`; Shop visibility/ownership denial uses 404. Wallet may show `VOUCHER_SHOP_UNAVAILABLE` with no Shop identity. Authentication/role/status/consent and throttling remain middleware-owned. Respect `Retry-After`; malformed/offline/timeout/5xx are failed exchanges, never empty success. Disable repeated collection while pending/cooling down and ignore departed-session replies.

## Wallet and Checkout adoption

Admin chooses platform distribution before first publication; new platform drafts default claim-required. Distribution then locks; duplicate to change it. Seller vouchers always require collection. Existing platform projections backfill automatic; Shop definitions require collection for future purchases. Historical versions, Orders and redemption savings stay immutable.

Automatic platform offers derive from current published eligible definitions for both existing/new accounts. No grant jobs, automatic best selection or claim reservation. Available includes partially used offers with uses left; Upcoming includes future retained/automatic offers. Paused offers remain visible with an explanation. History includes expired, ended, globally exhausted or personally exhausted retained offers. Uncollected expired automatic offers without a committed redemption are not fabricated as received history. Cancellation does not restore uses.

Quote candidates add `distributionMode` and `collectionUrl` while retaining their existing DTO, `eligible`, `reason`, `saving`. `VOUCHER_NOT_CLAIMED` makes otherwise eligible claim-required platform/Shop candidates unselectable. Open the proper collection surface, explicitly collect, then deliberately requote/select. Automatic platform offers require no persisted claim. Quote and placement recheck Customer-owned collection and live eligibility.

Newly invalid `VOUCHER_*` eligibility at placement maps to `409 QUOTE_STALE` before effects: refresh and review before another Place. Committed exact-key replay still returns the original Batch even after expiry/end/collection changes. Keep stacking, funding/caps, explicit Shop targeting, immutable Order snapshots and uncertain-placement recovery authoritative. No promo-code entry, automatic application, separate claim quota, cancellation reissue or new payment method.

## Client verification gate

- Implement focused DTO/repository/state ownership for discovery, detail, Shop collection and My Vouchers; retain the external Buyer's required sign-in design.
- Test public/private separation, missing versus null, scoped status IDs, targeted/history details, Shop endpoint ownership, automatic versus claimed Checkout, partial use and paused/history reasons.
- Test schedule/capacity conflicts, naturally idempotent collection after lost responses, 401/403/consent/404/409/422/429, malformed/offline/timeout and obsolete account replies.
- Verify Android/local browser, large text, focus/back, readable conditions, explicit post-login click and no automatic Checkout selection. Backend/web evidence alone closes no Flutter gate.
