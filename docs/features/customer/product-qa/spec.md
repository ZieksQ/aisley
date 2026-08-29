---
feature: product-qa
title: Customer / Buyer Product Q&A
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Product Q&A
## WHAT
- **Purpose:** Let Buyers ask product-specific questions on a product listing and let the owning Seller publish an official answer that is visible to future shoppers.
- **Canonical role:** `BUYER`.
- **Source-defined behavior:**
  - Buyer submits a specific question from a product listing.
  - Question is tied directly to the Product/SKU.
  - Seller is alerted that a new question exists.
  - Owning Seller posts the official answer.
  - Q&A becomes publicly visible on the product listing.
  - Buyer who asked is alerted when the Seller answers.
- **Source intent:** Build a reusable public product knowledge base that reduces repeated private support questions.
- **Architecture:**
  - Next.js/React owns Q&A rendering, ask-question form, pagination, loading/empty/error states, and authenticated Buyer interaction.
  - Laravel owns Product visibility, Buyer/Seller authorization, Q&A validation, persistence, official-answer rules, pagination, and notification events.
  - Database Q&A records are authoritative.
- **Recommended product-page flow:**
```text
Product Detail
→ Product Q&A section
→ public questions + official Seller answers

Authenticated Buyer
→ Ask Question
→ Laravel validates Product + Buyer
→ persist question
→ commit
→ notify owning Seller

Owning Seller
→ Answer Question
→ Laravel verifies Seller owns Product
→ persist official answer
→ commit
→ notify asking Buyer
→ public Q&A displays answer
```
- **Recommended MVP model:** one question with zero-or-one official Seller answer.
- **Feature boundaries:**
  - Chat/Messaging = private Buyer ↔ Seller conversation.
  - Product Q&A = public reusable product knowledge.
  - Product Reviews & Ratings = verified-purchase feedback after delivery.
  - Seller catalog owns Product records and Product ownership.
  - Notifications own delivery/read state for alerts.
- **Non-goals:**
  - private support chat
  - product reviews/ratings
  - Buyer answers
  - community answer voting
  - multiple Seller answers unless later required
  - Q&A attachments
  - anonymous question submission
  - AI-generated answers
  - arbitrary Seller answers on another Seller's Product
  - inventing moderation/edit/delete behavior not defined by the source
## MUST
### Public read access
- Published Product Q&A should be readable wherever the underlying Product is publicly buyer-visible.
- Guest visitors may read public Q&A when Product Detail itself is publicly accessible.
- Reading Q&A does not require Buyer authentication unless storefront policy later requires login.
- Public Q&A must never expose private Buyer/Seller profile data.
- If the Product is not buyer-visible, its public Q&A must not independently expose the hidden Product through a public Q&A endpoint.
### Buyer authentication for asking
- Creating a question requires authenticated `BUYER`.
- Laravel derives the Buyer identity from authentication.
- Never trust client-submitted:
  - `buyer_id`
  - seller ID
  - asker role
  - created timestamp
  - answered state
- Same-email Seller/Admin/etc. accounts must not satisfy Buyer question creation through the Buyer endpoint.
- Use:
  - `401` unauthenticated
  - `403` wrong role/forbidden
  - `404` Product/Q&A unavailable within scope
  - `422` invalid question
  - `409` duplicate/conflicting mutation where applicable
### Product eligibility
- A Buyer can ask only about an authoritative Product record.
- Product must be buyer-visible according to the same visibility rules used by Search/Homepage/Browse Shop.
- Do not allow questions against:
  - non-existent Product
  - unpublished/inactive Product
  - compliance-removed Product
  - hidden Seller catalog where current Seller status forbids buyer visibility
- Whether Vacation Mode permits new Q&A while listings are hidden is Open and should follow Product visibility policy.
- Seller ID is derived from the Product relationship.
### Product relationship
- Source requires Q&A linked directly to `Products`. fileciteturn42file0
- Every Q&A record must reference one Product.
- Recommended relationships:
```text
Product
└── ProductQAs[]

Buyer
└── asked ProductQAs[]

Seller
└── answers Q&A for Products they own
```
- Never use a product name/SKU string alone as ownership proof.
- Persist stable server-generated IDs.
### Question data
- Minimum question data:
  - Q&A ID
  - Product ID
  - asking Buyer ID
  - question body
  - asked timestamp
- Optional implementation metadata:
  - answer body
  - answering Seller/account ID
  - answered timestamp
- Store timestamps server-side in UTC.
- Exact table/column names follow repository conventions.
### Question validation
- Laravel must:
  - trim/normalize input
  - reject empty/whitespace-only questions
  - enforce a server-side maximum length
  - validate text encoding/shape
  - treat text as untrusted user-generated content
- Exact maximum length is Open.
- Client validation improves UX but is not authoritative.
- Do not render question text as raw executable HTML.
- OWASP recommends context-aware output encoding so untrusted text is displayed as data, not code. citeturn727618search2
### Question creation
- Conceptual endpoint:
```http
POST /api/products/{product}/questions
```
- Laravel sequence:
  1. authenticate `BUYER`
  2. resolve buyer-visible Product
  3. derive Product Seller
  4. validate question
  5. create Q&A record
  6. commit
  7. alert Seller after commit
  8. return safe Q&A Resource
- Notification failure must not undo a successfully persisted question.
### Seller answer authority
- Only the Seller that owns the Product may publish the official answer.
- Laravel must derive ownership from:
```text
question.product.seller_id
```
and the authenticated Seller.
- Never trust:
```text
seller_id
is_owner
is_official_answer
```
from the client.
- Another Seller must receive `403` or scoped `404` according to repository conventions.
- Buyer cannot create the official Seller answer.
### Seller feature source gap
- Buyer source explicitly requires "the seller to answer publicly." fileciteturn43file0
- `Seller.md` does not define a standalone Product Q&A management feature.
- Therefore:
  - Seller answer capability is required to satisfy Buyer Product Q&A.
  - Exact Seller dashboard/page placement is unresolved.
  - Do not pretend Seller.md already defines a dedicated Q&A feature.
- A future Seller-side spec should consume this same shared `Product_QA` domain.
### Official answer
- Recommended MVP: zero-or-one official Seller answer per question.
- Conceptual answer mutation:
```http
POST /api/seller/product-questions/{question}/answer
```
or repository-equivalent.
- Laravel must:
  1. authenticate Seller
  2. load Q&A + Product
  3. verify Product ownership
  4. validate answer body
  5. persist answer + answering Seller/account + timestamp
  6. commit
  7. alert asking Buyer after commit
- Exact endpoint may be `PATCH` if answer is stored directly on `Product_QA`.
- Do not expose a generic update endpoint that lets Seller rewrite Buyer question text.
### Answer validation
- Answer must be non-empty and length-bounded.
- Treat Seller answer as untrusted text for browser rendering.
- Do not render raw HTML unless a future rich-text feature introduces explicit sanitization.
- Exact maximum answer length is Open.
### One-answer concurrency
- If MVP allows one official answer:
  - two concurrent Seller answer requests must not create two official answers
  - enforce with schema/transaction/atomic update as appropriate
- A repeated identical client request must not duplicate Buyer alerts.
- Exact answer-editing policy is Open.
### Answer editing
- Source says Seller posts an official answer but does not define editing.
- MVP may treat the first answer as final, or allow Seller edits with history.
- Do not silently invent editable answers.
- If editing is enabled later:
  - restrict to owning Seller
  - update `answered_at`/`updated_at` according to chosen semantics
  - decide whether Buyer receives another notification
  - preserve moderation/accountability needs
### Question editing/deletion
- Source does not define Buyer question edit/delete.
- MVP should not require it.
- If later added:
  - only asking Buyer may edit/delete before an answer, unless policy says otherwise
  - answered public knowledge may require history/tombstone behavior rather than destructive deletion
- Exact behavior is Open.
### Public identity
- Source does not define whether the asking Buyer's name is public.
- Never expose Buyer email, phone, address, or private account metadata.
- Recommended: hide Buyer identity or show only a safe/anonymized display label.
- Seller answer must be clearly identified as the official Seller/shop response.
### Public Q&A DTO
- Recommended safe fields:
```text
id
question
asked_at
safe asker label optional
answer nullable
answered_at nullable
official seller/shop label
```
- Do not serialize raw Buyer/Seller models.
- Laravel API Resource or project DTO convention should explicitly select fields.
### Ordering
- Source does not define Q&A ranking.
- Recommended deterministic default:
  - newest questions first, or
  - answered questions first then newest
- Exact ranking is Open.
- Do not invent "Most Helpful" without a voting/helpfulness feature.
- Sorting fields must be allow-listed.
### Pagination
- Public Product Q&A list must be paginated.
- Do not return unbounded Q&A history for high-volume Products.
- Preserve Product scope on every page.
- Page-size maximum follows project conventions.
- Pagination response follows shared Laravel Resource conventions.
### Search within Q&A
- Q&A search is not source-required and is out of MVP unless later requested.
### Seller notification
- Source explicitly requires notifying the Seller when a new Product question is submitted. fileciteturn42file0
- Recipient must be derived from Product ownership.
- Do not let Buyer choose notification recipient.
- Notification should contain safe context:
  - question ID
  - Product ID/name summary
  - short safe question preview
  - internal destination to answer
- Do not send sensitive Buyer profile data unnecessarily.
- Exact delivery channel is **not source-defined**.
### Buyer answer notification
- Source explicitly requires alerting the querying Buyer after an official answer is posted. fileciteturn42file0
- Recipient is the Buyer stored on the Q&A record.
- Recommended context:
  - Q&A ID
  - Product ID/name
  - answer-posted event
  - internal Product/Q&A destination
- Do not notify every Buyer who viewed the Q&A.
- Subscriber/follower notifications are not source-required.
### Notification channels
- The source says "alert"/"notification system" but does not specify:
  - in-app notification
  - push
  - email
  - SMS
- Reuse AISLEY's configured notification domain/preferences.
- Do not require email/push/SMS specifically from this Product Q&A spec.
- Laravel supports queued database, broadcast, mail, SMS, and other notification channels, but actual channels remain a project decision. citeturn727618search0
### After-commit notifications
- Seller/Buyer notifications must be dispatched after the source mutation commits.
- A failed alert must not roll back:
  - persisted question
  - persisted official answer
- Laravel queued notifications can use `afterCommit()` or queue `after_commit` configuration. citeturn727618search0turn727618search1
- A rolled-back Q&A mutation must not generate a normal successful notification.
### Product deletion / hiding
- Q&A belongs to the Product.
- If Product becomes hidden/unpublished:
  - public Product Q&A follows Product visibility
  - historical records should not necessarily be hard-deleted
- Exact cascade/retention strategy is Open.
- Avoid database cascade behavior that destroys dispute/moderation-relevant history without an explicit policy.
### Seller suspension
- If Seller/compliance state hides the Product, its Q&A must no longer be publicly exposed through normal Product routes.
- Historical Q&A may remain persisted; do not expose internal suspension reasons.
### Moderation
- Profanity filtering, Admin moderation, report buttons, and automated moderation are not source-required.
- Existing Global Ban/Complaints/Compliance remain separate; basic validation, safe rendering, and rate limiting are still required.
### Rate limiting / spam
- Rate-limit question creation by Buyer and optionally IP; normal mutation limits may apply to answers.
- Exact thresholds are Open; use project-standard `429`.
### Duplicate submission
- Repeated clicks/retries must not create duplicate logical questions, answers, or alerts.
- Use project idempotency/duplicate-submit protection; frontend disables unresolved submit actions.
### Q&A vs Chat/Messaging
- Product Q&A:
  - public
  - tied to Product/SKU
  - reusable for future Buyers
  - official Seller answer
- Chat/Messaging:
  - private
  - participant-scoped
  - suited to individual support/pre-sale discussion
- Do not mirror private chat messages into public Q&A automatically.
- Buyer may choose `Message Seller` separately when the information should remain private.
### Q&A vs Product Reviews
- Q&A does **not** require a verified purchase.
- Product Reviews & Ratings are post-delivery verified-purchase feedback.
- Q&A is pre/post-purchase product clarification.
- Do not store Q&A in the `Reviews` table merely because both appear on Product Detail.
- Q&A must not affect product rating values.
### Frontend states
- Public list: loading, empty, loaded, pagination loading, error.
- Ask form: login-required, idle, validating, submitting, success, validation error, throttled, failure.
- Answer: unanswered or answered.
- If Product becomes unavailable while open, mutation fails safely and Product state refreshes.
### Accessibility
- Provide semantic section heading, labeled question input, announced validation/submission feedback, textual Seller-answer identification, and keyboard-accessible pagination/actions.
### Acceptance criteria
- [ ] Public visitor can read Q&A for a buyer-visible Product when public storefront access is enabled.
- [ ] Guest cannot submit a Buyer question.
- [ ] Authenticated non-Buyer cannot submit through Buyer Q&A endpoint.
- [ ] Buyer can submit a valid question against a buyer-visible Product.
- [ ] Buyer cannot spoof Product Seller/notification recipient.
- [ ] Question is linked to Product and authenticated Buyer.
- [ ] Hidden/non-public Product rejects new public questions.
- [ ] Another Seller cannot answer the Product question.
- [ ] Owning Seller can publish the official answer.
- [ ] Buyer cannot publish the official Seller answer.
- [ ] Question/answer text renders safely without executable HTML.
- [ ] Q&A public DTO omits Buyer/Seller private data.
- [ ] Product Q&A is paginated.
- [ ] New question alerts owning Seller after commit.
- [ ] Official answer alerts asking Buyer after commit.
- [ ] Notification failure does not undo Q&A persistence.
- [ ] Duplicate requests do not create duplicate logical questions/answers/alerts.
- [ ] Hidden Product stops exposing Q&A through public Product routes.
- [ ] Q&A remains separate from private Chat and verified-purchase Reviews.
- [ ] UI handles empty, unanswered, validation, throttled, and API-error states.
## HOW
### Project findings
- `Buyer.md` explicitly defines Product Q&A as Buyer questions on Product listings answered publicly by the Seller. fileciteturn43file0
- It defines Q&A as a public knowledge base tied directly to Product SKUs and requires a `Product_QA` schema linked to `Products`. fileciteturn42file0
- It also explicitly requires Seller notification for a new question and Buyer notification after an official answer. fileciteturn42file0
- `Seller.md` has Seller Chat and Review Management but no standalone Seller Product Q&A feature, so Seller answer UI placement is a source gap even though the Buyer source requires the Seller answer capability. fileciteturn43file3turn43file5
- `README.md` requires Laravel authorization/validation, pagination, safe Resources, after-commit notifications, idempotency protection, and no direct Next.js database access. fileciteturn42file2turn43file15
### Recommended data model
- Simple MVP that matches the source's single official answer:
```text
product_qas
- id
- product_id
- buyer_id
- question
- answer nullable
- answered_by_seller_id nullable
- asked_at / created_at
- answered_at nullable
- updated_at
```
- Alternative normalized `product_qa_answers` table is acceptable if future multi-answer/history requirements justify it.
- Do not introduce multiple public answers now without a requirement.
- Index:
  - `product_id`
  - `buyer_id`
  - unanswered/answered lookup fields if Seller dashboard needs them
### Laravel relationships
Conceptually:
```text
Product hasMany ProductQA
ProductQA belongsTo Product
ProductQA belongsTo Buyer
ProductQA answer belongsTo/records Seller
```
- Derive Seller authority from Product ownership.
- Do not duplicate a trusted mutable `seller_id` solely from request input.
### Laravel API
Conceptual Buyer/public endpoints:
```http
GET  /api/products/{product}/questions
POST /api/products/{product}/questions
```
Conceptual Seller endpoint:
```http
POST /api/seller/product-questions/{question}/answer
```
- Optional Buyer-owned "my questions" endpoint is not source-required.
- Use:
  - `StoreProductQuestionRequest`
  - `AnswerProductQuestionRequest`
  - `ProductQAPolicy`
  - `ProductQAResource`
- Keep controllers thin.
### Authorization
- Laravel Policies are suited to model/resource authorization and can verify whether the authenticated Seller owns the related Product. citeturn227786search0
- Recommended policy concepts:
```text
view
ask
answer
```
- Public `view` may allow guests only when Product is public.
- `ask` requires authenticated `BUYER`.
- `answer` requires authenticated Seller owning `question.product`.
### Domain actions
Recommended:
```text
AskProductQuestion
AnswerProductQuestion
```
- `AskProductQuestion` derives Seller from Product and emits `ProductQuestionAsked` after persistence.
- `AnswerProductQuestion` enforces Product ownership and emits `ProductQuestionAnswered`.
- Stable event IDs/request IDs may prevent duplicate notification effects.
### Notifications
Recommended notifications/events:
```text
ProductQuestionAsked
→ ProductQuestionReceivedNotification
→ owning Seller

ProductQuestionAnswered
→ ProductQuestionAnsweredNotification
→ asking Buyer
```
- Delivery channels follow shared user preferences/infrastructure.
- Laravel notifications support queueing and database/broadcast/mail/SMS channels; use only configured AISLEY channels. citeturn727618search0
- Queue after commit. citeturn727618search0turn727618search1
### Next.js / React
Recommended Product Detail components:
```text
ProductQASection
├── ProductQAList
│   └── ProductQAItem
├── ProductQAPagination
└── AskProductQuestionForm
```
- Public Q&A list may be server-rendered/fetched with Product Detail.
- Ask form is interactive and may be a Client Component.
- Seller answer form belongs in a future/shared Seller Q&A management surface.
- Do not implement Laravel business logic in a Next.js API route.
### Safe rendering
- Render question/answer text through normal React escaped text output.
- Avoid `dangerouslySetInnerHTML` for plain-text Q&A.
- OWASP recommends output encoding for untrusted values so browser content is displayed as data rather than executable code. citeturn727618search2
### Tests
- **Laravel:** public read; Buyer-only ask; hidden Product rejection; Product linkage; owner-Seller answer; non-owner/Buyer answer denial; validation; pagination; idempotency; after-commit notifications; safe Resource.
- **Frontend:** public/empty/unanswered/answered states; login-required ask; validation; pagination; errors/throttle; safe rendering; accessibility.
### Risks
- **XSS/UGC:** unsafe rendering can create stored XSS.
- **Seller spoofing:** weak ownership checks can let another Seller answer.
- **Spam/duplicates:** repeated questions or alerts can flood users.
- **Feature overlap:** Q&A can duplicate private Chat.
- **PII leakage:** public DTOs can expose Buyer identity.
- **Missing Seller surface:** Buyer source requires answers but Seller source lacks a Q&A feature.
- **Scope growth:** voting, comments, attachments, moderation, and search can turn this into a forum.
### Open questions
- Seller-side inbox/page for unanswered questions.
- One official answer only vs answer history/multiple answers; Seller edit policy.
- Buyer edit/delete policy and public identity display.
- Question/answer length limits and default ordering.
- Notification channels and whether real-time answer updates are needed.
- Vacation Mode behavior.
- Spam/report/Admin moderation policy.
- Product deletion/archive behavior.
- Whether a Buyer "My Questions" page is needed.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Seller feature model: `Seller.md`
- Laravel Notifications: https://laravel.com/docs/12.x/notifications
- Laravel Queues: https://laravel.com/docs/12.x/queues
- Laravel Authorization: https://laravel.com/docs/12.x/authorization
- OWASP Cross Site Scripting Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
