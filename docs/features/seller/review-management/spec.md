---
feature: review-management
title: Seller Review Management
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Review Management
## WHAT
- **Purpose:** Let Sellers monitor verified Buyer reviews on their Products and publish accountable public Seller responses.
- **Canonical role:** `SELLER`.
- `Seller.md` defines Review Management as reading and replying to customer reviews/ratings on Seller Products, with a nested `seller_response` linked to the parent Review. fileciteturn93file0
- Buyer source defines Product Reviews as post-delivery, verified-purchase feedback with ratings, text, and optional media. fileciteturn93file11
- **Seller Review Management owns:**
  - Seller-scoped review inbox/list
  - filtering by Product/rating/date/reply/moderation state
  - safe review/detail display
  - one active public Seller response
  - allowed response edits with history
  - report/moderation entry points
  - Buyer notification when response becomes visible
- **Buyer Product Reviews owns:**
  - review creation
  - verified-purchase eligibility
  - Buyer rating/text/media
  - Buyer edit/delete rules if any
  - aggregate rating input
- **Recommended flow:**
```text
Buyer Review is published/visible
→ Seller Review inbox
→ Seller opens review
→ Laravel verifies Seller owns Product
→ Seller writes response
→ validate content/rate limit/one-active-response rule
→ store response + moderation state
→ publish when allowed
→ Buyer notified
```
- **Edit/report flow:**
```text
Seller edits allowed reply
→ preserve prior version
→ moderation may re-run
→ public display updates only when allowed

Seller reports review
→ moderation/report record
→ original Review not rewritten by Seller
```
- **Recommended routes:**
```text
/seller/reviews
/seller/reviews/{review}
```
- **Architecture:**
  - Next.js/React owns review list/detail/filter/reply/edit/report UI.
  - Laravel owns Seller scoping, Product ownership, response validation, one-active-response rule, moderation state/history, notification events, and safe DTOs.
  - `Reviews` remains the source of truth for Buyer content/rating.
- **Non-goals:**
  - Seller changing Buyer rating
  - Seller editing/deleting Buyer review text/media
  - Seller changing aggregate Product rating
  - exposing Buyer private Order/contact/payment data
  - automatically removing critical/negative reviews
  - multiple simultaneous public Seller replies per Review
  - AI-generated responses unless separately designed
## MUST
### Authentication and Seller scope
- Requires authenticated `SELLER`.
- Every review query must prove:
```text
review
→ product
→ seller_id == authenticated Seller
```
- Never trust client-submitted `seller_id` or Product ownership.
- Another Seller cannot view or respond to the Review.
- Standard errors:
  - `401` unauthenticated
  - `403` forbidden
  - `404` Seller-scoped Review missing
  - `422` invalid response/report input
  - `409` stale/reply-state conflict
  - `429` throttled response/report actions
### Seller-scoped review list
- Seller can list Reviews only for Seller-owned Products.
- List must be paginated.
- Dedicated flow supports filters for:
  - Product
  - rating
  - date
  - reply state
  - moderation state
- Allow-list all filters/sorts.
- Recommended default sort: newest Review first.
- Exact page size and sort options are Open.
### Review visibility
- Seller Review Management primarily operates on published/visible Reviews.
- If moderation hides/removes a Review:
  - public storefront must follow moderation state
  - Seller access to historical/moderation context depends on policy
- Do not let Seller force a hidden Review back to public.
### Verified-purchase context
- Buyer source requires Reviews to come from verified purchases. fileciteturn93file11
- Seller may see a safe verification indicator such as:
```text
verified_purchase = true
```
- Do not expose unrelated Order data just to prove verification.
- Exact visible verification/order context is Open.
### Safe Buyer identity
- Show only public Review identity such as display name/alias, avatar if public, and verified-purchase badge.
- Never expose email, phone, shipping address, payment data, verification documents, or unrelated Orders.
- Exact public identity policy is Open.
### Review content
- Seller can read rating, text, authorized published media, Product/variant reference, timestamp, and safe moderation state.
- Seller cannot modify Buyer-owned Review fields.
### Rating immutability from Seller
- Seller response actions must not change:
  - Buyer rating
  - Review rating contribution
  - Product aggregate rating
- Dedicated Seller flow explicitly says aggregate ratings are unaffected by Seller responses.
- Product rating aggregate must derive only from eligible Review ratings according to Buyer Review rules.
### Public Seller response
- Seller can write one public, visibly Seller/shop-attributed response linked to exactly one Review.
- Store Review/Seller IDs, body, moderation state, timestamps, and optional `published_at`.
### One-active-response rule
- Dedicated Seller flow requires one active response policy.
- Recommended invariant:
```text
max 1 active Seller response per Review
```
- Seller cannot create several independent public replies to the same Review.
- Editing updates/version-controls the existing logical response.
- Database uniqueness or equivalent transactional guard should enforce this.
### Response text validation
- Laravel validates:
  - required body
  - non-whitespace content
  - maximum length
  - safe text/allowed markup policy
- Treat Seller response as untrusted user-generated content.
- Do not render arbitrary executable HTML.
- Exact max length is Open.
- Laravel Form Requests are appropriate for validation/authorization boundaries. citeturn961060search0
### Response ownership
- Seller may respond only when:
  - Review exists
  - Review's Product belongs to Seller
  - Review state allows response
- Product ID supplied by client is not proof.
- Resolve ownership through Eloquent relationships/server query.
- Laravel 13 relationship-query APIs support relation-based filtering such as `whereHas`. citeturn187419search5
### Moderation state
- Recommended states: `PENDING`, `PUBLISHED`, `REJECTED`, `REMOVED`; exact workflow is Open.
- Valid responses may auto-publish or await moderation according to policy.
- Seller never sets moderation status directly.
### Public display
- Buyer/public Product Review view shows Seller response only when moderation/publication state allows.
- Display should clearly identify:
  - Seller/shop author
  - response body
  - published/edited timestamp where policy wants it
- Hidden/rejected response must not leak through public APIs/cache.
### Response edit
- Dedicated flow allows editing when policy permits.
- Edit must:
  - re-authorize Seller/Product ownership
  - validate new content
  - preserve previous response version/history
  - update moderation state as policy requires
- An edit may re-enter moderation.
- Seller cannot silently overwrite history.
### Version history
- Preserve response ID/version, body snapshot, moderation state, changed-at/by.
- Public UI normally shows only current allowed version; history is not automatically public.
- Retention is Open.
### Remove / delete response
- Hard deletion is not source-required.
- Recommended:
  - moderation/removal state
  - retain history
- Seller self-removal behavior is Open.
- Admin/moderation removal must preserve audit trail.
- Removing Seller response still must not alter Buyer Review/rating.
### Reporting a Review
- Seller may report an owned-Product Review using an allow-listed reason and optional bounded explanation.
- Report creates separate moderation metadata; it does not automatically hide/delete the Review or change rating contribution.
### Report authorization
- Seller can report only Reviews attached to Seller-owned Products.
- Prevent duplicate/spam reports using rate limits/dedupe policy.
- Exact report reasons and duplicate-report semantics are Open.
- Laravel request throttling supports named/routing rate limit middleware. citeturn855546search1
### Moderation / Admin boundary
- Admin moderation/report workflow owns binding decisions; Seller only submits reports and sees safe status/results where allowed.
- Seller cannot self-remove criticism. fileciteturn93file2
### Review media
- Buyer Reviews may contain image/video media. fileciteturn93file11
- Seller can view only media attached to an authorized Review and allowed by moderation state.
- Media authorization must follow Review/Product ownership.
- Do not expose raw storage paths or private upload metadata.
- Shared file rules require authorized/signed access for protected media. fileciteturn93file18
### New-review notification
- Seller source does not require one; keep Seller `ReviewPublished` notification optional/Open.
- Dashboard may show Review summary/unanswered counts.
### Buyer notification on Seller response
- Dedicated flow explicitly requires notifying Buyer when Seller response becomes visible.
- Trigger only when response reaches public/visible state.
- Recommended event:
```text
SellerReviewResponsePublished
```
- Buyer recipient comes from authoritative Review ownership, not Seller input.
- Notification must not expose unrelated Seller/Buyer data.
### After-commit notification
- Buyer notification runs only after response/publication transaction commits.
- Shared AISLEY conventions require notifications after commit. fileciteturn93file18
- Notification failure must not roll back a valid published Seller response.
- Laravel Notifications support database/queued channels; exact channel is Open. citeturn961060search1
### Notification dedupe
- One logical Buyer notification per newly published response version/state transition.
- Retry must not repeatedly notify Buyer for the same publication event.
- If edit re-enters moderation and later republishes, whether Buyer gets another notification is Open.
- Persist a stable event/version reference when needed.
### Aggregate rating
- May display average rating, Review count, and distribution from eligible Buyer Reviews only.
- Seller responses never affect aggregate math; shop-level aggregation is Open.
### Unanswered reviews
- Recommended Seller operational filter:
```text
reply_state = UNANSWERED
```
- Dedicated flow explicitly supports reply-state filtering.
- `UNANSWERED` means no active published/pending response according to selected policy.
- Exact handling of rejected/removed responses is Open.
### Moderation filters
- Dedicated flow supports moderation-state filtering.
- Seller may filter by safe states relevant to action, e.g.:
  - visible
  - response pending
  - reported
  - removed
- Exact filter labels follow final moderation model.
- Never expose internal moderator-only notes.
### Concurrency
- Two Seller browser tabs may submit/edit the same response.
- Use:
  - unique one-active-response constraint
  - transaction/atomic create
  - optional version/`updated_at` stale detection
- Return `409` on stale edit when applicable.
- Do not create duplicate active responses.
### Idempotency
- Initial response creation should tolerate duplicate browser submission.
- Recommended request idempotency or unique review-response constraint.
- Report submission may use dedupe by Seller + Review + active report/reason policy.
- Retried notification jobs must not duplicate publication events.
### Rate limiting
- Rate-limit:
  - response create/edit
  - report actions
- Exact thresholds are Open.
- Return `429` when exceeded.
- Rate limiting supplements authorization/moderation; it does not replace them.
### Public cache/search propagation
- When response becomes public/removed/edited:
  - invalidate/update Product Review presentation cache/read models after commit
- Do not let cached public Product pages show rejected/removed response indefinitely.
- Database moderation state remains authoritative.
### Pagination/performance
- Paginate Review list/history and query through Seller-owned Product relationships.
- Index actual ownership/date/rating/moderation query paths and avoid N+1 Product/response loading.
### Frontend states
- Review list: loading, empty, loaded, filtered-empty, error.
- Response: none, editing, submitting, pending, published, rejected/removed, stale/error.
- Report: idle, submitting, submitted, duplicate/throttled, error.
### Accessibility
- Provide textual rating/state values, labeled reply/report errors, keyboard-accessible media, and clear Seller attribution.
### Acceptance criteria
- [ ] Seller sees only Reviews for Seller-owned Products.
- [ ] Seller cannot alter Buyer rating/review text/media.
- [ ] Seller can publish at most one active response per Review.
- [ ] Response is visibly Seller-authored and linked to exactly one Review.
- [ ] Response validation and rate limits are server-enforced.
- [ ] Allowed edits retain version/moderation history.
- [ ] Reported/removed content retains an audit trail.
- [ ] Seller reports do not automatically remove Reviews or change ratings.
- [ ] Aggregate ratings ignore Seller response content/state.
- [ ] Buyer is notified only when Seller response becomes visible.
- [ ] Notification/public-cache updates happen after commit.
- [ ] Safe Buyer/order context reveals no unnecessary private information.
- [ ] Concurrency/retries cannot create duplicate active Seller responses.
## HOW
### Project findings
- `Seller.md` defines Review Management as reading and publicly replying to Reviews on Seller Products through a nested Seller response. fileciteturn93file0
- Buyer source defines Product Reviews as verified post-delivery Buyer feedback with rating/text and optional media. fileciteturn93file11
- Dedicated Seller Review flow adds Product/rating/date/reply/moderation filters, one-active-response policy, response moderation, Buyer notification on visible response, edit/version history, and Seller reporting.
- Admin source owns binding moderation/dispute decisions rather than Seller self-removal of criticism. fileciteturn93file2
- AISLEY architecture requires Seller scoping, pagination, Laravel authorization/validation, after-commit notifications, private media authorization, and audit/event history. fileciteturn93file18
- Sources do not define response max length, exact moderation states, report reasons, response self-delete policy, Buyer notification channel, edit notification behavior, or retention.
### Recommended data model
```text
reviews
- existing Buyer/Product/Order Item review data + rating/moderation

seller_review_responses
- review_id, seller_id, body, moderation_status, published_at, timestamps

seller_review_response_versions
- response_id, version, body, moderation_status, changed_by, created_at

review_reports
- review_id, reporter_seller_id, reason, details, moderation_status, created_at
```
- Reuse generic moderation/version/report tables where available and enforce one logical active response per Review.
### Recommended API
```http
GET   /api/seller/reviews
GET   /api/seller/reviews/{review}
POST  /api/seller/reviews/{review}/response
PATCH /api/seller/reviews/{review}/response
POST  /api/seller/reviews/{review}/report
```
- Optional:
```http
GET /api/seller/reviews/{review}/response/history
```
only if Seller UI needs history.
- Use Form Requests, Seller-scoped Policies/queries, and API Resources.
### Recommended domain actions
```text
GetSellerReviews
CreateSellerReviewResponse
EditSellerReviewResponse
ReportSellerProductReview
PublishSellerReviewResponse
RemoveSellerReviewResponseByModeration
```
- Publication/removal actions may be Admin/moderation-owned depending final moderation design.
### Seller scope query
Recommended relation-based query:
```text
Review
→ where Product belongs to authenticated Seller
→ eager load safe Product + current Seller response
→ apply allow-listed filters
→ paginate
```
- Laravel's Eloquent relationship query APIs support relationship-constrained filtering. citeturn187419search5
- Do not fetch all Reviews then filter Seller ownership in React.
### Response create transaction
```text
Seller submits response
→ authorize Review/Product ownership
→ validate text
→ check rate limit/idempotency
→ transaction
→ ensure no active response exists
→ create response/version
→ choose moderation state
→ commit
→ if visible: response-published event
→ Buyer notification/cache refresh after commit
```
### Response edit transaction
```text
Seller edits
→ authorize
→ check current version/state
→ validate
→ transaction
→ append old/current version history
→ update body
→ moderation state may return to PENDING
→ commit
→ refresh public display only when allowed
```
- Use optimistic version/`updated_at` checks if concurrent edits matter.
### Moderation model
- Keep Buyer Review moderation separate from Seller response moderation.
- Seller response should not inherit public status merely because parent Review is public.
- Public Product API returns response only when both parent Review and response are display-eligible.
- Internal Seller API may expose safe moderation status for their own response.
### Buyer notification
```text
Seller response becomes PUBLISHED
→ commit
→ SellerReviewResponsePublished
→ queue Buyer notification
```
- Laravel notification infrastructure can store/send notifications through configured channels. citeturn961060search1
- Notification failure does not undo publication.
### Next.js / React
```text
/seller/reviews
├── ReviewFilters
├── ReviewList
└── ReviewRow

/seller/reviews/[review]
├── BuyerReviewContent
├── ReviewMedia
├── SellerResponseForm
└── ReportReviewAction
```
- Use shared Laravel API client; Laravel decides ownership/moderation eligibility.
### Tests
- **Laravel:** Seller isolation; Product ownership; filter/pagination; response validation; one-active-response concurrency; create/edit/version history; moderation visibility; report authorization/dedupe; Buyer notification after publish; aggregate rating unchanged.
- **Security:** no Buyer private data leakage; media authorization; Seller cannot mutate Buyer Review/rating.
- **Frontend:** list/filter/detail; reply states; edit/stale conflict; report/throttle states; accessibility.
### Research-backed recommendations
- Use Form Requests/Policies for response validation and authorization; Laravel 13 supports request validation and policy-style authorization boundaries. citeturn961060search0turn187419search0
- Use relationship-scoped Eloquent queries to enforce Seller-owned Product Reviews server-side. citeturn187419search5
- Apply request throttling to reply/report actions as abuse protection. citeturn855546search1
- Keep Buyer notification after the response-publication transaction commits.
### Risks
- **Manipulation/tenant leakage:** Seller mutations must never change Buyer ratings or cross Product ownership.
- **Abuse/moderation bypass:** weak limits or cache rules can spam Buyers/show unapproved replies.
- **History/privacy loss:** destructive edits or broad detail DTOs can remove accountability or expose Buyer data.
### Open questions
- Response length/markup and moderation auto-publish/edit rules.
- Seller self-remove behavior; report reasons/dedupe/Admin workflow.
- Buyer notification channel/republication behavior.
- Public Buyer identity; response/version/report retention.
- Rating scale/aggregate source and Dashboard unanswered count.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Buyer source: `Buyer.md`
- Admin source: `Admin.md`
- Seller flow: `feature-system-flows/seller/review-management.md`
- Laravel 13 Validation: https://laravel.com/framework/docs/validation
- Laravel 13 Eloquent relationships/query API: https://api.laravel.com/docs/13.x/Illuminate/Database/Eloquent/Builder.html
- Laravel 13 request throttling API: https://api.laravel.com/docs/13.x/Illuminate/Routing/Middleware/ThrottleRequestsWithRedis.html
- Laravel 13 Notifications API: https://api.laravel.com/docs/13.x/Illuminate/Notifications.html
