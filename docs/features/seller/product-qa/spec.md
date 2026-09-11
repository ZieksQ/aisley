---
feature: seller-product-qa
title: Seller Product Q&A Answer Management
system: AISLEY
type: Feature Specification
version: 1.1
status: Implemented (Phase 2) — Seller queue, detail, and answer management
role: Seller
scope: Seller Web Application and Laravel API
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Seller.md, docs/features/customer/product-qa/spec.md, docs/design.md
---

# Seller Product Q&A Answer Management

## WHAT

- **Purpose:** Let the Seller that owns a Product publish one official answer to a Customer's public Product question.
- **Canonical role:** `seller` is the persisted/API role. Seller authority is derived through `question → product → shop → seller`.
- **Current state:** The Laravel queue/detail and answer endpoints, validation, ownership checks, persistence, idempotency, Customer notification, and dedicated Seller queue/detail screens are implemented.
- **Flow:**
  ```text
  Customer asks about a visible Product
  → database notification reaches the owning Seller
  → owning Seller submits one plain-text answer
  → transaction commits
  → Customer receives an in-app answer notification
  → Product Detail displays the public answer
  ```
- **Owns:** Seller eligibility, Product/Shop scoping, queue filters, answer validation, one-answer concurrency, safe answer projection, and Seller-facing queue/detail entry points.
- **Dependencies:** Customer Product Q&A owns question creation/public reading; Catalog owns Product and Shop ownership; Notifications owns delivery/read state; Reviews and Chat remain separate.
- **Non-goals:** Customer questions, Seller-created questions, anonymous answers, multiple official answers, answer editing/history, voting, comments, attachments, Markdown/HTML, AI answers, moderation, direct Customer contact, and cross-Shop access.

## MUST

### Implemented answer API

- Use `POST /api/v1/seller/product-questions/{question}/answer`.
- The route requires `auth:sanctum` and the `seller.active` middleware. Pending, suspended, deactivated, wrong-role, and unauthenticated accounts cannot answer.
- Require a UUID `Idempotency-Key` header. The JSON body contains only `{ "answer": "..." }`; unknown fields are rejected.
- Normalize trimmed Unicode text and line breaks. Accept plain text up to 2,000 characters; reject empty, control-character, HTML, Markdown, script, and executable-embed input.
- Laravel resolves the Q&A, Product, Shop, and owning Seller server-side. Do not accept or trust client ownership fields such as `seller_id`, `shop_id`, `customer_id`, status, timestamps, or notification recipients.
- Re-apply `Product::storefrontVisible()` inside the answer mutation. A draft, archived, restricted, inactive, vacation, suspended, or otherwise unavailable Product returns a scoped `404` and cannot be answered through this API.
- Only the Seller owning the Product's Shop may answer. A different Seller, Customer, Admin, or same-email account receives a safe `403`/`404` result without another tenant's data.
- The first valid answer fills `answer_text`, `answered_by_seller_id`, `answer_idempotency_key`, `answer_request_hash`, and `answered_at`. The Customer question is never rewritten.
- A successful first answer and an identical idempotent replay return `200` with `{ "data": ... }` and `Cache-Control: no-store, private`.
- The Customer safe resource contains only `id`, `question`, `askedAt`, `answer`, `answeredAt`, and an approved `sellerLabel`. The Seller queue/detail resource additionally contains the answer state and Product-safe `id`, `name`, `slug`, `status`, and `publishedAt`. Neither resource serializes Customer PII, credentials, evidence, addresses, payment data, internal notes, or storage paths.

### Errors and retries

- Return `401` for a missing/expired Sanctum session, `403` for role/status/ownership denial, `404` for a missing or unavailable Q&A/Product, `422` for invalid body/header fields, `409` for an idempotency mismatch or already-answered question, and `429` for the configured Seller answer throttle.
- Reusing an Idempotency-Key with different question/answer details returns `IDEMPOTENCY_KEY_REUSED`; the original committed answer is never overwritten.
- A second official answer returns `PRODUCT_QA_ALREADY_ANSWERED`. Concurrent requests lock the Q&A row so at most one answer commits.
- Clients may retry only with the same key and payload. On `401` re-authenticate; on `409` refetch; on `422` show field errors; on `429` honor server retry guidance; on timeout/network failure retry safely with the same key.

### Seller notification and consistency

- A committed Customer question produces one database notification of type `seller-product-qa.question-asked` for the owning active Seller. It is available through the existing Seller notification API.
- A committed answer produces one database notification of type `customer-product-qa.answered` for the active Customer who asked that Q&A. It does not notify unrelated viewers or Sellers.
- Notifications are dispatched after the Q&A transaction commits and use deterministic IDs. Delivery failure is observable/retryable and never rolls back or reverses the answer.
- Notification read state is not answer state. Opening or marking a notification read must not answer, edit, or mutate a Product Q&A record.
- Use the existing Seller notification endpoints and resource for the current notification surface:
  ```http
  GET  /api/v1/seller/notifications?status=&per_page=&page=
  GET  /api/v1/seller/notifications/{notification}
  POST /api/v1/seller/notifications/{notification}/read
  ```
- The Q&A notification destination is a safe deep link to the implemented Seller Product Q&A detail route. It remains a hint and does not mutate answer state when opened or marked read.

### Implemented Seller queue/detail UI

- Seller UI is a React/Vite dashboard surface under the existing dark-mode Seller design system. Q&A screens remain outside the Customer storefront.
- The implemented Seller list/detail endpoints are:
  ```http
  GET /api/v1/seller/product-questions?status=all|unanswered|answered&product=&per_page=&page=
  GET /api/v1/seller/product-questions/{question}
  ```
- The queue is Seller/Shop-scoped, paginated, deterministic, and filterable by unanswered/answered state and Product name. The server derives all ownership and status fields, and archived historical Product questions remain visible to the owning Seller as read-only records.
- The detail view shows Product-safe context, question text, asked time, answer state, and the answer form. Customer email, phone, address, order/payment data, and registration evidence stay hidden.
- The form uses the implemented answer endpoint, generates one UUID key per logical submit, preserves the key across retry, and never claims success before the committed response is returned.
- Implemented UI states: loading, empty, answered/read-only, editable unanswered, validation, forbidden/not-found, throttled, session-expired, network/timeout retry, unavailable Product, and queued-notification success messaging.
- Use labelled controls, visible focus, keyboard operation, screen-reader status announcements, non-color-only answer state, and accessible dark-mode contrast. Q&A text renders as escaped plain text.

### Acceptance criteria

- [x] Only an active owning Seller can publish one answer for a visible Product Q&A.
- [x] Product, Shop, Seller, Customer notification recipient, and answer state are server-derived.
- [x] Plain-text validation rejects unknown fields, missing/invalid UUID idempotency keys, empty/oversized input, unsafe markup, and control characters.
- [x] Cross-Seller, cross-role, inactive-account, foreign-question, and hidden-Product requests cannot read or mutate another tenant's Q&A.
- [x] The Customer question remains unchanged and the response excludes private Seller/Customer data and raw storage paths.
- [x] Concurrent or retried answers are serialized, idempotent, and cannot create duplicate answers or notifications.
- [x] After-commit notification failure cannot undo a committed answer; notification read state remains separate.
- [x] Seller queue/detail endpoints and React screens are implemented with the stated accessible states.
- [ ] Answer edit/history, moderation/reporting, and Seller-specific retention rules are approved and implemented.

## HOW

### Current Laravel contract

- Routes: `src/api/routes/api.php`; controller: `App\Http\Controllers\Seller\ProductQAController`.
- Validation: `ListProductQuestionsRequest` and `AnswerProductQuestionRequest`; Shop scoping and detail projection are controller-level, while mutation and locking use shared `ProductQAService::answer`.
- Projections: `Customer\ProductQAResource` for storefront responses and `Seller\SellerProductQAResource` for queue/detail/answer responses. Exception codes include `PRODUCT_QA_NOT_FOUND`, `PRODUCT_QA_FORBIDDEN`, `PRODUCT_QA_ALREADY_ANSWERED`, and `IDEMPOTENCY_KEY_REUSED`.
- Persistence: additive `product_qas` migration/model with Product, Customer, and verified answering-Seller foreign keys, actor-scoped idempotency keys/hashes, timestamps, and Product/Customer/Seller indexes.
- Notifications: `ProductQuestionAskedNotification`, `ProductQuestionAnsweredNotification`, and `DeliverProductQANotification`; reuse the database notification/read-state contract.
- Keep enum-like future fields string-backed in migrations and PHP-enum-cast in the API. Do not add a Seller-owned duplicate Q&A table.

### Seller implementation boundary

- The existing notification inbox deep-links to the Seller detail route; the queue and detail APIs now define the filters, ordering, safe fields, and retention boundary for the implemented surface.
- Scope every query as `authenticated Seller → exactly one Shop → Product → ProductQA`; use policies/scoped queries before serialization, not only client-side filtering.
- If a future Seller response needs a new field or lifecycle (edits, drafts, moderation), add an additive migration and update the Customer Q&A contract before coding.
- Keep Product description Markdown/MDX rendering separate. Product Q&A answers remain plain text and do not use the Seller's MDXEditor or image-upload policy.

### Verification and rollout

- `src/api/tests/Feature/Customer/ProductQATest.php` and `src/api/tests/Feature/Seller/ProductQATest.php` cover role/Shop isolation, visibility, validation, pagination/filtering, idempotency, locking, notification dedupe, DTO privacy, and error mapping.
- The Seller React pages cover filters, pagination, answer submit/retry, already-answered conflict, session expiry, unavailable Product, network failure, and accessible loading/empty/read-only states.
- Release API/schema and any UI together. Monitor scoped denials, validation/throttle rates, conflict/replay rates, queue failures, notification failures, and answer latency without logging full question/answer content.
- Open decisions before expanding scope: answer edit/version policy, moderation/reporting, Customer-facing Seller label, retention, and additional notification channels.

**Sources:** `docs/features/customer/product-qa/spec.md`, `docs/domains/Seller.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/design.md`, [Laravel Authorization](https://laravel.com/docs/12.x/authorization), [Laravel Notifications](https://laravel.com/docs/12.x/notifications), [Laravel Validation](https://laravel.com/docs/12.x/validation), and [Laravel Queues](https://laravel.com/docs/12.x/queues).
