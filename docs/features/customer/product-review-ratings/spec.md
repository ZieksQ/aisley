---
feature: product-review-ratings
title: Customer Product Reviews and Ratings
system: AISLEY
type: Feature Specification
version: 2.0
status: Implemented MVP; moderation, editing, and Seller responses remain deferred
role: Customer
scope: Laravel API and Customer storefront
---

# Customer Product Reviews and Ratings

## WHAT

- Let a purchasing Customer rate and describe each delivered Order Item's Product, with optional approved photos.
- `customer` is the persisted/API role; “Buyer” is storefront language. Reviews evaluate Products, never Couriers, Shops, or delivery performance.
- The Customer Order Detail offers a review action per eligible line. Product Detail shows a rating summary and paginated verified reviews; a Seller response may appear through the same review record.
- Product Q&A, disputes, Courier feedback, and Seller Review Management remain separate feature owners.
- Video reviews remain a future goal, not an MVP upload: the shared `docs/references/file-upload-requirements.md` covers images only. A dedicated video policy and processing contract are required first.

### Current implementation boundary

- Orders, immutable Order Items, `OrderStatus::Delivered = 'delivered'`, and Logistics-validated delivery completion exist.
- Product Reviews, review-image metadata, the delivered Order Item mutation, public read API, Product Detail review list, and Order Detail review form are implemented.
- Product aggregates are recomputed from published persisted Reviews; the Product catalog seeder now resets demonstration rating/count values to an empty projection.
- Seller replies are implemented by `docs/features/seller/review-management/spec.md`; this Customer feature still owns review authorship, eligibility, media, and rating aggregates.

## MUST

### Eligibility and identity

- Only an authenticated, active Customer may create a review. The server derives Customer identity from the Sanctum session.
- Resolve the supplied Order Item through a Customer-owned Order; require the authoritative Order status to be `delivered` and the Item's Product reference to remain valid.
- One Order Item permits at most one Product Review, even if its quantity exceeds one. A later delivered purchase of the same Product is a distinct eligible Item.
- The Customer cannot review a cart, wishlist, cancelled/rejected/failed Order, another Customer's Item, or a Product ID supplied without the purchased Item.
- Use the purchased Item's Product and optional variant identity and immutable name snapshot. Product changes do not rewrite historical purchase or review identity.
- If the purchased Product was permanently deleted and the Item's nullable `product_id` is gone, preserve Order history but do not create a new Product Review until a retention policy is approved.
- An archived, hidden, or restricted Product may still be reviewed from a valid delivered Item while it exists; its review is not publicly listed until the Product is `storefrontVisible()` again.
- `canReview` and nullable `reviewId` on each Customer Order Detail Item are server-derived hints; mutation rechecks eligibility under the current Order state.

### Review contract and lifecycle

- A review has a required whole-number rating `1`–`5` and required trimmed plain-text body of `1`–`2000` characters. Reject markup as executable content; render it as text.
- Persist an immutable review UUID, Customer, Order, Order Item, Product, purchased-variant reference/snapshot, rating, body, creation time, and publication state.
- Enforce one review per Order Item with a database unique constraint. A concurrent/retried duplicate must not create another Review, increment aggregates twice, or emit duplicate events; return the existing authorized result or a stable `409`.
- The initial MVP publishes a valid text/rating review on successful commit. Media attachment can complete separately; a failed upload does not roll back the committed review.
- Customer edit/delete, moderation/reporting, helpful votes, reply threads, return/refund effects, and post-pickup cancellation policy are deferred. Do not invent endpoints or silently remove historical reviews.
- Seller response creation and ownership checks belong to Seller Review Management. The Seller may not edit Customer rating, body, media, or verified-purchase state.

### Photos and public visibility

- A Customer may attach up to five optional photos to their own Review; each image follows the shared image policy: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, validated by server-detected type/signature and successful decode.
- Use generated storage keys and feature-owned asset records; never expose raw storage paths, credentials, original filenames as identifiers, or private Order identifiers.
- An image is public only after the Review and Product are public-eligible and required validation or configured scanning has passed. Pending/failed assets remain inaccessible.
- Photo attachment requires review ownership. Replacement/removal remain deferred with review editing; uploaded or orphaned assets need explicit cleanup, and cross-Customer attachment is forbidden.
- Public reads require `storefrontVisible()` for the Product and return only published Reviews. A hidden Product's review history remains private rather than leaking through a standalone URL.
- Public DTOs show rating, safe text, verified-purchase label, safe photo URLs, date, and safe Seller response. Use an anonymized “Verified Customer” label; omit email, phone, address, Customer/Order/Order Item IDs, and private evidence.

### Aggregates and reliability

- Product `average_rating` and `review_count` reflect only real, published Product Reviews; Courier/Q&A feedback and demo seed values are excluded.
- The Reviews table is authoritative. Update or reconcile persisted Product aggregates transactionally with review publication changes; never derive the authoritative average from one paginated frontend page.
- Before exposing real review counts, reset/recompute seeded Product rating/count values from persisted Reviews or clearly isolate fixture-only data.
- Review and media mutations authorize the Item/Review before storage access, validate server-side, and apply scoped rate limits. Private eligibility/mutation responses are `no-store`.
- Optional Seller notifications are derived from Product ownership and sent after commit. Delivery failure must not undo the Review.

### API contract (implemented MVP)

| Method | Path | Authority | Result |
| --- | --- | --- | --- |
| GET | `/api/v1/products/{product}/reviews` | Guest or Customer; visible Product | Bounded newest-first page and authoritative rating summary |
| GET | `/api/v1/customer/orders/{order}` | Owning Customer; existing route | Extend Item DTO with `canReview` and nullable `reviewId` |
| POST | `/api/v1/customer/order-items/{orderItem}/review` | Owning Customer; delivered Item | `{ rating, body }` → created Review DTO |
| POST | `/api/v1/customer/reviews/{review}/images` | Review-owning Customer | Validated image → asset DTO or pending state |

- The listed paths are deployed by the Laravel API. Seller response management is implemented through its separate Seller contract; video support remains deferred.
- Use `401` for unauthenticated, ownership-safe `403/404`, `409` for duplicate/stale state, `422` for field/media validation, and `429` for throttling. Do not reveal whether another Customer's Item/Review exists.
- The public list accepts only bounded page size and allow-listed ordering/filter values; it contains no personalized eligibility flags or shared-cache Customer data.
- Return a stable pagination cursor or page number and total/next-page indicator consistent with the Customer storefront's existing pagination convention.
- Keep the Product review list and rating summary on the same Product visibility and publication filter to avoid count/list disagreement.
- Document request/response/error schemas alongside actual routes during implementation; never treat the table as deployed API.

### Customer experience

- Order Detail shows Rate/Review only on a delivered eligible line, and “Reviewed” for an existing review; the form rechecks server results on submission.
- Product Detail displays the verified-review count, average, paginated review cards, optional photos, and Seller response without claiming seeded ratings are reviews.
- Follow `docs/design.md`: keyboard-operable labelled 1–5 rating input, clear required-text errors, accessible upload progress and retry, and responsive loading/empty/error states.
- Handle `401`, forbidden/not found, `409`, `422`, `429`, timeout, and offline outcomes without showing an uncommitted review as published.

### Acceptance criteria

- [x] Only the owning active Customer can review a delivered Order Item; forged Product/Customer/Order IDs and pre-delivery Orders are rejected.
- [x] One Item creates at most one Review under concurrent submissions; another delivered Item for the same Product remains independently eligible.
- [x] Rating/body bounds, plain-text rendering, image count/type/byte/signature validation, and photo ownership are enforced by Laravel.
- [x] Product visibility controls public review/photo access while historical Reviews remain intact.
- [x] Public DTOs omit Customer and Order PII; Seller responses cannot alter Customer content.
- [x] Aggregate values come from real published Reviews, exclude Courier/Q&A feedback, and do not expose seeded fixture counts as verified reviews.
- [x] Order Detail eligibility and review state agree with authoritative mutation checks; Product Detail pagination and accessible UI states work.
- [x] Upload failures leave the committed Review intact and can be retried without changing the review.

## HOW

- Add new migrations for Product Reviews and review-image metadata; do not edit executed migrations. Index Product/publication/created time and enforce unique `order_item_id`.
- Review foreign keys must preserve the purchasing Customer and Order Item relationship; define restrictive deletion or an immutable snapshot before any account/Product hard-delete path can erase verified-review evidence.
- Review-image records store owner, Review, generated object key, validated MIME/size/dimensions, safe ordering, and processing state. A photo cannot be reused across Reviews by passing its asset ID.
- Use a thin Customer controller, Form Requests, Policy, scoped query, Review Resource, and focused creation/aggregate service. Lock/recheck the owned Item/Order and handle unique-constraint races.
- Treat one logical create as idempotent: the same Customer and Order Item must receive the same committed Review projection on a safe retry; changed payloads after creation receive a conflict rather than an implicit edit.
- Extend the existing Customer Order Detail Resource with Item review capability; expose public review data only after Product visibility checks.
- Store images through the configured filesystem/object storage and shared upload service; image validation follows `docs/references/file-upload-requirements.md`, including optional configured scanning.
- Keep aggregate repair repeatable so rollout can replace fixture ratings and recover from any interrupted publication or media-processing job without altering Customer-authored review history.
- Product Detail should clearly separate the aggregate rating from the currently fetched page; empty state must not fabricate review cards from seed counts.
- Test SQLite and PostgreSQL migrations and API ownership/IDOR, delivery eligibility, duplicate races, aggregates/seed reconciliation, hidden Products, media spoofing and privacy, and upload failure. Test keyboard, pagination, retry, and upload states in the Customer storefront.
- Before implementing Seller response or video support, reconcile the owning Seller spec or approve a separate video policy; neither is made available by this Customer API alone.

### Sources

- Canonical project context: `docs/domains/Buyer.md`, `docs/domains/Seller.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, and Customer Order Status.
- Shared upload policy: `docs/references/file-upload-requirements.md`.
- Implementation references: `src/api/app/Enums/OrderStatus.php`, `src/api/app/Models/OrderItem.php`, `src/api/app/Models/Product.php`, and Customer `OrderResource.php`.
- Security references: [Laravel validation](https://laravel.com/docs/12.x/validation), [Laravel authorization](https://laravel.com/docs/12.x/authorization), and [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
