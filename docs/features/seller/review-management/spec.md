---
feature: review-management
title: Seller Review Management
system: AISLEY
type: Feature Specification
version: 2.1
status: Implemented MVP; response editing/deletion, moderation/reporting, and dashboard aggregates remain deferred
role: Seller
scope: Seller React dashboard and Laravel API
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Seller.md, docs/features/customer/product-review-ratings/spec.md, docs/design.md
---

# Seller Review Management

## WHAT

- Let the active Seller owning a Product read its verified Customer reviews and publish one accountable Shop response.
- `seller` is the persisted/API role. Authority is derived as `review → product → shop → seller`; “Customer” is the canonical review author role.
- Customer Product Reviews owns delivered-purchase eligibility, rating/body/photos, publication, and Product aggregates. This feature owns Seller queue/detail reads and the official response.
- Current implementation: `product_reviews`, approved review images, public review reads, Product aggregates, Seller queue/detail/photo routes, immutable Shop responses, deterministic notifications, Seller screens, and storefront Shop-response projection are implemented. No Seller dashboard aggregate exists.
- Flow:
  ```text
  Customer review commits → Seller inbox alert → Seller opens owned review
  → submits one response → transaction commits → public Product review shows Shop response
  → Customer receives an in-app notification
  ```
- MVP non-goals: editing/deleting a response, drafts, moderation/reporting, Customer-review takedown, multiple replies, attachments, Markdown/HTML, AI responses, helpful votes, private messaging, and changing Customer content or aggregates.

## MUST

### Seller scope and safe review reads

- Require `auth:sanctum`, `seller.active`, and policy consent on every Seller review route.
- Scope every query through the authenticated Seller's one Shop and the reviewed Product. Never trust client `seller_id`, `shop_id`, `product_id`, Customer ID, status, author, or recipient fields.
- Another Seller, Customer, Admin, inactive account, same-email cross-role record, unknown UUID, or foreign Review cannot read or respond; use ownership-safe `403/404`.
- Seller history includes published Reviews for Seller-owned active, draft, archived, vacation, or soft-deleted Products. Product visibility controls public display, not Seller ownership history.
- Return only the anonymized “Verified Customer” label, rating, plain-text body, approved photos, review time, Product/variant purchase snapshots, and current response state.
- The verified-purchase label remains server-derived from the existing Review/Order Item ledger; the Seller cannot add, remove, or override it.
- Never expose Customer UUID/email/phone/address, Order or Order Item identifiers, payment data, registration evidence, raw image paths, internal checksums, or unrelated purchases.
- Approved photos for a hidden Product require an authenticated Seller-owned image stream; do not weaken the existing public image endpoint's `storefrontVisible()` check.

### Implemented API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/seller/reviews` | Seller-scoped, paginated review queue |
| GET | `/api/v1/seller/reviews/{review}` | Safe review/Product/response detail |
| POST | `/api/v1/seller/reviews/{review}/response` | Publish the single Shop response |
| GET | `/api/v1/seller/reviews/{review}/images/{image}` | Authorized approved-photo stream |

- List filters: `status=all|unanswered|answered`, optional owned `product` UUID, optional integer `rating=1..5`, `per_page=1..50`, and page. Default ordering is `created_at DESC, id DESC`.
- `unanswered` means no committed Seller response; `answered` means one published response. Do not add moderation-state filters while moderation is deferred.
- List items contain Review ID, rating/body/time, verified label, approved-photo summaries, Product/variant snapshots, and nullable response summary. Detail uses the same names rather than a second incompatible projection.
- Pagination returns current page, last page, per-page, total, and deterministic navigation links using existing Laravel Resource conventions.
- Detail/list responses are `Cache-Control: private, no-store`; the image stream is private/no-store and `nosniff`. Public Product review caching remains separately visibility-scoped.
- Return `401` unauthenticated, `403` inactive/wrong role or consent gate, scoped `404` unknown/foreign Review or image, `409` response/idempotency conflict, `422` invalid filters/body/header, and `429` throttling.

### One immutable public response

- Accept JSON `{ "response": "..." }` and require a UUID `Idempotency-Key`; reject unknown fields.
- Normalize trimmed Unicode and line breaks. Require plain text of 1–2,000 characters; reject control characters and HTML/Markdown/executable embeds.
- The Seller may respond only to a published Review whose Product belongs to the Seller's Shop. Product visibility is not required to preserve historical response work.
- Store exactly one logical response per Review, enforced by a unique `review_id` constraint and row locking.
- Persist response UUID, Review, Seller actor, Shop, immutable Shop-name snapshot, body, string-backed `published` status, idempotency key/request hash, `published_at`, and timestamps.
- The first valid request publishes immediately. An identical replay with the same key returns the committed response; reusing the key with different content or submitting a different second response returns `409`.
- Lock the Review and response lookup in one transaction, then rely on the unique Review constraint as the final concurrent-write guard. A losing duplicate request refetches the authorized result or returns the stable conflict.
- MVP responses are immutable after publication. No PATCH/DELETE endpoint exists. Future editing requires an approved version-history and notification policy through an additive migration.
- The response never changes Customer rating/body/photos/status, Product `average_rating`/`review_count`, verified-purchase evidence, Order history, or Q&A.
- If a future moderation action hides the parent Review, the response remains retained but disappears from the public projection with it; Seller Review Management cannot restore either record.

### Public projection and notifications

- Extend the existing public Product Review resource's reserved `sellerResponse` field only after response persistence exists.
- Public `sellerResponse` contains response ID, Shop-name snapshot, escaped body, and publication time only when the parent Review is published and Product is `storefrontVisible()`.
- Public reads never expose the responding User ID, idempotency key/hash, internal status, notification identifiers, or response persistence metadata.
- Customer review creation should emit one deterministic after-commit `seller-product-review.published` database notification to the owning active Seller. Do not retroactively create alerts for historical Reviews.
- Emit that Seller alert only when a Review is newly created, not when the Customer replays an already committed identical request.
- Response publication emits one deterministic after-commit `customer-product-review.responded` database notification to the Review's Customer.
- Add both types to the respective notification allowlists and safe destination rules: Seller `/reviews/{review}`; Customer `/products/{product}#product-reviews`.
- Notifications contain bounded Product/Review references and safe summaries, never Customer PII, Order identifiers, full review/response text, or storage paths.
- Notification delivery/read-state failure cannot undo or hide a committed Review/response. Opening or marking an alert read never publishes a response.
- If alert delivery is delayed, the Seller queue and Customer Product Detail remain the authoritative discovery surfaces.

### Seller React experience

- Add protected routes `/reviews` and `/reviews/:reviewId`, plus a Review Management sidebar entry under the existing Seller design system.
- Queue UI provides bounded status/Product/rating filters, pagination, safe Product context, numeric/text rating, response state, loading, empty, filtered-empty, retry, and session/consent states.
- Detail UI shows safe Customer review text/photos, Product/variant snapshots, response form or immutable published response, and truthful conflict/throttle/offline states.
- Generate one UUID idempotency key per logical submit and retain it across uncertain retries. Never claim publication before the server returns the committed projection.
- Use escaped plain text, keyboard-operable controls, labelled rating text, visible focus, accessible status announcements, responsive layout, and dark-mode contrast from `docs/design.md`.
- Keep the Seller dashboard Review summary unavailable until a separately implemented aggregate can return authoritative counts.

### Acceptance criteria

- [x] Only the active owning Seller can list/view Reviews and authorized photos for Products in that Seller's Shop.
- [x] Seller DTOs omit Customer/Order/payment PII and raw storage metadata while preserving safe Product purchase snapshots.
- [x] Filters, ordering, and pagination are bounded, deterministic, and tenant-scoped.
- [x] One published response per Review is enforced under retries and concurrent requests with stable idempotency behavior.
- [x] Plain-text validation and authorization are server-enforced; Seller cannot mutate Customer content or Product aggregates.
- [x] Public Product reviews expose the Shop response only through the existing visibility rules.
- [x] Seller and Customer alerts are deterministic, after-commit, allow-listed, privacy-safe, and their delivery/read state cannot mutate a Review or response.
- [x] Seller list/detail/form screens provide the specified responsive and accessible states.
- [x] SQLite and PostgreSQL tests cover migration, IDOR, locking, replay/conflict, DTO privacy, public visibility, notifications, and aggregate invariance.

## HOW

- Add a new migration/model for `seller_review_responses`; do not modify the executed Product Review migration. Use PostgreSQL-safe string state and unique `review_id`, Seller/Shop/time indexes.
- Keep Seller responses in their own table instead of adding mutable response columns to the immutable Customer-authored Review record.
- Restrict Review/Seller/Shop deletion while a response exists, matching the Review ledger's historical-evidence policy; do not cascade away a published response.
- Add Seller list/detail/respond Form Requests, scoped controller/service, Seller Resource, response Resource, and focused policy/query. Keep controllers thin and lock the Review/response rows inside the service transaction.
- Reuse the implemented `ProductReview`, Product/Shop ownership chain, safe approved-image metadata, database notification infrastructure, and Customer Product Review resource; do not duplicate Reviews.
- Dispatch deterministic notification jobs through `DB::afterCommit`; update Seller/Customer notification allowlists, safe deep-link projections, and tests in the same change.
- Add modular Seller API/types/hooks and separate review list/detail/response components rather than extending an overloaded dashboard page.
- Verify migrations and feature tests on SQLite and PostgreSQL; run Seller lint, TypeScript, production build, API formatting, and responsive/browser checks before marking criteria complete.
- Test archived/soft-deleted Product history separately from public storefront visibility so Seller access never accidentally makes hidden review media public.
- The schema/API and Seller navigation are deployed together. Existing public Review reads remain compatible because `sellerResponse` stays nullable.
- `docs/schema.md`, the Customer review spec's implementation boundary, and Seller domain/progress metadata are synchronized with the implementation.
- Observe scoped denials, validation/throttle/conflict rates, response and notification failures without logging full Customer review or Seller response bodies.

**Sources:** `docs/features/customer/product-review-ratings/spec.md`, `docs/schema.md`, `docs/domains/Seller.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/design.md`, [Laravel Authorization](https://laravel.com/docs/12.x/authorization), [Laravel Database Transactions](https://laravel.com/docs/12.x/database#database-transactions), and [Laravel Notifications](https://laravel.com/docs/12.x/notifications).
