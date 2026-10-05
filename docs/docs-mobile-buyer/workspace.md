# Buyer shopping workflows

> Implementation, SDK/package resolution, tests, builds and browser results in this guide are reports from the external Buyer Flutter project and were not rerun here. This bundle contains documentation; `lib/`, tests, tools, lockfiles and build reports belong to that project. Current shipping-contract adoption remains [G25](references/integration-gaps.md).

Phases 1–4 Flutter flows are implemented with partial acceptance; controlled authenticated and installed-device gates remain open. See [Phase 4 evidence](references/phase-4-verification.md), [Phase 3 evidence](references/phase-3-verification.md). [API guides](api/endpoints.md) define existing backend calls; [feature index](features/README.md) assigns ownership.

## Navigation

Use native bottom destinations **Home**, **Shops**, **Cart**, **Account**, with search reachable from discovery screens. These bottom destinations are implemented. Account links to Profile, Addresses, Orders, Wishlist, Recently Viewed, Notifications, Shop messages, Logistics messages, Courier messages, Support tickets, Settings/promotional preference, Policies/consent, and Logout. Distinct channels can share compatible rendering widgets while retaining separate repositories, routes, eligibility and read state.

Product/Shop/Order detail and forms open on the current navigation stack; Android Back and browser Back return predictably. Validate destination IDs and allow-listed return routes, including notification web-path mapping. A signed-out user opening any shopping destination sees sign-in and a validated read return; the app requires an intentional retry of a protected mutation after sign-in.

## Registration, sign-in and access

Profile + credentials → pending Customer/Application (no token) → informational approval screen → Admin decision outside the app → login with `device_name` → securely stored Customer token → `/me` → consent status → required Terms/Privacy read and explicit acceptance → private shopping. Keep account-state denial distinct from invalid credentials and network/storage failure. There is no applicant status-polling API. Recovery requests are generic; emailed reset links currently target the storefront.

At cold start, show session checking/retry and hide every shopping widget/navigation while one controller restores the stored token through `/me`. Recheck required consent. On logout, revoke the current token when online and clear local private state. An uncertain revocation requires truthful feedback; account switching must still clear the old identity and reject delayed responses.

## Discovery and Product configuration

Home rails → Products/Shops search or Shop storefront → visible Product Detail → gallery, safe description, current price/availability → choose only a complete server-listed variant combination and bounded quantity → Add to Cart or Buy Now. Recently Viewed records a successful authenticated detail visit using server time/retention. Never write/merge guest hints. Remove only the retired public hints key best-effort without delaying authentication.

## Address and checkout

Address Book → Region → Province → City/Municipality → Barangay, manual street/postal fields → optional intentional Pin location → reviewed coordinates → save a shipping/both row. Parent changes clear invalid descendants; edited location text clears stale coordinates. Manual save survives data/provider/GPS failure.

Buy Now intent or selected Customer-owned Cart item IDs → saved shipping address + COD + optional voucher UUID/target Shop selections → provider options per Shop → explicit provider choice (single-option server fallback) → quote → display each Shop's lines, shipping, savings and exact collectible total → explicit Place order → same reviewed intent + `quote_id` + UUID `Idempotency-Key` → atomic server transaction → CheckoutBatch and one Order per Shop → confirmation/Orders.

Changing items, address, vouchers or logistics selections requires a fresh quote. The provider option/choice and changed DTO flow is a current contract target, not established by imported Phase 3 client evidence (G25). A stale quote requires review and another Place action. A timeout after placement is uncertain: retain the exact key/payload and retry/reconcile; do not generate a second key or assume failure. The batch API needs a known batch UUID, so it is not an arbitrary lookup by idempotency key. Purchased selected Cart lines are removed after commit; Buy Now leaves the Cart unchanged.

## Order lifecycle and permitted corrections

| Buyer tab | Canonical server statuses |
| --- | --- |
| To Pay | `pending_payment` (future online-payment path) |
| To Prepare | `placed`, `seller_processing`, `ready_for_pickup` |
| To Ship | `picked_up`, `assigned`, `in_transit` |
| Out for Delivery | `out_for_delivery` |
| Completed | `delivered` |
| Cancelled / Issue | `cancelled`, `rejected`, `delivery_failed`, `return_requested`, `returned` |

COD begins `placed`/pending payment. Seller acceptance starts processing; prepared pickup freezes a shared waybill; accepted first-mile Courier confirms Seller handoff; Logistics receives/sorts/transfers/dispatches; accepted final-mile Courier performs delivery evidence/intent; Logistics validates and commits authoritative completion. Buyer reads safe projections only. An Order's `assigned` Courier display alone does not authorize Courier chat.

While the server permits an owned `placed` Order, Customer can confirm cancellation with optional reason or correct its delivery address using an owned shipping/both row. Each write has a UUID key; modification may carry the expected revision. Seller processing closes this window. Correction produces a new immutable snapshot version and must preserve financial/serviceability rules; current shipping-rate/coverage revalidation is a recorded backend gap (G21), requiring owner review for material-location changes. Phase 3 permits only recipient/contact changes with identical trimmed street/locality/postal/country fields; empty optional line two is null and unverifiable locations are blocked. Changes to Address Book never reroute an Order automatically. Item, quantity, voucher, repricing, return and refund changes remain deferred.

## Communication and after delivery

Shop/Product/owned Order → Shop composer → first committed message creates/reuses one Customer–Shop thread. Active owned Order → Logistics composer with Order context → server resolves current handling organization/hub. Owned Order → private Courier Order-context read → accepted-final-mile eligibility → first message creates the task-specific Courier thread. Ended/reassigned relationships keep only authorized read-only history; replacement participants never inherit private transcripts.

Polling while visible/online, ordered cursor history and monotonic reads provide foreground messaging. Freeze uncertain text/key for exact retry; no offline-send queue. Support-ticket create/reply uses its own keys and revision rules. Notifications link to allowed screens but cannot advance any business status.

Delivered owned Order Item → server review capability → rating/plain-text review → canonical Review result → up to configured photo limit via separate uploads. Review creation replays identical content by Order Item; image uploads have no replay guarantee. Reconcile each uncertain image response before uploading another copy. Seller official review response is read-only. Q&A remains public Product knowledge and does not require a delivered purchase.


## Concrete app routes and safe entry rules

These are **Flutter navigation paths**, not new APIs. Use go_router branches for /, /shops, /cart and /account. Compose detail stacks for /shops/:slug, /products/:id, /checkout, /checkout/result/:batch, /orders/:order, /account/profile, /account/addresses, /wishlist, /recently-viewed, /notifications/:id, /messages/shops/:id, /messages/logistics/:id, /messages/courier/:id and /support-tickets/:id. Separate /login, /register, /approval and /policies/:type reader/consent routes avoid private-data flashes. Detail IDs are UUIDs except Shop slug; root list paths exist independently from detail paths.

| Entry | Required behavior |
| --- | --- |
| Signed-out shopping entry | sign-in with allow-listed read return; root sign-in has no shopping escape |
| Restoring token | one /me, then consent; no shopping widgets or catalog fetch before verification |
| Required policy publication | preserve identity; reader confirms exact version; status refresh unlocks safe read |
| Product Add Cart | complete variant/quantity, active Customer/consent; additive mutation has no durable replay |
| Product Buy Now | creates intent without changing Cart; owned address/COD quote/review before Place |
| Selected Cart checkout | only distinct owned selected available lines; one current quote intent |
| Notification destination | map known Order/Product/Shop/Q&A/review routes; unknown falls back to detail |
| Delivery Courier contact | private order-context read first; eligible start vs authorized readonly history |
| Logout/account switch | cancel/reject old requests and erase all private state before new identity |

Account links remain separate from role operational navigation. Unsaved forms ask before discarding; back/cancel never silently repeats a write. Native reset links stay with trusted storefront until link deployment is approved.

## Recovery journeys

A stale quote asks for reviewed refresh, not automatic Place. A lost placement response retains the exact in-session key/intent and offers exact retry; only a known Batch UUID can be reread. Process-death uncertainty remains unresolved without approved durable recovery, and no GET-by-key exists. Cart add/image upload uncertainty first rereads authoritative state; another click is a deliberate new action, not automatic network recovery.

Scoped Order denial clears the Order and its contact context; account-wide denial clears every private repository. Consent denial retains authentication while protected actions stop. Secure-storage failure is a retry state that fails closed, not a valid signed-in flag. Offline logout can clear local state but must explain remote revocation is unconfirmed.

Visible online chats poll at15s and on focus/reconnect, preserving pending first-send intent and reachable older history. Background/offline pauses timers. Reassignment/ended custody replaces contact eligibility and makes original authorized history readonly; transcripts are never copied between participants. Support detail uses Laravel’s request-bound cursor resolver. Preserve returned older cursors and verify traversal beyond the first history page.

## Feature implementation sequence

Implement root configuration/token/session/error/router composition and shared consent first. Then public discovery/Shop/Product DTOs and navigation; account/PSGC addresses/wishlist/account history; Cart/quote/vouchers/place and owned Order projections; independent channels/notifications/Q&A/reviews/support. Each phase uses its own repositories/controllers and tests without importing another role’s screens. Reuse focused presentation widgets only when wire/permission/state ownership stays separate. See [architecture](architecture.md) and [setup](setup.md).
