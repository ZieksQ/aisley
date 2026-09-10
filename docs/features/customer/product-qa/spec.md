---
feature: product-qa
title: Customer Product Q&A
system: AISLEY
type: Feature Specification
version: 1.1
status: Deferred — no Product Q&A API, schema, notifications, or UI is implemented
role: Customer
scope: Customer storefront and owning Seller answer surface through the Laravel API
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Buyer.md, docs/domains/Seller.md, docs/design.md
---

# Customer Product Q&A

## WHAT

- **Purpose:** Let a Customer ask a public, Product-specific question and let the owning Seller publish one official answer for future shoppers.
- **Terminology:** `customer` is the persisted/API role; “Buyer” is the storefront term. Questions belong to a Product, and Seller authority comes from that Product's Shop ownership.
- **Current state:** Product Q&A is documented but deferred. There is no `ProductQA` model/table, question or answer route, notification producer, Product Detail section, or Seller answer screen in the current implementation.
- **MVP flow:**

  ```text
  public Product Detail → read paginated Q&A
  authenticated Customer → submit question
  API → validate visible Product and persist question
  after commit → notify owning Seller
  owning Seller → publish official answer
  after commit → notify asking Customer
  Product Detail → display the answer publicly
  ```

- **Boundaries:** Q&A is reusable public product knowledge. Chat/Messaging remains private support; Reviews & Ratings remain verified-purchase feedback; Notifications own delivery/read state; Seller catalog owns Product records.
- **Non-goals:** Customer answers, anonymous questions, private chat mirroring, Q&A attachments, voting, comments, multiple official answers, AI answers, full-text search, Seller ownership changes, and unapproved moderation/edit/delete behavior.

## MUST

### Public read and Product visibility

- Plan `GET /api/v1/products/{product}/questions?page=&limit=` as a public, paginated endpoint. It is unavailable until the schema, policy, and UI contract are implemented.
- Allow guests and authenticated Customers to read Q&A only when the Product passes `Product::storefrontVisible()` and the Product Detail is publicly accessible.
- Reapply the visibility scope in the Q&A query. A hidden, draft, archived, compliance-restricted, inactive-Shop, vacation-Shop, suspended-Shop, or inactive-Seller Product must return a scoped `404`/empty public result and must not leak its Q&A.
- Use a bounded `limit` (project maximum 50) and deterministic `asked_at DESC, id DESC` ordering. Preserve valid page state and Product scope on every page.
- Public DTOs contain only Q&A data needed for display: Q&A ID, question text, asked time, nullable answer text, answer time, and a safe Seller/Shop label when approved.
- Never expose Customer email, phone, address, role/status, registration evidence, raw model serialization, or internal moderation notes.

### Customer question creation

- Plan `POST /api/v1/products/{product}/questions`; it is unavailable until the schema, policy, and notification contract are implemented.
- Require an authenticated active `customer` through Sanctum. Guests receive `401` and may be redirected to sign-in by the UI, but their question is never stored locally or submitted anonymously.
- Derive the Customer, Product, Shop, and Seller from the authenticated session and relationships. Reject or ignore client `customer_id`, `buyer_id`, `seller_id`, role, timestamps, answered flags, and notification recipients.
- Resolve the Product through `storefrontVisible()` inside the mutation. A Customer may ask about a visible Product without proving a purchase; Q&A is not a review.
- Accept plain text only. Trim and normalize Unicode, reject empty/whitespace-only content, enforce a server-side maximum (initial recommendation: 1,000 characters), and reject malformed input. Client limits are only UX hints.
- Treat the question as untrusted content. Render it as escaped text; do not accept executable HTML, Markdown, scripts, or arbitrary embeds.
- Return `401` unauthenticated, `403` wrong role/inactive account, `404` unavailable Product, `409` idempotency/conflict failure, `422` validation failure, and `429` rate limit. Error bodies follow existing API conventions.
- Rate-limit question creation per Customer and optionally IP using the project throttle convention. A retry or repeated submit must not create another logical question or notification.

### Seller official answer

- The owning Seller is the only role allowed to answer. Seller authority is derived through `question.product.shop.seller`, never from a request field.
- Plan `POST /api/v1/seller/product-questions/{question}/answer` (or the route selected by the future Seller Q&A spec); this endpoint is unavailable until its Seller contract exists.
- Require an authenticated active `seller`, load the Q&A with its Product/Shop, and return an ownership-safe `403`/`404` for another Seller, Customer, Admin, or same-email account.
- Store one official answer in the MVP. The mutation must not rewrite the Customer question and must reject a second concurrent answer with a stable result or `409`.
- Validate answer text as non-empty, normalized, bounded plain text (initial recommendation: 2,000 characters), and escaped on every public render. Answer editing/history is open and must not be invented silently.
- The Seller cannot answer a hidden Product through a public answer flow. Historical Q&A may remain internal when the Product later becomes unavailable.

### Data and consistency

- The proposed additive `product_qas` record contains UUID `id`, UUID `product_id`, UUID `customer_id`, `question_text`, nullable `answer_text`, nullable `answered_by_seller_id`, `asked_at`, nullable `answered_at`, and timestamps.
- Foreign keys and indexes must scope lookups by Product, Customer, and answer state. The Product relationship is authoritative; `answered_by_seller_id` is an audit value populated from the verified owner.
- Keep one row per question and at most one official answer for the MVP. Use a transaction plus a uniqueness/conditional update guard so concurrent answer attempts cannot create two answers.
- Support an actor-scoped idempotency key for question and answer mutations. Replays return the original committed projection and do not duplicate rows or alerts.
- Q&A writes, answer writes, and any audit/outbox record commit atomically. A notification or queue failure never rolls back a committed question or answer.
- Do not cascade-delete public history merely because a Product, Shop, or Seller is archived. Retention, tombstones, and moderation are separate decisions.

### Notifications

- After a question commits, notify the Seller resolved from Product ownership. Include only Q&A/Product identifiers, a short safe question preview, and an allow-listed answer destination.
- After an official answer commits, notify the Customer stored on that Q&A. Do not notify every Product viewer.
- Use the existing notification domain and configured channels; the exact database, push, email, or SMS combination is open. Do not require a new provider in this feature.
- Dispatch notifications after commit and deduplicate by Q&A event/actor. Delivery failure is observable and retryable but cannot undo Q&A persistence.

### Customer and Seller UI

- Add a Q&A section to the existing Product Detail page only after the read API exists. Guests can read; the ask form requires Customer sign-in and an intentional submit.
- Customer states: loading, empty, loaded/unanswered, answered, pagination loading, validation error, throttled, unauthorized/login-required, Product-unavailable, network failure, and retry.
- Use semantic headings, a labelled question field, keyboard-accessible pagination and submit controls, visible focus, field-level errors, and announced success/failure states. Never claim success before the API projection returns.
- Seller answer UI belongs to a future Seller Q&A management surface, not to the Customer application. The Seller feature must consume this same ProductQA ownership contract.
- Do not add Q&A data to shared public caches when it contains Customer-specific state. Public lists may be cached only as Product-scoped, non-personal projections.

### Acceptance criteria

- [ ] Guests can read paginated Q&A only for a currently buyer-visible Product.
- [ ] Only an authenticated active Customer can create a question; guest and cross-role requests are denied.
- [ ] Product, Customer, Seller ownership, answered state, and notification recipient are server-derived.
- [ ] Empty, oversized, malformed, executable, and rate-limited question/answer input is rejected safely.
- [ ] Each question belongs to one Product and Customer; a Customer cannot attach it to another Product or Seller.
- [ ] Only the Product-owning Seller can publish one official answer, and the Customer question remains unchanged.
- [ ] Public DTOs contain no private Customer/Seller data, credentials, evidence, or raw storage paths.
- [ ] Product visibility is rechecked for reads and mutations; hidden Products do not expose public Q&A.
- [ ] Concurrent/retried question and answer requests are idempotent and do not duplicate records or notifications.
- [ ] Notification delivery is after-commit and cannot reverse a committed Q&A decision.
- [ ] Customer Product Detail and future Seller surfaces expose accessible loading, empty, answered, validation, unauthorized, unavailable, and retry states.
- [ ] Q&A remains separate from private Chat/Messaging and verified-purchase Reviews & Ratings.

## HOW

### Current project boundary

- `docs/domains/Buyer.md` documents Product Q&A as a deferred public Customer question/Seller answer capability. `docs/domains/Seller.md` does not yet define the Seller answer screen.
- Current `ProductDetailController` and `ProductDetailResource` expose visible Product data but no Q&A relation. No Q&A route, model, migration, service, notification, or frontend component exists.
- Do not mark an acceptance item implemented until the route, migration, authorization, tests, and owning UI are present. Do not add a Seller answer flow by changing only the Customer spec.

### Laravel implementation plan

- Add an additive migration and `ProductQA` model/relations. Keep enum-like fields string-backed and derive ownership from authenticated users, Product, Shop, and Seller relationships.
- Add Form Requests, a `ProductQAPolicy`, thin Customer/Seller controllers, a safe `ProductQAResource`, and actions such as `AskProductQuestion` and `AnswerProductQuestion`.
- Scope public reads with `storefrontVisible()` before pagination. Lock the Q&A row or use a conditional update for one-answer concurrency; persist idempotency and after-commit notification records transactionally.
- Reuse the existing Customer/Seller notification resources and configured queue/outbox behavior. Do not send private Customer data in notification payloads.

### Next.js implementation plan

- Add `ProductQASection`, `ProductQAList`, `ProductQAItem`, pagination, and `AskProductQuestionForm` under the existing Product Detail route. Use the existing API client and Customer auth/return-path behavior.
- Render Q&A as escaped plain text, not `dangerouslySetInnerHTML`. Keep Product Detail's existing safe Markdown renderer limited to the Seller-authored description, not Q&A content.
- Add a separate Seller dashboard component only when a Seller Q&A spec defines its route and screen; do not call a conceptual endpoint as if it were live.

### Verification and rollout

- Laravel tests must cover guest/role gates, Product visibility, Product/Seller ownership, validation, pagination, DTO privacy, one-answer concurrency, idempotency, after-commit notification failure, and hidden Product behavior.
- Frontend tests must cover public/empty/answered states, login-required ask, validation/throttle/retry, pagination, unavailable Product, safe rendering, keyboard flow, and announced feedback.
- Release the migration and API before enabling the Product Detail Q&A section. Monitor scoped `404`s, validation/throttle rates, duplicate suppression, notification failures, and public DTO errors without logging question/answer contents.
- Open decisions: exact question/answer limits, page size/order, Seller inbox placement, answer edit/history policy, Customer display label, retention/moderation/reporting, vacation-mode behavior, and notification channels.

**Sources:** `docs/domains/Buyer.md`, `docs/domains/Seller.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/design.md`, [Laravel Authorization](https://laravel.com/docs/12.x/authorization), [Laravel Notifications](https://laravel.com/docs/12.x/notifications), [Laravel Validation](https://laravel.com/docs/12.x/validation), and [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).
