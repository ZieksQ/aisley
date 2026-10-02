---
feature: product-review-ratings
title: Customer Product Reviews and Ratings
system: AISLEY
type: Feature Specification
version: 2.1
status: Implemented Customer MVP and public Seller-response projection; editing, moderation, and video remain deferred
role: Customer
scope: Laravel API and Customer storefront
---

# Customer Product Reviews and Ratings

## WHAT

- Let a purchasing Customer rate and describe each delivered Order Item's Product, with optional approved photos.
- `customer` is the persisted/API role; “Buyer” is storefront language. Reviews evaluate Products, never Couriers, Shops, or delivery performance.
- The Customer Order Detail offers a review action per eligible line. Product Detail shows a rating summary and paginated verified reviews; a Seller response may appear through the same review record.
- Product Q&A, disputes, Courier feedback, and Seller Review Management remain separate feature owners.
- Use `docs/references/file-upload-requirements.md` as the mandatory image-upload contract; add only review-specific ownership, count, lifecycle, API, and UI rules here.
- Customer editing/deletion, moderation/reporting, helpful votes, threaded replies, video, and return/refund effects are deferred. Seller response editing/deletion is also deferred, not initial response creation.

### Current implementation boundary

- Orders, immutable Order Items, `OrderStatus::Delivered = 'delivered'`, and Logistics-validated delivery completion exist.
- Product Reviews, review-image metadata, the delivered Order Item mutation, public read API, Product Detail review list, and Order Detail review form are implemented.
- Product aggregates are recomputed from published persisted Reviews; the Product catalog seeder now resets demonstration rating/count values to an empty projection.
- Seller replies are implemented by `docs/features/seller/review-management/spec.md`; this Customer feature still owns review authorship, eligibility, media, and rating aggregates.

## MUST

### Eligibility and identity

- Creation and image uploads require `auth:sanctum`, `customer.active`, and current policy consent. The server derives Customer identity; no client ownership, publication, or notification-recipient fields are accepted.
- Resolve the supplied Order Item through a Customer-owned Order; require the authoritative Order status to be `delivered` and the Item's Product reference to remain valid.
- One Order Item permits at most one Product Review, even if its quantity exceeds one. A later delivered purchase of the same Product is a distinct eligible Item.
- The Customer cannot review a cart, wishlist, cancelled/rejected/failed Order, another Customer's Item, or a Product ID supplied without the purchased Item.
- Use the purchased Item's Product and optional variant identity and immutable name snapshot. Product changes do not rewrite historical purchase or review identity.
- A new Review requires a resolvable, non-soft-deleted Product. A missing Product reference returns `PRODUCT_REVIEW_PRODUCT_UNAVAILABLE`; preserve Order history rather than inventing replacement purchase evidence.
- An archived, hidden, or restricted Product may still be reviewed from a valid delivered Item while it exists; its review is not publicly listed until the Product is `storefrontVisible()` again.
- Order Detail derives `canReview` from delivered status, a non-null Product reference, and no existing Review; `reviewId` identifies any existing Review. These are hints, not authority: creation rechecks the owned Item, Order, and resolvable Product.

### Review contract and lifecycle

- Accept only `{ rating, body }`: integer rating `1`–`5`, trimmed body `1`–`2000` characters. Normalize line breaks and Unicode when available; reject unsupported fields, control characters, HTML, and disallowed Markdown. Render all accepted content as text.
- Persist an immutable review UUID, Customer, Order, Order Item, Product, purchased-variant reference/snapshot, rating, body, creation time, and publication state.
- One Review per Order Item is protected by row locks and a database unique constraint. Retry with the same Item and normalized rating/body returns the existing authorized Review (`200`); changed content returns `409 PRODUCT_REVIEW_ALREADY_SUBMITTED`, never an implicit edit. This Customer POST does not require an `Idempotency-Key` header.
- The initial MVP publishes a valid text/rating review on successful commit. Media attachment can complete separately; a failed upload does not roll back the committed review.
- Customer edit/delete, moderation/reporting, helpful votes, reply threads, return/refund effects, and post-pickup cancellation policy are deferred. Do not invent endpoints or silently remove historical reviews.
- Seller response creation and ownership checks belong to Seller Review Management. The Seller may not edit Customer rating, body, media, or verified-purchase state.

### Photos and public visibility

- A Customer may attach up to five optional photos to their own Review, one multipart `image` per request. Apply the shared policy's JPEG/JPG, PNG, WebP, strictly-under-10-MiB, detected-type, signature, extension, and decode requirements.
- Current feature defaults also bound each edge to 8,000 pixels and total pixels to 40 million; the decoder rewrites accepted bytes to strip metadata. These review-specific resource bounds do not replace the shared policy.
- Use generated storage keys and feature-owned asset records; never expose raw storage paths, credentials, original filenames as identifiers, or private Order identifiers.
- Current synchronous validation stores successful assets as `approved`; there is no deployed review malware-scan queue or pending-upload DTO. If scanning is introduced, revise the owning contract and keep pending/failed assets inaccessible under the shared policy.
- Photo attachment requires review ownership. Replacement/removal remain deferred with review editing; uploaded or orphaned assets need explicit cleanup, and cross-Customer attachment is forbidden.
- Public reads require `storefrontVisible()` for the Product and return only published Reviews. A hidden Product's review history remains private rather than leaking through a standalone URL.
- Public DTOs show rating, safe text, verified-purchase label, safe photo URLs, date, and safe Seller response. Use an anonymized “Verified Customer” label; omit email, phone, address, Customer/Order/Order Item IDs, and private evidence.
- Each image POST creates a new asset; neither a content checksum nor a supplied header gives exactly-once upload retries. Response-loss/retry deduplication remains unverified and must not be claimed as implemented.

### Aggregates and reliability

- Product `average_rating` and `review_count` reflect only real, published Product Reviews; Courier/Q&A feedback and demo seed values are excluded.
- The Reviews table is authoritative. Update or reconcile persisted Product aggregates transactionally with review publication changes; never derive the authoritative average from one paginated frontend page.
- Before exposing real review counts, reset/recompute seeded Product rating/count values from persisted Reviews or clearly isolate fixture-only data.
- Review and media mutations authorize the Item/Review before storage access, validate server-side, and apply scoped rate limits. Private eligibility/mutation responses are `no-store`.
- New Reviews dispatch the implemented `seller-product-review.published` alert to the owning active Seller after commit; identical review replays do not redispatch it. Notification jobs use deterministic IDs; delivery failure cannot undo the Review.
- Seller response publication emits `customer-product-review.responded`, linking to Product Detail's `#product-reviews`. Queue/notification failure does not undo a committed response; no email, push, or realtime guarantee is implied.

### API contract (implemented MVP)

| Method | Path | Authority | Result |
| --- | --- | --- | --- |
| GET | `/api/v1/products/{product}/reviews` | Guest or Customer; visible Product | Bounded newest-first page and authoritative rating summary |
| GET | `/api/v1/product-review-images/{image}` | Public-eligible approved image | Visibility-checked image stream |
| GET | `/api/v1/customer/orders/{order}` | Owning Customer; existing route | Item `canReview` and nullable `reviewId` |
| POST | `/api/v1/customer/order-items/{orderItem}/review` | Owning Customer; delivered Item | JSON `{ rating, body }` → `201 { data: Review }`, or `200` exact replay |
| POST | `/api/v1/customer/reviews/{review}/images` | Review-owning Customer | Multipart `image` → `201 { data: Photo }` |

- The listed paths are deployed by the Laravel API. Seller response management is implemented through its separate Seller contract; video support remains deferred.
- Use `401` for unauthenticated, ownership-safe `403/404`, `409` for duplicate/stale state, `422` for field/media validation, and `429` for throttling. Do not reveal whether another Customer's Item/Review exists.
- Public query parameters are `page` (`1`–`10000`, default `1`) and `limit` (`1`–`50`, default `10`). Ordering is fixed at `created_at DESC, id DESC`; rating filters, alternate sorts, and cursor pagination are not implemented.
- List response is `{ data: Review[], links, meta, summary }`; Laravel page metadata includes `current_page`, `last_page`, `per_page`, and `total`. Summary contains `averageRating` (null when empty), `reviewCount`, and `distribution` for ratings `1`–`5`.
- Keep the Product review list and rating summary on the same Product visibility and publication filter to avoid count/list disagreement.
- Review fields are `id`, `rating`, `body`, `verifiedPurchase`, `authorLabel`, `createdAt`, `photos`, and nullable `sellerResponse`. Photo fields are `id`, `url`, `mimeType`, `width`, and `height`; timestamps are ISO-8601/null as declared by the Resource.
- `sellerResponse` is already deployed: `{ id, shopName, body, publishedAt }` for a published, non-future response, otherwise null. Customer UI displays it read-only; only Seller Review Management owns response writes.
- Public review lists use `Cache-Control: public, max-age=30` and `Vary: Accept, Authorization, Cookie`; eligible photo streams use `public, max-age=300` and `nosniff`. Owned Order/Review mutations remain private/no-store; never put eligibility or Customer identity in shared public DTOs.
- `409` codes distinguish `PRODUCT_REVIEW_NOT_ELIGIBLE`, `PRODUCT_REVIEW_PRODUCT_UNAVAILABLE`, `PRODUCT_REVIEW_ALREADY_SUBMITTED`, and `PRODUCT_REVIEW_IMAGE_LIMIT_REACHED`. Validation returns field-addressable `422`; wrong ownership stays scoped `404`.
- Public list/image reads are throttled at `120/minute`; mutations use the existing review/image named limiters. Preserve `POLICY_CONSENT_REQUIRED` handling and do not create a new auth gate here.

### Customer experience

- Order Detail shows Rate/Review only on a delivered eligible line, and “Reviewed” for an existing review; the form rechecks server results on submission.
- Product Detail uses 10-row pages and **Load more reviews**, displaying the authoritative average/distribution, verified cards, photos, and **Response from {Shop name}**. No Seller response appears as Customer-authored text.
- Follow `docs/design.md`: keyboard-operable labelled 1–5 rating input, clear required-text errors, accessible upload progress and retry, and responsive loading/empty/error states.
- Handle `401`, forbidden/not found, `409`, `422`, `429`, timeout, and offline outcomes without showing an uncommitted review as published.
- Existing uploads run sequentially after text/rating commit and show per-photo progress plus retry on failure; do not promise response-loss deduplication. A failed photo must not invite another text-review submission.
- Follow the light-only, mobile-first web design and Jakob's Law guidance; preserve recoverable input, readable statuses, keyboard focus, and ordinary rating/form navigation. Static checks do not certify browser accessibility or uncertainty recovery.

### Acceptance criteria

- [x] Only the owning active Customer can review a delivered Order Item; forged Product/Customer/Order IDs and pre-delivery Orders are rejected.
- [x] Identical normalized review replay returns the same UUID without changing aggregates; a different rating/body conflicts rather than editing the Review.
- [x] Rating/body validation, plain-text output, and rejection of client ownership fields are implemented and covered by focused API tests.
- [x] Product visibility controls public review listing; historical Reviews remain intact, and Seller photo access does not make archived media public.
- [x] Public DTOs omit Customer and Order PII; Seller responses cannot alter Customer content.
- [x] Aggregate values come from real published Reviews, exclude Courier/Q&A feedback, and do not expose seeded fixture counts as verified reviews.
- [x] Order Detail exposes server review hints; Product Detail and Order Detail implement listing, response display, review submission, and photo progress/retry.
- [x] New-review and Seller-response alerts are implemented without redispatching identical review replays; response visibility and aggregate invariance have focused regression coverage.
- [ ] Verify independent delivered purchases and simultaneous first submissions on PostgreSQL: one Review per Item, one aggregate increment, and no duplicate notification.
- [ ] Verify image count/byte/dimension/type/signature boundaries, corrupt/spoofed files, cross-Customer ownership, hidden public images, storage failure, and cleanup against the shared policy.
- [ ] Verify uncertain photo-response retries and after-commit notification failure; never claim exactly-once asset creation from the current upload contract.
- [ ] Verify pagination/refresh races, partial uploads, offline/session/consent recovery, and keyboard/narrow-viewport behavior in the live Customer browser.

Checked items identify inspected implementation and existing regression evidence, not tests rerun during this revision. Unchecked items are remaining verification work, not permission to omit those requirements.

## HOW

- Reuse deployed `product_reviews`, `product_review_images`, and `seller_review_responses`; preserve unique `order_item_id`, unique image position, restrictive purchase/author FKs, and nullable Variant linkage. Do not recreate tables or modify executed migrations.
- Future schema extensions require additive migrations; retain immutable Product/Variant purchase snapshots and string-backed publication state. Review tables do not change Order, payment, Inventory, or custody transitions.
- Review-image records store owner, Review, generated object key, validated MIME/size/dimensions, safe ordering, and processing state. A photo cannot be reused across Reviews by passing its asset ID.
- Maintain `Customer/ProductReviewController`, existing Form Requests/Resources, and `Customer/ProductReviewService` ownership queries and transactions. Do not invent a missing Policy class or a second Review store.
- Treat one logical create as idempotent: the same Customer and Order Item must receive the same committed Review projection on a safe retry; changed payloads after creation receive a conflict rather than an implicit edit.
- Keep existing `OrderResource` hints and `ProductReviewResource`/`ProductReviewImageResource` camelCase DTOs compatible with `src/webapp/src/lib/reviews/{client,types}.ts`.
- Store images through the configured review asset disk; the current service validates, decodes, rewrites, persists metadata, and attempts orphan cleanup on failure. Reference the shared policy; do not claim an absent common upload service or scan worker.
- Keep aggregate repair repeatable so rollout can replace fixture ratings and recover from any interrupted publication or media-processing job without altering Customer-authored review history.
- Product Detail should clearly separate the aggregate rating from the currently fetched page; empty state must not fabricate review cards from seed counts.
- Test SQLite and PostgreSQL migrations and API ownership/IDOR, delivery eligibility, duplicate races, aggregates/seed reconciliation, hidden Products, media spoofing and privacy, and upload failure. Test keyboard, pagination, retry, and upload states in the Customer storefront.
- `ProductReviewTest` currently covers ownership/delivery, identical replay/conflict, aggregates, hidden lists, hints, and invalid fields/markup; Seller regressions cover public responses, scoped photo reads, and notifications. They do not establish all image, multi-worker, or browser gates above.
- Seller response creation is implemented under its owning spec. Video, moderation, and either role's editing/deletion require separate approved contracts, not invented Customer endpoints.

### Sources

- Canonical project context: `docs/domains/Buyer.md`, `docs/domains/Seller.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, and Customer Order Status.
- Shared upload policy: `docs/references/file-upload-requirements.md`.
- Implementation evidence: `src/api/routes/api.php`, Customer review Requests/Resources/Service, `src/api/config/customer.php`, Product Review migrations/models, and `src/api/app/Jobs/Reviews/DeliverProductReviewNotification.php`.
- Client and verification evidence: `src/webapp/src/components/{reviews,product}/`, `src/webapp/src/lib/reviews/`, Customer `ProductReviewTest.php`, Seller `SellerReviewManagementTest.php`, and dated `docs/PROGRESS.md` archives. Seller response authority: `docs/features/seller/review-management/spec.md`.
