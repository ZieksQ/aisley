---
feature: product-review-ratings
title: Customer / Buyer Product Reviews & Ratings
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Product Reviews & Ratings
## WHAT
- **Purpose:** Let Buyers leave verified post-delivery feedback about products they actually purchased and received.
- **Canonical role:** `BUYER`.
- **Source-defined capabilities:**
  - rate a product
  - write qualitative feedback
  - upload photos/videos of the received item
  - restrict review creation to verified purchases
  - prompt Buyer to review after delivery
- **Seller integration:** Seller Review Management reads reviews on the Seller's products and allows a public Seller response.
- **Source intent:** Build product social proof and platform trust using feedback tied to completed purchases.
- **Architecture:**
  - Next.js/React owns review forms, star/rating input, media selection/preview, public review rendering, pagination, and UI states.
  - Laravel owns authentication, verified-purchase eligibility, rating/text validation, media authorization, persistence, Seller-response authorization, aggregation, and safe Resources.
  - Configured object/file storage owns uploaded review media.
- **Primary flow:**
```text
Order reaches DELIVERED
→ Buyer Order Status exposes Rate / Review
→ Buyer selects purchased product/order item
→ Laravel verifies delivered Buyer-owned purchase
→ validate rating/text/media
→ create Review
→ commit
→ media processing / Seller notification if configured
→ public Product review becomes available
```
- **Recommended public product-review surface:**
```text
Product Detail
├── rating summary
└── paginated verified reviews
    ├── rating
    ├── review text
    ├── media
    └── Seller response when present
```
- **Important boundary:** Product reviews rate the purchased Product, not the Courier.
- Courier feedback/rating may also use a `Reviews`-related model in source documents, but must remain explicitly distinguished by target/type/schema.
- **Feature boundaries:**
  - Order Status determines whether the purchase reached `DELIVERED`.
  - Seller Review Management owns Seller-facing review monitoring/replies.
  - Product Q&A handles product questions, not post-purchase evaluation.
  - Complaints/Disputes handle formal disputes; reviews are not dispute tickets.
- **Non-goals:**
  - unverified reviews
  - anonymous guest review creation
  - courier ratings inside a product-review record
  - Seller editing Buyer review content
  - helpful-vote systems
  - comments/reply threads beyond the source-defined Seller response
  - AI-generated reviews
  - inventing review moderation/edit/delete policy not defined by source
## MUST
### Authentication
- Review creation requires authenticated `BUYER`.
- Laravel derives Buyer identity from the authenticated session.
- Never trust client-submitted:
  - `buyer_id`
  - verified-purchase flag
  - order owner
  - Seller owner
  - created timestamp
- Public review reading may be guest-accessible when Product Detail is public.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `404` scoped purchase/Product/review not found
  - `422` validation failure
  - `409` duplicate/stale review action where applicable
### Verified-purchase eligibility
- Source explicitly requires reviews to be restricted to verified purchases. fileciteturn45file0
- Laravel must verify that:
  - Order belongs to the authenticated Buyer
  - reviewed Product/variant was actually purchased in that Order
  - Order reached `DELIVERED`
  - the purchase satisfies the selected review-uniqueness rule
- Client-provided Product ID alone is insufficient proof.
- Recommended verification relationship:
```text
authenticated Buyer
→ Buyer-owned Order
→ delivered
→ Order Item
→ Product / purchased variant
→ review eligibility
```
- Do not permit a Buyer who merely viewed, wishlisted, carted, or cancelled a Product to review it.
### Delivery requirement
- Reviews are post-delivery; canonical eligibility requires `DELIVERED`. fileciteturn45file0
- Reject not-yet-delivered, cancelled, rejected, or failed Orders without eventual delivery.
- Return/refund eligibility remains Open; payment success alone is not delivery proof.
### Review target
- Every product Review must reference the exact purchased Product.
- Recommended reference also includes:
  - Order ID
  - Order Item ID
  - purchased variant/SKU reference where useful
- Historical review must remain tied to the purchased product identity even if the current Product later changes.
- Product review must not accidentally target a Courier or Seller account as its rating subject.
### Product vs Courier review separation
- Courier source also references `Reviews`; Product and Courier feedback must therefore be structurally unambiguous. fileciteturn46file12turn46file13
- Use `review_type = PRODUCT | COURIER` or an equivalent normalized target relationship.
- Product aggregates exclude Courier reviews and vice versa.
### Review uniqueness
- Source does not define duplicate-purchase review semantics.
- Recommended MVP: one Review per eligible Order Item; one-per-Buyer+Product is an alternative.
- Final rule is Open but must be enforced server-side with a unique/transaction-safe constraint.
### Rating
- Source gives `1–5 stars` as an example quantitative scale, not an explicit immutable requirement. fileciteturn45file0
- Recommended MVP:
```text
1, 2, 3, 4, 5
```
- Final rating scale is Open unless another requirement fixes it.
- Laravel must validate the configured minimum/maximum and allowed increments.
- React star selection is presentation only.
- Rating is required unless product requirements explicitly allow text-only reviews.
### Review text
- Source requires qualitative text feedback.
- Laravel must:
  - trim/normalize input
  - enforce server-side maximum length
  - treat content as untrusted user-generated text
- Exact length is Open.
- Do not render review text as raw executable HTML.
- If rich text is later allowed, use explicit sanitization rather than trusting submitted markup.
### Review creation
- Conceptual endpoint:
```http
POST /api/buyer/order-items/{orderItem}/review
```
or repository-equivalent.
- Recommended Laravel sequence:
  1. authenticate Buyer
  2. resolve Buyer-owned Order Item
  3. verify parent Order is `DELIVERED`
  4. verify Product target
  5. enforce uniqueness
  6. validate rating/text/media references
  7. create Review
  8. attach accepted media assets
  9. commit
  10. dispatch optional Seller/processing events after commit
- Do not accept a generic public:
```http
POST /api/products/{product}/reviews
```
without separately proving a delivered purchase.
### Concurrency / duplicate creation
- Two tabs/retries may submit the same review simultaneously.
- Use a unique database constraint and transaction/idempotency protection.
- Only one valid logical review should win under the chosen uniqueness rule.
- Duplicate attempts return an existing result or stable `409` according to project conventions.
- Do not send duplicate Seller notifications for a duplicate review.
### Review media
- Source explicitly supports photo and video uploads. fileciteturn45file0
- Review media is optional per individual Review unless the product later requires it.
- Supported media categories:
  - approved image formats
  - approved video formats
- Exact extensions, MIME types, file-size limits, duration limits, dimensions, and media-count limits are Open.
- Do not use unrestricted `image/*` / `video/*` acceptance without an allow-list policy.
### Upload validation
- Uploads must follow shared AISLEY file rules:
  - authenticated/authorized upload
  - type validation
  - size validation
  - malware scanning
  - configured object/file storage
  - domain record stores asset ID/reference, not application-server path
- Laravel supports file validation by MIME/content and size through file validation rules. citeturn796777search1
- Do not trust browser-provided `Content-Type` or original extension alone.
- OWASP recommends allow-listed extensions/types, content validation, generated filenames, size limits, malware scanning, and storage outside the webroot. citeturn849703search0
### Media upload ownership
- Upload intent must be associated with the authenticated Buyer/review flow.
- Buyer must not attach another user's arbitrary uploaded asset ID to their Review.
- Laravel validates asset ownership/session and accepted media state before attaching.
- Temporary/orphaned uploads need cleanup policy.
- Exact direct-upload vs Laravel-proxied upload flow is Open.
### Media storage
- Buyer source gives AWS S3 as an example, not a mandatory provider. fileciteturn45file0
- Use the repository's configured object/file storage.
- Do not hard-code AWS S3 when another compatible storage provider is configured.
- Generate storage names/keys server-side.
- Never expose local server filesystem paths.
- Public product-review media may use safe public/CDN URLs after validation, or authorized URLs according to storage policy.
### Image/video processing
- Large image/video processing should be asynchronous when needed.
- Possible jobs:
  - thumbnail generation
  - image normalization
  - metadata stripping
  - video poster generation/transcoding
  - malware-scan completion
- Exact processing pipeline is Open.
- A Review should not expose unvalidated media publicly before required security processing completes.
- Processing failure must be represented explicitly; it must not corrupt the Review record.
### Media metadata/privacy
- Avoid exposing embedded location/device metadata, original filenames as public IDs, storage credentials, or private paths.
- Return only safe asset URLs/IDs and display metadata.
### Public reviews
- Reviews support product social proof and should appear only with a buyer-visible Product. fileciteturn45file0
- Hidden Products must not be exposed through standalone review endpoints; historical records may remain internal.
- Moderation/publication states are Open.
### Verified-purchase label
- Public Product reviews should indicate that the review came from a verified purchase when the UI uses such a badge/label.
- Verification must be server-derived from the Order relationship.
- Never accept:
```text
verified = true
```
from the Buyer client.
- Exact wording/design is a UI decision.
### Buyer public identity
- Source does not define whether the Buyer's identity is public.
- Never expose:
  - email
  - phone
  - address
  - account/security metadata
- Recommended public identity is a safe display name or anonymized Buyer label.
- Exact presentation is Open.
### Seller response integration
- Seller source explicitly requires Sellers to read and publicly reply to reviews on their Products. fileciteturn45file1
- Seller response belongs to the same Review domain.
- Only the Seller owning the reviewed Product may respond.
- Buyer cannot create/modify the official Seller response.
- Another Seller cannot respond.
- Recommended response data:
  - response text
  - responding Seller/account ID
  - response timestamp
- Source describes a nested `seller_response` linked to the Review; implementation may use columns, JSON, or a normalized relation according to repository design.
- Seller response editing/deletion behavior is Open.
### Seller response safety
- Validate and length-limit response text.
- Render as untrusted text.
- Seller cannot alter:
  - Buyer rating
  - Buyer review body
  - verified-purchase state
  - review media
- Seller response should be visibly identified as the Seller/shop response.
### Public review listing
- Product Detail should return reviews through a paginated endpoint/resource.
- Recommended default ordering:
  - newest first
- Exact sorting options are Open.
- Do not add "Most Helpful" without a helpful-vote system.
- Allow-listed optional filters may include rating when later needed.
- Pagination follows project conventions.
### Rating aggregate
- A product-facing rating summary is recommended to fulfill the social-proof intent.
- Aggregate only eligible Product reviews.
- Recommended fields:
```text
average_rating
review_count
rating_distribution optional
```
- Do not include Courier reviews or unrelated feedback.
- Exact treatment of deleted/hidden/moderated reviews is Open.
- Compute/cache aggregates server-side; React must not derive authoritative averages from one paginated page.
### Aggregate consistency
- Review mutations must keep Product aggregates consistent; database Reviews remain authoritative.
- Cached/materialized summaries update/invalidate after commit and need reconciliation.
### Review prompt
- Order Status source expects a post-delivery Rate/Feedback action. fileciteturn45file0
- When an Order/Order Item is review-eligible, Laravel should expose a safe action/capability flag:
```text
can_review
review_id nullable
```
- Order Status renders the prompt/action.
- Review eligibility is recomputed server-side when submission occurs.
- Do not show `Rate` as proof that submission will succeed if Order state changed.
### Returns/refunds
- Review eligibility/visibility after return, refund, or dispute is not source-defined.
- Do not automatically delete a verified Review after a later return unless policy requires it.
### Review editing/deletion
- Buyer source does not define edit/delete; MVP need not provide it.
- If added, restrict to the review-owning Buyer, update aggregates/media/history consistently, and preserve dispute/moderation evidence as policy requires.
### Moderation / abuse
- Moderation, report buttons, profanity filtering, and Admin takedown are not source-required.
- Complaints/Disputes and compliance remain separate; safe rendering/upload validation/rate limiting still apply.
### Product Q&A distinction
- Product Reviews:
  - verified delivered purchase
  - Buyer evaluation
  - rating + feedback + optional media
- Product Q&A:
  - no purchase required
  - question/official Seller answer
  - product clarification
- Do not store Product Q&A as Reviews.
- Q&A must not affect rating aggregates.
### Courier feedback distinction
- Product review evaluates the Product received.
- Courier Digital Tipping/Feedback and Performance Metrics may use separate Buyer-to-Courier feedback. fileciteturn46file12turn46file13
- Do not make a product star rating automatically rate the Courier.
- If one checkout/post-delivery UI collects both, submit them as separate domain records/targets.
### Notifications
- Buyer source does not require a new-review alert to Seller; alerting remains Open.
- If added, derive recipient from Product ownership, dispatch after commit, and never roll back Review creation on notification failure.
### Frontend states
- Public list: loading, empty, loaded, pagination, error.
- Eligibility: eligible, already reviewed, not delivered/not eligible.
- Form/media: idle, validating, uploading/processing, submitting, success, validation/upload error, duplicate conflict.
- Seller response: absent/present; Review success waits for Laravel persistence.
### Accessibility
- Rating input must be labeled, keyboard-operable, and expose numeric text equivalents.
- Review/media controls, errors, upload progress, media, and Seller response need accessible textual labels/states.
### Acceptance criteria
- [ ] Guest cannot create Product reviews.
- [ ] Buyer cannot review another Buyer's purchase.
- [ ] Buyer cannot review an unpurchased Product.
- [ ] Buyer cannot review before the Order is `DELIVERED`.
- [ ] Review target resolves through Buyer-owned Order/Order Item.
- [ ] Product and Courier review targets cannot be confused.
- [ ] Duplicate logical reviews are prevented according to configured uniqueness rule.
- [ ] Rating is server-validated against the configured scale.
- [ ] Review text is safely rendered and length-limited.
- [ ] Buyer can attach approved photo/video media.
- [ ] Media type/size is validated and malware-scanned.
- [ ] Review stores asset references, not local filesystem paths.
- [ ] Buyer cannot attach another user's unauthorized media.
- [ ] Public review DTO omits Buyer private data.
- [ ] Verified-purchase state is server-derived.
- [ ] Public review list is paginated.
- [ ] Product rating aggregate excludes Courier/unrelated reviews.
- [ ] Only owning Seller can publish the Seller response.
- [ ] Seller cannot alter Buyer rating/review/media.
- [ ] Order Status can expose Rate/Review after delivery.
- [ ] Product Q&A remains separate from Product Reviews.
- [ ] UI handles eligibility, upload, duplicate, validation, and API-error states.
## HOW
### Project findings
- `Buyer.md` explicitly defines Product Reviews & Ratings as post-delivery product feedback with rating, text, and uploaded photos/videos. fileciteturn45file0
- It requires integration with `Reviews` and `Orders` to enforce verified-purchase-only review creation and gives AWS S3 as an example media store. fileciteturn45file0
- Seller Review Management explicitly requires Sellers to read and publicly reply to reviews associated with their Products. fileciteturn45file1
- Courier sources also refer to Reviews for rider feedback/performance, so review targets must be structurally distinguishable. fileciteturn46file12turn46file13
- Shared AISLEY rules require Laravel ownership/validation, pagination, idempotency, validated/scanned object-storage uploads, and safe Resources. fileciteturn45file2
- Sources do not define uniqueness, exact rating scale, edit/delete, moderation, media limits, storage provider, return/refund behavior, or Seller-response editing.
### Recommended data model
- Conceptual Product Review:
```text
reviews
- id
- buyer_id
- order_id
- order_item_id
- product_id
- review_type / target discriminator
- rating
- body
- created_at
- updated_at
```
- Seller response may be:
```text
seller_response
seller_responded_by
seller_responded_at
```
or a normalized `review_responses` relation.
- Media:
```text
review_media
- id
- review_id
- asset_id
- media_type
- sort_order
```
- Reuse actual Order Item/Product naming from repository.
- Enforce the chosen uniqueness rule at database level.
### Laravel API
Conceptual endpoints:
```http
GET  /api/products/{product}/reviews
GET  /api/products/{product}/rating-summary
POST /api/buyer/order-items/{orderItem}/review
GET  /api/buyer/order-items/{orderItem}/review-eligibility
```
Seller response is a shared-domain endpoint owned by Seller Review Management:
```http
POST /api/seller/reviews/{review}/response
```
- Use:
  - `StoreProductReviewRequest`
  - `RespondToReviewRequest`
  - `ReviewPolicy`
  - `ProductReviewResource`
  - `ProductRatingSummaryResource`
### Domain actions
Recommended:
```text
CreateVerifiedProductReview
RespondToProductReview
GetProductRatingSummary
```
- `CreateVerifiedProductReview` resolves eligibility from the authenticated Buyer and Order Item.
- It must not accept a trusted `verified_purchase` flag.
- Keep Seller-response authorization in the shared Review domain so Buyer/Seller views cannot diverge.
### Media upload flow
Recommended conceptual flow:
```text
Buyer selects media
→ Laravel-authorized upload intent/request
→ validate allowed type/size
→ generate storage key
→ object/file storage
→ malware/security processing
→ asset marked usable
→ Review references asset IDs
```
- Upload architecture may use direct-to-object-storage signed upload or Laravel-proxied upload depending on repository/storage.
- Laravel validation supports MIME/content and size validation for uploaded files. citeturn796777search1
- OWASP recommends defense-in-depth for uploads: allowed types, file-signature/content checks, generated filenames, limits, malware scanning, and storage outside webroot. citeturn849703search0
### Next.js / React
Recommended components:
```text
ProductReviewsSection
├── ProductRatingSummary
├── ProductReviewList
├── ProductReviewCard
└── ReviewPagination

OrderReviewAction
└── ProductReviewForm
    ├── RatingInput
    ├── ReviewText
    └── ReviewMediaUploader
```
- Public review list can be server-rendered/fetched.
- Review form/media uploader requires interactive Client Component behavior.
- Use shared Laravel API client.
- Do not implement verified-purchase logic in Next.js.
### Seller integration
- Seller Review Management queries Reviews only for Products owned by the authenticated Seller. fileciteturn45file1
- Seller response endpoint verifies `review.product.seller_id` against authenticated Seller.
- Public Buyer Product Detail renders the response returned by the shared Review Resource.
- Do not create a second copy of the Review for Seller response.
### Aggregation
- Rating summary should aggregate Product review ratings in Laravel/database.
- Query only:
```text
review_type = PRODUCT
product_id = target product
eligible/public review state
```
according to final schema.
- Cache/materialize only if query volume requires it.
- Never calculate the authoritative Product average from the currently loaded frontend page.
### Tests
- **Laravel:** auth/ownership; delivered eligibility; Product/Order Item linkage; duplicate race; validation; upload/asset ownership; Product-vs-Courier separation; pagination; aggregates; Seller response authorization; safe Resource.
- **Frontend:** Rate action; accessible rating/text/media; upload/error/duplicate states; public list; Seller response; pagination.
### Research-backed recommendations
- Use Laravel Policies for resource ownership/authorization and dedicated validation for review/media mutations. Laravel's Sanctum guidance also emphasizes Policies for resource authorization even with authenticated first-party requests. citeturn796777search2
- Validate uploaded files by content/MIME and size rather than trusting client metadata. citeturn796777search1
- Follow OWASP defense-in-depth for public user uploads, including allow-lists, generated filenames, malware scanning, and isolated storage. citeturn849703search0
- Keep AWS S3 as a source example rather than a forced dependency; use configured storage.
### Risks
- **Trust/integrity:** weak purchase linkage, target separation, or duplicate protection can manipulate ratings.
- **Content/media:** unsafe text or uploads can introduce XSS, malware, oversized files, or privacy leaks.
- **Aggregate/history drift:** cached summaries or weak purchase references can misrepresent historical reviews.
- **Scope growth:** editing, moderation, voting, comments, and advanced media pipelines can expand MVP rapidly.
### Open questions
- Final rating scale/half-stars and uniqueness rule.
- Return/refund eligibility and Buyer edit/delete policy.
- Seller-response editing and Buyer public identity.
- Text/media limits, storage provider, direct-upload and media-processing strategy.
- Moderation/reporting and Seller new-review notifications.
- Public sort/filter options and rating-summary caching.
- Review retention when Product/Seller becomes hidden/deleted.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Seller feature model: `Seller.md`
- Courier feature model: `Courier.md`
- Laravel Validation / file validation: https://laravel.com/docs/12.x/validation
- Laravel Authorization: https://laravel.com/docs/12.x/authorization
- Laravel Filesystem: https://laravel.com/docs/12.x/filesystem
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
