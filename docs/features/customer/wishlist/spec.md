---
feature: wishlist
title: Customer Wishlist
system: AISLEY
type: Feature Specification
version: 2.1
status: Implemented (Phase 1)
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Wishlist

## WHAT

- Let an authenticated active Customer save a currently buyer-visible Product for later, remove it, and view their own persistent list at `/account/wishlist`.
- Wishlist is explicit Customer intent. It is not Cart, Recently Viewed, stock reservation, a price guarantee, a public list, or Seller analytics.
- Customer storefront owns controls, saved-state presentation, list loading/empty/error states, and Cart handoff. Laravel owns authorization, Product visibility, persistence, idempotency, and the authoritative list projection.
- Existing foundations: Customer Sanctum sessions, `User` role/status gates, `Product::storefrontVisible()`, Product Detail, Product Cards, Cart, PostgreSQL UUIDs, and the account-menu Wishlist link.
- Phase 1 is save/remove/list. Restock and price-drop alerts are Phase 2 because Customer notification read APIs/preferences are not yet implemented; the core table must not pretend alerts were delivered.
- Non-goals: guest persistence/merge, shared lists, folders, public profiles, reservation, direct purchase, Seller access to named wishlisters, or email/push/SMS alerts without an approved Customer-notification contract.

## MUST

### Access and visibility

- Every API requires `auth:sanctum`, an active approved `CUSTOMER` role, and Customer-scoped queries. Return `401`, `403`, or ownership-safe `404` consistently.
- Laravel derives `user_id`; the browser never submits the owner, a saved price, inventory, alert recipient, or authoritative visibility.
- A Product may be saved only when it satisfies the same `storefrontVisible()` rule used by Product Detail: published/active, active non-vacation Shop, and no active compliance restriction.
- A hidden, archived, restricted, deleted, suspended-Shop, or vacation-Shop Product must not appear as purchasable through Wishlist. Remove it from the ordinary list rather than leaking its internal status.
- Wishlist does not override Cart or Checkout validation. Add-to-Cart always rechecks current Product, Variant, price, and stock.

### Data and integrity

- Add one additive `wishlist_items` table with UUID primary key, `user_id`, `product_id`, and timestamps. Add a database unique constraint on (`user_id`, `product_id`) and indexes for Customer list reads and Product alert lookups.
- Use foreign keys consistent with existing Product/User retention. Do not hard-delete a Product merely because it has saved entries; decide retention/cascade behavior explicitly with the existing soft-delete policy.
- Add `wishlistItems()`/`wishlistedProducts()` relationships only where they make Customer-scoped reads clearer; do not expose a general cross-Customer relation to Sellers.
- `PUT` save is idempotent: duplicate clicks/retries yield one logical row and a successful saved response. `DELETE` is idempotent: an already-absent relation succeeds with `saved: false`.
- Save/remove races must be transaction-safe. The final committed relation is authoritative; a unique-constraint retry must not surface as a generic `500`.

### API contract

```http
GET    /api/v1/customer/wishlist?cursor=...
PUT    /api/v1/customer/wishlist/{product}
DELETE /api/v1/customer/wishlist/{product}
GET    /api/v1/customer/wishlist/status?product_ids[]=...
```

- Route parameters are UUIDs. `PUT` and `DELETE` accept no client owner or Product-state fields.
- The list is cursor-paginated, newest saved first, and returns a purpose-built current Product-card DTO plus `saved_at`; it never returns private Seller data, storage paths, buyer lists, or stale historical price as a promise.
- The status endpoint is bounded to a validated small set of UUIDs for Product rails/cards. It returns only the caller's boolean saved state and must not become an enumeration endpoint.
- Product Detail may embed `is_wishlisted` for an authenticated Customer when doing so does not weaken cache/privacy boundaries. Guests receive no Customer-specific state from public cache payloads.
- Save a missing or non-visible Product as `404`; do not distinguish Product invisibility reasons. Remove targets only the caller's relation.

### Customer experience

- Add accessible Save/Remove controls to Product Detail and reusable Product Cards. Guest activation redirects to sign-in with a same-origin return path, then requires an intentional retry; do not silently persist a guest click.
- `/account/wishlist` requires Customer auth and provides loading, empty, paginated, error/retry, and removed/unavailable-item states.
- Each saved Product uses the existing Product-card presentation and current server price/availability. The page offers Add to Cart only through the existing Cart flow; variant-required Products route the Customer to Product Detail.
- Use optimistic toggles only with pending/disabled controls, rollback on failure, and server reconciliation. Heart/icon styling cannot be the only state indicator.
- Preserve keyboard use, visible focus, readable labels (`Add to Wishlist` / `Remove from Wishlist`), and an announced non-focus-stealing success/failure message.

### Alerts: explicit second phase

- The source intent includes restock and price-drop alerts, but Phase 1 must not create fake Customer notifications or add an unviewable notification channel.
- When Phase 2 is approved, evaluate after committed Product-price and Inventory-availability changes; queue the work and recheck Product visibility, active membership, and Customer notification preferences at execution time.
- Define a durable alert-delivery/idempotency record before sending. Repeated mutations, retries, or a provider failure must not duplicate an alert or undo the Product/Inventory change.
- Price-alert baseline, Product-versus-Variant availability, alert frequency, preference UX, Customer database-notification list/read APIs, and supported channels remain open decisions. Do not use SMTP, push, or SMS by implication.

### Acceptance criteria

- [x] A guest, non-Customer, inactive Customer, or another Customer cannot list or mutate a Customer's Wishlist.
- [x] A Customer can save and remove only a currently buyer-visible Product they do not own by client-supplied identity.
- [x] Repeated/concurrent save requests create one `wishlist_items` record; repeated delete requests leave it absent.
- [x] The list is Customer-scoped, cursor-paginated, and returns current safe Product-card data plus `saved_at`.
- [x] Hidden or compliance-restricted Products neither leak through the list nor become purchasable from it.
- [x] Product Detail/Cards and `/account/wishlist` show accurate saved, pending, empty, error, and retry states accessibly.
- [x] Cart handoff reuses current Cart validation and does not reserve stock or trust Wishlist price/availability.
- [x] No restock/price-drop delivery is claimed until Phase 2 provides preferences, durable deduplication, and a Customer-readable notification contract.

## HOW

### Laravel

- Create an additive UUID migration, `WishlistItem` model, Customer-scoped policy/query, `WishlistController`, request validation, and `WishlistItemResource`/Product-card projection. Never alter an executed migration.
- Reuse Customer route/middleware conventions in `routes/api.php`, `Product::storefrontVisible()`, `ProductDetailResource` visibility rules, and `CartService` for purchase handoff.
- Resolve Product visibility inside the save transaction and again for list/status reads. Use the database unique constraint as the concurrency backstop; map duplicate-key retries to an idempotent response.
- Avoid caching Customer-specific Wishlist responses in public homepage/Product caches. Use `Cache-Control: private, no-store` where the existing Customer API convention requires it.
- Implement Phase 2 only with a Customer notification resource/controller and a dedicated evaluator/job. Laravel supports queued database notifications and after-commit dispatch, which prevents workers from observing rolled-back state. [Laravel Notifications](https://laravel.com/framework/docs/12.x/notifications)

### Next.js storefront

- Add `src/webapp/src/app/(customer)/account/wishlist/page.tsx`, a client-side wishlist API module/types, and reusable toggle/list components.
- Wire the existing Account-menu link, Product Detail purchase area, and marketplace Product Cards. Reuse the auth provider's return-path protection and the Cart provider/client instead of duplicating session or purchase logic.
- Server-render the protected route shell where appropriate; hydrate only toggle, pagination, and Cart interactions. Refetch/reconcile after focus or a failed mutation.

### Tests, rollout, and observability

- Laravel: role/status/ownership gates; Product visibility variants; save/delete idempotency; unique-race handling; pagination; status-endpoint bounds; DTO privacy; soft-deleted/archived/restricted Product behavior; and Cart revalidation after a saved Product changes.
- Storefront: guest redirect, save/remove state, retry rollback, accessible labels/announcements, empty/list pagination, unavailable Product handling, variant-required handoff, dark/light layout, and mobile controls.
- Roll out Phase 1 behind the Customer route/control only after migration and API tests pass. Add Phase 2 only after alert policy and Customer notifications are approved.
- Record safe counters for saves/removes, visibility rejections, list latency, duplicate-key recoveries, and Phase-2 job failures; never log a Customer's full Wishlist or notification payload.

### Open questions

- Should a saved Product remain visually listed as unavailable, or be silently omitted once it is hidden? This spec recommends omission to avoid disclosure.
- What is the canonical Customer notification inbox and preference model for alerts?
- Does “price drop” use base Product price, selected Variant price, promotion-effective price, or a saved-price baseline?
- Does “restock” mean any purchasable Variant, a previously selected Variant, or Product-level availability?
- Should deleting/deactivating a Customer cascade/delete wishlist rows or retain them under the existing privacy-retention policy?

## Implemented baseline (2026-09-02)

- Phase 1 save/remove/list/status behavior is implemented with the UUID-backed `wishlist_items` table. User and Product hard deletion cascade the relation; Product soft deletion and every other storefront-visibility failure omit it without exposing the reason.
- Customer list and mutation APIs are protected by the existing active-Customer middleware, reject client-owned mutation fields, return private no-store responses, and use authenticated ownership plus the canonical `storefrontVisible()` scope.
- Saves and removals serialize on the Customer row, remain idempotent, and use unique (`user_id`, `product_id`) as the database concurrency backstop.
- Product Cards and Product Detail share a batched, focus-reconciled Wishlist provider with explicit text labels, optimistic rollback, pending controls, and guest login return paths. `/account/wishlist` provides cursor loading, empty/error/retry states, removal, and current Cart handoff.
- Variant Products route to Product Detail for option selection; simple Products call the existing Cart API, which revalidates current visibility, availability, and price.
- Restock/price-drop alerts, Customer notification preferences/inbox, external delivery, folders, sharing, and guest-list merge remain deferred Phase 2 work.
