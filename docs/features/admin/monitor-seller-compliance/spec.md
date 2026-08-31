---
feature: monitor-seller-compliance
title: Admin Monitor Seller Compliance
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented MVP
role: Admin
scope: Admin Web Application
---

# Admin Monitor Seller Compliance

## WHAT

- **Purpose:** Let authorized Admins manually review a Seller or Product against an applicable AISLEY policy, retain an immutable decision history, issue a formal warning, restrict a listing from new sales, or refer a Seller suspension to Account Management.
- **Primary actor:** authenticated Admin with the Seller Compliance permission.
- **Affected records:** one Seller and, optionally, one Product belonging to that Seller.
- **Existing foundation:** Admin authentication, custom permissions, audit log/outbox, Platform Settings policy versions, Seller-owned shops/products, Buyer visibility checks, and ordinary account suspension already exist.
- **Lifecycle:**

```text
Admin opens or creates a case → OPEN
→ DISMISSED, or CONFIRMED
→ warning and/or active Product restriction
→ optional suspension request through Manage User Accounts
→ case CLOSED
```

- **Boundaries:**
  - Platform Settings owns policy text and immutable versions; this feature records the version used for a decision when applicable.
  - Seller Catalog owns normal draft/publish/archive changes; a compliance restriction overrides Buyer availability and prevents Seller republishing until revoked by an authorized Admin.
  - Manage User Accounts owns the canonical `users.status` suspension/restoration transition and its lifecycle history.
  - Global Ban, complaints/refunds, Chat, and external notification providers remain separate domains.
- **Non-goals:** automatic violation detection, strike thresholds, a new prohibited-product taxonomy, destructive Product/account deletion, changing prices/inventory, refunds, appeals, or a duplicate Seller suspension model.

## MUST

### Access and scope

- Require Sanctum authentication, persisted `admin` role, and `seller_compliance.manage` permission; Laravel authorization is authoritative.
- Return `401` unauthenticated, `403` unauthorized, `404` absent or out-of-scope resource, `422` invalid input, and `409` stale/invalid action.
- Every case/action must resolve the authoritative Seller and optional Product server-side. A Product must belong to the referenced Seller.
- Queue/list payloads must omit passwords, private registration evidence, payout data, and unrelated Customer/order data.

### Cases and evidence

- An Admin may create a case from manual review; future complaint/report sources may create a linked case without copying their evidence.
- A case records Seller, optional Product, source reference, applicable policy/version when available, safe reason, status, creator, and timestamps.
- Supported case states are stored as strings with PHP enum casts: `open`, `confirmed`, `dismissed`, and `closed`.
- A confirmed action appends an immutable compliance action: warning, product restriction, product-restriction revocation, or suspension referral. Existing actions are never edited or deleted.
- The Admin queue is paginated and allow-lists status, Seller, Product, policy, and date filters. Detail includes only policy-relevant listing data, prior actions, and authorized source references.
- Evidence remains owned and access-controlled by its source feature. This feature stores safe IDs/links only and never copies private files.
- An open case, case creation, or viewing policy text must not change Seller access or Buyer Product availability.
- A case may close only after dismissal or after its selected confirmed actions have committed; closing does not erase the action history.
- A policy reference is optional only when the decision is based on an explicitly documented platform rule not yet versioned in Platform Settings; the safe reason must identify that rule.

### Decisions

- Dismiss closes the case without changing Seller/Product availability; a safe dismissal note is required.
- Warning requires a confirmed case and a Seller-visible reason. It records the actor/time and must not change Product or account state.
- Product restriction requires a confirmed Product case, a reason, and a policy reference when one exists.
  - It creates one active Admin-owned restriction for the Product, makes it unavailable to Buyer search, Shop browse, Product Detail, Cart validation, and Checkout.
  - It preserves historical Order snapshots and does not delete the Product or Inventory.
  - Seller product mutation endpoints may allow non-public edits, but may not publish or unarchive while the restriction is active.
  - Only an authorized Admin may revoke a restriction; revocation is a new immutable action and does not automatically republish the Product.
- Seller suspension is a referral to the Manage User Accounts lifecycle action, not a direct status update from this feature.
  - Require a confirmed case, reason, and explicit confirmation of the Seller identity.
  - The Account Management transaction owns `users.status`, access denial, restoration eligibility, and lifecycle history.
  - Buyer availability must exclude active Products whose Seller is suspended; historical orders remain accessible to authorized fulfilment/support flows.
- One action must not silently perform another: warning, Product restriction, and suspension each require their own explicit request/confirmation.

### Integrity, communication, and audit

- Lock the case, Seller, Product, and active restriction as applicable inside one transaction; re-check state before mutation and return `409` on conflict.
- Repeated requests must be idempotent: an already-active restriction or already-applied suspension referral returns the canonical result without duplicate actions or messages.
- Record safe Admin audit events with actor, target IDs, action, before/after moderation state, policy reference, and safe reason. Do not put private evidence or message contents in audit metadata.
- After commit, create a Seller-facing in-app notification or use the configured communication channel when that shared feature is available. Delivery failure must not roll back the decision.
- Seller-facing reasons must be concise and safe; internal notes and source evidence remain Admin-only.

### UI and acceptance

- Admin routes are `/seller-compliance`, `/seller-compliance/cases/{case}`, and linked Seller/Product detail views.
- Queue/detail/action screens provide loading, empty, forbidden, validation, conflict, retry, and success states; high-impact actions name the Seller/Product and consequence.
- Forms and dialogs require labels, keyboard operation, focus management, visible focus, and text—not color alone—for status.
- [x] An unauthorized user cannot list, view, create, or act on compliance cases.
- [x] A case cannot link a Product owned by another Seller.
- [x] Dismissal, warning, restriction, revocation, and suspension referral preserve immutable actor/time/reason history.
- [x] A restricted Product cannot be purchased or republished by its Seller, while historical Orders remain intact.
- [x] A suspended Seller's Products are unavailable through every Buyer purchase path.
- [x] Concurrent/retried actions do not overwrite state or duplicate restrictions, messages, or audit events.
- [x] Communication failure does not undo a committed compliance decision.

## HOW

- Add additive tables/models for `seller_compliance_cases`, immutable `seller_compliance_actions`, and an active/revocable `product_compliance_restrictions` record. Use UUIDs, foreign keys, indexes for queue filters, and string columns with enum casts; never modify an executed migration.
- Add Admin Form Requests, Policies/Gates, API Resources, a `SellerComplianceService`, and explicit endpoints:

```http
GET  /api/v1/admin/seller-compliance/cases
POST /api/v1/admin/seller-compliance/cases
GET  /api/v1/admin/seller-compliance/cases/{case}
POST /api/v1/admin/seller-compliance/cases/{case}/dismiss
POST /api/v1/admin/seller-compliance/cases/{case}/warn
POST /api/v1/admin/seller-compliance/cases/{case}/restrict-product
POST /api/v1/admin/seller-compliance/cases/{case}/revoke-product-restriction
POST /api/v1/admin/seller-compliance/cases/{case}/suspend-seller
POST /api/v1/admin/seller-compliance/cases/{case}/close
```

- Reuse the Account Management lifecycle service for suspension. Add one reusable Buyer-visible Product query/availability policy that includes Product publication, active Seller status, vacation eligibility, and active compliance restriction; apply it to discovery, detail, Cart, and Checkout.
- Build the Admin queue, case detail, policy/action history, and separate confirmation forms with the existing credentialed API client and Admin layout. Do not expose a generic status `PATCH` endpoint.
- Ship with manual Admin-created cases only. Add complaint/report-created cases only after their source feature provides an authorized immutable reference.
- Keep Admin-created Product restrictions queryable by Admin reporting/history without weakening the Buyer-visible availability policy.
- Expose no Seller-facing compliance mutation endpoint in this MVP; any appeal or reinstatement workflow is a separate approved feature.
- Log an operational request ID with each action response so an Admin can report a failed or conflicted moderation attempt without exposing sensitive payloads.
- Use transactions and `lockForUpdate()` for conflicting decisions; Laravel recommends wrapping pessimistic locks in transactions. [Laravel query locking](https://laravel.com/framework/docs/13.x/queries#pessimistic-locking)
- Dispatch notification/event work only after commit; Laravel supports after-commit event dispatch. [Laravel events](https://laravel.com/framework/docs/13.x/events#dispatching-events-after-database-transactions)
- Test authorization/permission boundaries, safe serialization, queue filters, cross-Seller Product mismatch, every case/action transition, idempotency/concurrency, Buyer visibility, Cart/Checkout revalidation, Account Management referral, audit records, and after-commit communication failure.
- Run API tests on SQLite and PostgreSQL, plus Admin lint, strict TypeScript, production build, and focused accessibility checks.
- **Open questions:** applicable seller/product policy type/version, who may create reports, warning severity/strike policy, suspension duration and Seller obligations while suspended, Seller notification channel, restriction appeal/reinstatement, and retention of resolved cases.
