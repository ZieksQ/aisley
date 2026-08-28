---
feature: Manage Account Registrations
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application
---

# Account Approval Specification

## 1. Purpose

This document defines the **AISLEY Admin Account Approval** feature, corresponding to the Admin capability documented as **Manage Account Registrations**.

The feature provides a dedicated workflow for reviewing new account registration requests and deciding whether an applicant is allowed to proceed into the platform.

The specification is grounded in the current AISLEY source documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

The source documents explicitly establish that:

- Buyer / Customer registration requires Admin approval before sign-in.
- Seller registration requires Admin approval before sign-in.
- Logistics registration requires Admin approval before sign-in.
- Courier registration is approved by the selected Logistics organization, not the AISLEY platform Admin.
- Registration approval uses an account-status state machine such as `PENDING`, `APPROVED`, and `REJECTED`.
- Approval/rejection should automatically send the applicant a corresponding email.
- Brevo is the project's email provider.
- All roles share the same user system and identity uniqueness is based on `(email, role)`.

Where the source documents do not define exact application fields, document requirements, rejection categories, SLA rules, reapplication behavior, or notification wording, this specification does not invent them.

---

# 2. Core Value

`Admin.md` defines the feature as:

```text
Manage Account Registrations
Core Value:
Approve/disapprove accounts.
```

Expanded system intent:

```text
incoming registration
        ↓
Admin reviews submitted credentials/application details
        ↓
Admin approves or rejects
        ↓
account state changes
        ↓
corresponding email is sent
        ↓
approved applicant can continue to sign in
```

The feature is therefore both:

1. a review queue for incoming registration requests, and
2. a controlled state-transition workflow for account access.

---

# 3. Goals

The Account Approval feature must:

1. show Admin-managed registration requests
2. allow Admins to review submitted application details
3. clearly identify the applicant's role
4. allow an authorized Admin to approve a pending application
5. allow an authorized Admin to reject a pending application
6. transition the account through the documented registration states
7. prevent pending or rejected accounts from proceeding through the normal role sign-in flow
8. allow approved accounts to continue to sign-in
9. dispatch an appropriate email when an application is approved or rejected
10. preserve the `(email, role)` identity rule
11. keep Courier approval outside this Admin workflow
12. record approval/rejection as an administrative action for system accountability
13. avoid exposing unnecessary sensitive applicant data in registration lists
14. provide filtering/search appropriate for an Admin review queue
15. handle duplicate/concurrent decisions safely

---

# 4. Non-Goals

This feature does not define:

- public Admin registration
- Admin bootstrap account creation
- normal Admin authentication
- post-approval user account management
- seller product compliance
- complaint/dispute resolution
- Courier approval by Logistics
- Logistics subscription payment implementation
- exact registration forms for Buyer, Seller, or Logistics
- exact identity/KYC document requirements
- background checks
- custom Admin permission model
- password-reset behavior
- email-verification behavior
- reapplication after rejection
- account suspension after approval
- user deletion/deactivation
- seller shop verification after account approval unless separately defined
- logistics operational verification beyond submitted registration data

These require separate feature specifications or source requirements.

---

# 5. Actors

## 5.1 Admin

The primary actor.

Admin responsibilities include:

```text
review registration
inspect submitted application information
approve application
reject application
```

Only an authenticated Admin with sufficient authorization may perform approval/rejection actions.

## 5.2 Buyer / Customer Applicant

Documented registration flow:

```text
register
    ↓
Admin approval
    ↓
email
    ↓
sign in
```

## 5.3 Seller Applicant

Documented registration flow:

```text
register
    ↓
Admin approval
    ↓
email
    ↓
sign in
```

Seller accounts are associated with the Seller domain and, according to `app.md`, one seller account corresponds to one shop.

The exact shop/application fields collected during Seller registration are not defined by the current source documents.

## 5.4 Logistics Applicant

Documented registration flow:

```text
register
    ↓
Admin approval
    ↓
email
    ↓
sign in
    ↓
subscription
```

The Logistics subscription occurs **after sign-in** in the documented flow.

Therefore, Admin approval must not be treated as equivalent to active subscription.

Conceptually:

```text
registration approval
    ≠
subscription activation
```

## 5.5 Courier / Rider

Courier is explicitly outside this Admin account-approval workflow.

Documented flow:

```text
search for Logistics hubs
    ↓
register for selected Logistics
    ↓
Logistics Admin approval
    ↓
sign in using Courier mobile application
```

AISLEY platform Admin must not approve Courier registrations through Manage Account Registrations unless the system requirements are later changed.

---

# 6. Role Scope

The Admin registration queue includes:

```text
BUYER / CUSTOMER
SELLER
LOGISTICS
```

The Admin registration queue excludes:

```text
ADMIN
COURIER / RIDER
```

Reasoning from the source documents:

- Admin accounts follow a bootstrap/additional-Admin workflow.
- Courier accounts are registered through and approved by Logistics.

---

# 7. Shared Account Identity Rule

All roles live in the same users system.

The source documents define account uniqueness as:

```text
unique(email, role)
```

Therefore, registration approval must treat each account as a role-scoped identity.

Example:

```text
email                   role         status
------------------------------------------------
user@example.com        BUYER        APPROVED
user@example.com        SELLER       PENDING
user@example.com        LOGISTICS    REJECTED
```

These are three distinct account identities.

Approving:

```text
user@example.com + SELLER
```

must not alter:

```text
user@example.com + BUYER
user@example.com + LOGISTICS
```

All approval queries and mutations must target a unique account identifier and preserve role scope.

---

# 8. Registration State Machine

`Admin.md` explicitly describes a user status state machine such as:

```text
PENDING
APPROVED
REJECTED
```

For this feature, these are the required registration-review states.

---

# 9. State — PENDING

`PENDING` means:

- registration has been submitted
- Admin review has not reached a final approval decision
- applicant must appear in the appropriate pending-registration queue
- applicant must not proceed through the normal sign-in flow
- authorized Admin may approve or reject the application

Conceptually:

```text
REGISTERED
    ↓
PENDING
```

---

# 10. State — APPROVED

`APPROVED` means:

- Admin accepted the registration
- account is no longer in the pending review queue
- applicant is notified
- applicant may proceed to the sign-in stage defined for the role

Role-specific continuation:

```text
Buyer:
APPROVED → email → sign in

Seller:
APPROVED → email → sign in

Logistics:
APPROVED → email → sign in → subscription
```

Approval must not automatically create unrelated post-registration business state beyond what the role workflow requires.

---

# 11. State — REJECTED

`REJECTED` means:

- Admin declined the registration
- account is no longer awaiting normal approval
- applicant is notified
- applicant must not proceed through the normal approved-account sign-in flow

The source documents do not define:

- whether a rejected application may be edited and resubmitted
- whether the same `(email, role)` can submit a fresh application
- whether rejection is permanent
- whether a rejection reason is mandatory

These must remain open decisions.

---

# 12. Allowed State Transitions

Minimum source-backed transitions:

```text
PENDING ──────→ APPROVED
    │
    └─────────→ REJECTED
```

For this feature specification, final-state transitions such as:

```text
APPROVED → REJECTED
REJECTED → APPROVED
```

must not be assumed to be part of registration approval.

Post-approval account intervention belongs to **Manage User Accounts**, which handles account status changes such as suspension or restoration.

If the project later requires reversing registration decisions, that behavior must be explicitly specified.

---

# 13. Registration Creation Requirements

When an Admin-managed role successfully submits registration:

```text
role in [BUYER, SELLER, LOGISTICS]
```

the account/application should enter:

```text
PENDING
```

unless the repository already represents registration applications separately from the final users table.

The exact persistence architecture is implementation-dependent.

Acceptable patterns include:

```text
users.registration_status
```

or:

```text
registration_applications.status
```

or another repository-established design.

The feature specification requires the state semantics, not a particular table name.

---

# 14. Access Before Approval

The documented authentication flow places Admin approval before sign-in.

Therefore:

```text
PENDING account
    → cannot complete normal role sign-in

REJECTED account
    → cannot complete normal role sign-in

APPROVED account
    → may proceed to role sign-in
```

This rule must be enforced by the backend authentication process.

Hiding frontend routes is not sufficient.

---

# 15. Admin Route

Recommended Admin route:

```text
/registrations
```

Possible alternatives:

```text
/account-registrations
/accounts/registrations
/users/registrations
```

Exact route naming should follow the project's existing Admin route conventions.

The page should be reachable from the Admin navigation item:

```text
Manage Account Registrations
```

---

# 16. Registration List Page

The page should serve as an operational review queue.

Recommended structure:

```text
Manage Account Registrations

[Pending] [Approved] [Rejected]

Search __________________

Role: [All ▼]

------------------------------------------------------------
Applicant          Role        Submitted       Status
------------------------------------------------------------
...
```

The exact layout is a UI implementation decision.

---

# 17. Default View

Because the feature exists primarily to review incoming applications, the default view should prioritize:

```text
PENDING
```

The Admin should be able to reach applications requiring action without first changing filters.

Approved and rejected records may remain accessible for review/history.

---

# 18. List Data

Each registration row should expose enough information to identify the application without unnecessarily exposing sensitive PII.

Recommended minimum:

```text
application/account identifier
applicant display name or registered name
email
role
registration/submission time
registration status
reviewed time, when applicable
```

If the actual registration schema uses business/entity names for Seller or Logistics, those may be displayed where useful.

Do not invent fields that registration does not collect.

---

# 19. Search

`Admin.md` states that Admin user-management functionality requires robust search/filtering endpoints.

For account-registration review, search is also useful and should use fields actually available in the registration schema.

Recommended baseline search:

```text
email
name / registered name
```

If Seller/Logistics registrations contain business names, those may be searchable.

Search must not require loading the entire queue into the browser.

---

# 20. Filters

Minimum useful filters:

```text
Status
Role
```

Status:

```text
PENDING
APPROVED
REJECTED
```

Role:

```text
BUYER
SELLER
LOGISTICS
```

Optional filter:

```text
submission date
```

only if it aligns with project UI conventions.

Do not invent risk, KYC, or verification filters that the registration domain does not define.

---

# 21. Sorting

Recommended default sort for the pending queue:

```text
oldest submitted first
```

This helps Admins process applications in submission order.

Alternatively, if the project already standardizes newest-first review queues, use that convention.

No SLA or priority ordering is defined by the source documents.

Do not create hidden urgency rules.

---

# 22. Pagination

The registration list should be paginated or cursor-based.

Do not load an unbounded number of registrations into the Admin frontend.

Pagination parameters should follow the existing API convention.

Conceptual request:

```http
GET /api/admin/registrations?status=PENDING&role=SELLER&page=1
```

Exact route/query naming is not mandated.

---

# 23. Registration Detail View

Selecting an application should open a complete review view.

Recommended route:

```text
/registrations/{id}
```

The detail view must use the applicant's actual submitted registration data.

It should provide:

1. identity/context
2. account role
3. submitted application information
4. submitted credentials/application details required for review
5. current review state
6. submission timestamp
7. decision metadata if already reviewed
8. approval/rejection controls when the application is pending

---

# 24. Role-Specific Application Details

The source docs state that Admins evaluate:

```text
submitted credentials or application details
```

They do not define the exact registration schemas for Buyer, Seller, or Logistics.

Therefore, the detail page should be schema-driven or role-aware.

Conceptually:

```text
common account details
+
role-specific registration details
```

Example structure:

```text
Applicant
Role
Email
Submitted At

Application Details
[fields actually submitted by this role]

Review Status
PENDING
```

No fake KYC/document fields should be added merely because the role is Seller or Logistics.

---

# 25. Sensitive Data Handling

Registration review may involve applicant metadata.

The Admin interface must:

- expose only data required for administrative review
- avoid returning password hashes
- avoid returning session/authentication secrets
- avoid exposing unrestricted sensitive PII unnecessarily
- use authenticated Admin-only endpoints
- apply permission checks
- protect any uploaded evidence/documents if future registration schemas include them

`Admin.md` explicitly requires user metadata to be exposed securely without compromising restricted PII.

---

# 26. Approval Action

A pending registration should expose:

```text
Approve
```

Approval is a state-changing Admin operation.

Recommended interaction:

```text
Admin opens pending application
        ↓
reviews submitted information
        ↓
selects Approve
        ↓
confirmation
        ↓
backend validates current state + permission
        ↓
PENDING → APPROVED
        ↓
audit entry recorded
        ↓
approval email dispatched
        ↓
UI reflects APPROVED
```

---

# 27. Approval Confirmation

Approval grants the account access to proceed toward sign-in.

Because this is a consequential action, the UI should require a deliberate confirmation.

Example confirmation meaning:

```text
Approve this registration?

The applicant will be granted an approved account
and notified by email.
```

Exact copy is a UI decision.

The confirmation must display enough identifying context to reduce accidental approval of the wrong application.

---

# 28. Approval Backend Rules

The backend must verify:

```text
requesting user is authenticated Admin
requesting Admin has required permission
target application exists
target role is Admin-managed
current registration state is PENDING
```

Then perform an atomic transition:

```text
PENDING → APPROVED
```

The frontend must not be the authority for valid state transitions.

---

# 29. Rejection Action

A pending registration should expose:

```text
Reject
```

Recommended interaction:

```text
Admin opens pending application
        ↓
reviews submitted information
        ↓
selects Reject
        ↓
confirmation / rejection input if supported
        ↓
backend validates current state + permission
        ↓
PENDING → REJECTED
        ↓
audit entry recorded
        ↓
rejection email dispatched
        ↓
UI reflects REJECTED
```

---

# 30. Rejection Reason

The current source documents do not state whether Admin must provide a reason for rejection.

Therefore:

```text
mandatory rejection reason
```

must not be treated as a source requirement.

Recommended implementation if the project wants explanation/accountability:

```text
optional internal note
optional applicant-facing reason
```

but these require a product decision.

If implemented, distinguish:

```text
internal Admin note
```

from:

```text
message shown/sent to applicant
```

to avoid accidental disclosure of internal comments.

---

# 31. Email Notification

`Admin.md` explicitly requires state changes to dispatch corresponding notification emails.

`app.md` identifies Brevo as the email provider.

The workflow is:

```text
Admin decision
    ↓
registration state successfully committed
    ↓
notification email queued/dispatched
```

Supported decision types:

```text
APPROVED
REJECTED
```

---

# 32. Approval Email

The approval email should communicate at minimum:

```text
registration was approved
account role/context
next step: sign in
```

For Logistics, the documented next step after sign-in is:

```text
subscription
```

The approval email should not claim that Logistics subscription is already active merely because registration was approved.

---

# 33. Rejection Email

The rejection email should communicate at minimum:

```text
registration was not approved
```

If the product later defines:

- rejection reason
- appeal instructions
- reapplication instructions
- support contact

those may be included.

They are not defined by the current source documents.

---

# 34. Email Delivery Failure

Account state must not become ambiguous because an email provider fails.

Recommended transactional boundary:

```text
database decision succeeds
        ↓
notification event/job created
        ↓
email delivery attempted asynchronously
```

If email delivery fails:

```text
registration remains APPROVED or REJECTED
```

rather than rolling the decision back solely because Brevo was temporarily unavailable.

The system should support retrying failed notification delivery through the project's queue/job conventions.

The source specifies that emails should be dispatched but does not define retry policy.

---

# 35. Decision Metadata

For accountability, each reviewed registration should preserve:

```text
decision status
reviewed_at
reviewed_by
```

This aligns with the system's Admin audit-log requirement.

If rejection/approval notes are implemented, those should be stored according to their visibility rules.

Do not overwrite original submission data as part of approval.

---

# 36. System Audit Log

`Admin.md` requires an immutable, time-stamped ledger of administrative operations recording:

```text
who performed the action
what data was altered
when it occurred
```

Account approval/rejection is an administrative operation and should participate in this mechanism.

Recommended audit events:

```text
ACCOUNT_REGISTRATION_APPROVED
ACCOUNT_REGISTRATION_REJECTED
```

Exact event naming should follow existing conventions.

Audit data should capture at least:

```text
Admin actor
target application/account
target role
previous status
new status
timestamp
```

Do not store applicant passwords or other sensitive authentication material in audit payloads.

---

# 37. Concurrency

Two Admins may open the same pending registration.

The backend must prevent conflicting final decisions.

Example:

```text
Admin A opens PENDING
Admin B opens PENDING

Admin A approves
PENDING → APPROVED

Admin B then attempts reject
    ↓
backend sees current status != PENDING
    ↓
reject mutation
    ↓
return conflict/current state
```

The second Admin should be told that the application was already reviewed.

Do not blindly overwrite the existing decision.

---

# 38. Idempotency

Repeated submission of the same decision due to:

- double-click
- retry
- network timeout

must not create duplicate side effects such as multiple state transitions or multiple notification jobs where preventable.

The backend should make state mutation conditional on:

```text
current status = PENDING
```

and use appropriate transaction/concurrency controls.

---

# 39. Bulk Approval

The source documents do not define bulk approval or bulk rejection.

For MVP:

```text
do not require bulk approval/rejection
```

Individual review is safer because Admin is explicitly expected to evaluate submitted credentials/application details.

Bulk operations should require a separate product decision.

---

# 40. Buyer Approval Flow

Source-derived flow:

```text
Buyer registers
    ↓
BUYER registration = PENDING
    ↓
Admin reviews
    ├── APPROVE
    │       ↓
    │   approval email
    │       ↓
    │   Buyer may sign in
    │
    └── REJECT
            ↓
        rejection email
            ↓
        Buyer may not continue through approved sign-in flow
```

Buyer-specific marketplace functionality remains outside this feature.

---

# 41. Seller Approval Flow

Source-derived flow:

```text
Seller registers
    ↓
SELLER registration = PENDING
    ↓
Admin reviews
    ├── APPROVE
    │       ↓
    │   approval email
    │       ↓
    │   Seller may sign in
    │
    └── REJECT
            ↓
        rejection email
            ↓
        Seller may not continue through approved sign-in flow
```

`app.md` defines:

```text
one Seller account : one Shop
```

However, the source does not specify whether the Shop is created:

- during registration
- on approval
- on first sign-in

The Account Approval implementation must not invent that lifecycle.

---

# 42. Logistics Approval Flow

Source-derived flow:

```text
Logistics registers
    ↓
LOGISTICS registration = PENDING
    ↓
Admin reviews
    ├── APPROVE
    │       ↓
    │   approval email
    │       ↓
    │   Logistics may sign in
    │       ↓
    │   subscription
    │
    └── REJECT
            ↓
        rejection email
            ↓
        Logistics may not continue through approved sign-in flow
```

Important boundary:

```text
APPROVED
    ≠
SUBSCRIBED
```

Approval grants the Logistics account permission to proceed to sign-in.

Subscription remains a separate next-stage requirement.

---

# 43. Courier Exclusion Flow

Courier lifecycle:

```text
Courier searches Logistics hubs
    ↓
Courier selects/registers for Logistics
    ↓
Logistics reviews Courier
    ↓
Logistics approves
    ↓
Courier signs in
```

Therefore:

```text
Courier registrations
    ✗ not shown in Admin Manage Account Registrations
    ✗ not approved by platform Admin
```

Courier approval requires a separate Logistics-side specification.

---

# 44. Dashboard Integration

The Admin Dashboard specification includes a:

```text
Pending Registrations
```

KPI/action.

The Dashboard should source this count from the same underlying account-registration state used by this feature.

Conceptually:

```text
Dashboard pending count
    ↓
click
    ↓
Manage Account Registrations
    ↓
filtered to PENDING
```

Dashboard and registration-list counts must reconcile for the same role scope.

Courier registrations must remain excluded from the Admin pending-registration count.

---

# 45. Recommended API — List Registrations

Conceptual:

```http
GET /api/admin/registrations
```

Query parameters may include:

```text
status
role
search
page
per_page
sort
```

Example:

```http
GET /api/admin/registrations?status=PENDING&role=SELLER&page=1
```

Response should return:

```text
paginated registration summaries
filter/pagination metadata
```

Exact routes and response conventions should follow the repository.

---

# 46. Recommended API — Registration Detail

Conceptual:

```http
GET /api/admin/registrations/{id}
```

Requirements:

- authenticated Admin only
- permission-aware
- returns submitted application details needed for review
- returns role
- returns current registration status
- returns submission timestamp
- returns review metadata if already reviewed
- excludes sensitive authentication material

---

# 47. Recommended API — Approve

Conceptual:

```http
POST /api/admin/registrations/{id}/approve
```

Backend:

```text
authorize Admin
validate target role
lock/read current application state
require PENDING
transition to APPROVED
record reviewer/timestamp
record audit event
dispatch approval notification
return updated representation
```

Exact HTTP method may follow the project's established command/action pattern.

---

# 48. Recommended API — Reject

Conceptual:

```http
POST /api/admin/registrations/{id}/reject
```

Backend:

```text
authorize Admin
validate target role
lock/read current application state
require PENDING
transition to REJECTED
record reviewer/timestamp
record audit event
dispatch rejection notification
return updated representation
```

If the product later requires a rejection reason:

```json
{
  "reason": "..."
}
```

can be added through a separately defined requirement.

---

# 49. Recommended Registration Summary DTO

Conceptual only:

```json
{
  "id": "registration-id",
  "name": "Applicant Name",
  "email": "applicant@example.com",
  "role": "SELLER",
  "status": "PENDING",
  "submitted_at": "timestamp"
}
```

Do not force this exact shape if the existing models use different naming.

---

# 50. Recommended Registration Detail DTO

Conceptual only:

```json
{
  "id": "registration-id",
  "user": {
    "id": "user-id",
    "name": "Applicant Name",
    "email": "applicant@example.com",
    "role": "SELLER"
  },
  "status": "PENDING",
  "submitted_at": "timestamp",
  "application": {
    "...": "role-specific submitted fields"
  },
  "review": null
}
```

Reviewed example:

```json
{
  "status": "APPROVED",
  "review": {
    "reviewed_at": "timestamp",
    "reviewed_by": {
      "id": "admin-id",
      "name": "Admin Name"
    }
  }
}
```

Do not expose full Admin security/account data in reviewer metadata.

---

# 51. Frontend Page States

The registration list must handle:

```text
loading
loaded with results
loaded with zero results
error
unauthenticated
forbidden
```

The registration detail must handle:

```text
loading
pending
approved
rejected
not found
already changed by another Admin
error
```

---

# 52. Empty States

Examples:

### No Pending Applications

```text
No pending registrations.
```

### Role Filter Has No Results

```text
No pending Seller registrations.
```

### Search Has No Results

```text
No registrations match your search.
```

Empty state must not be presented as an API failure.

---

# 53. Loading State

While loading:

- render the Admin shell
- render table/detail skeletons
- disable approval/rejection until current data is known
- do not render fake applicant data

---

# 54. Error State

Handle:

- failed list request
- failed detail request
- failed approval mutation
- failed rejection mutation
- stale state/conflict
- expired session
- forbidden permission
- applicant not found

The UI must not optimistically claim approval/rejection if the server mutation failed.

---

# 55. Success Feedback

After approval:

```text
Registration approved.
```

After rejection:

```text
Registration rejected.
```

Feedback can use the project's established toast/notification system.

The UI should immediately update or invalidate/refetch:

```text
registration detail
pending list
Dashboard pending count
```

as appropriate.

---

# 56. Admin Permissions

The system is intended to support additional Admins with custom permissions.

Therefore, this feature must be authorization-ready.

Conceptually separate:

```text
view registrations
review registration details
approve registration
reject registration
```

The exact permission keys are not defined by the current documents.

Do not invent a parallel permission system solely for this feature.

Use the project's shared Admin authorization model.

---

# 57. Backend Security Requirements

All account-approval endpoints must:

- require an authenticated Admin session
- require appropriate Admin authorization
- validate target role
- validate current registration status
- validate route/resource identifiers
- prevent mass assignment of protected fields
- preserve role-scoped identity
- avoid returning password hashes
- avoid returning raw session/token data
- protect sensitive applicant information
- use CSRF protections for state-changing web requests
- write audit records for Admin decisions
- prevent Courier applications from being approved through this workflow

---

# 58. Frontend Security Requirements

The Admin frontend must:

- never decide approval authorization solely from local state
- never directly modify registration status without backend validation
- never expose applicant passwords
- never store sensitive application payloads unnecessarily in persistent browser storage
- correctly handle `401`, `403`, `404`, and conflict responses
- prevent duplicate action submissions while a mutation is in flight
- avoid exposing hidden restricted fields in HTML/client payloads when the Admin lacks permission

---

# 59. Database Considerations

The exact database design is not specified.

Whatever model is used should support:

```text
role-scoped applicant identity
registration status
submitted timestamp
reviewed timestamp
reviewing Admin
```

If applications are stored directly on `users`, the implementation must preserve:

```text
unique(email, role)
```

If applications are stored separately, the eventual user/account linkage must still preserve the same identity constraint.

---

# 60. Transaction Requirements

Approval/rejection should be handled transactionally where practical.

Conceptually:

```text
begin transaction

verify PENDING
update registration status
set reviewed_by
set reviewed_at
persist decision

commit

dispatch/queue email
write or enqueue audit information according to project architecture
```

If audit logging is implemented asynchronously as documented by `Admin.md`, it must not cause the primary approval request to fail solely because the audit transport is temporarily unavailable, while still preserving the required audit behavior through a reliable mechanism.

Exact transaction/outbox/job architecture depends on the repository.

---

# 61. Query Performance

The queue should support:

- status filtering
- role filtering
- search
- pagination
- sorting

Database indexes should align with frequent filters such as:

```text
status
role
submitted/created timestamp
```

and the existing `(email, role)` uniqueness constraint.

Do not load complete application documents just to render the queue when summaries are sufficient.

---

# 62. Accessibility

The Admin review interface should:

- use semantic table/list structure
- make status understandable without color alone
- label approve/reject buttons clearly
- provide accessible confirmation dialogs
- keep keyboard focus predictable after decisions
- announce success/failure feedback
- maintain appropriate contrast
- make role/status filters keyboard-accessible

---

# 63. Responsive Behavior

The feature is part of the Admin web application.

Desktop is the primary operational experience.

On smaller viewports:

- table may become stacked rows/cards
- important identity/status fields remain visible
- action controls remain accessible
- long application data wraps safely
- no horizontal overflow should block review

Do not simplify the mobile view so far that the Admin cannot confidently identify the application being approved/rejected.

---

# 64. MVP Scope

## Required for MVP

- authenticated Admin-only registration queue
- pending/approved/rejected states
- Buyer registration review
- Seller registration review
- Logistics registration review
- Courier exclusion
- role filter
- status filter
- basic search
- paginated list
- application detail view
- approve action
- reject action
- confirmation before final decision
- email dispatch on approval/rejection
- approved-account sign-in gating
- rejected/pending-account sign-in gating
- decision metadata
- audit-log integration
- loading/empty/error states
- concurrency protection
- Dashboard pending-count integration

## Not Required for MVP

- bulk approve/reject
- applicant risk scoring
- automatic approval
- AI-assisted approval
- mandatory rejection categories
- appeal workflow
- resubmission workflow
- KYC vendor integration
- identity document OCR
- Admin-defined approval rules
- registration SLA dashboard
- approval analytics
- Courier approval

---

# 65. Acceptance Criteria

## AC-01 — Buyer Starts Pending

Given a Buyer successfully submits registration, the registration enters the Admin-managed pending approval flow before sign-in.

## AC-02 — Seller Starts Pending

Given a Seller successfully submits registration, the registration enters the Admin-managed pending approval flow before sign-in.

## AC-03 — Logistics Starts Pending

Given a Logistics company successfully submits registration, the registration enters the Admin-managed pending approval flow before sign-in.

## AC-04 — Courier Excluded

Given a Courier registers through a Logistics organization, the registration does not appear as a platform Admin approval item.

## AC-05 — Pending Queue

Given pending Buyer, Seller, or Logistics registrations exist, an authorized Admin can view them in Manage Account Registrations.

## AC-06 — Role Visibility

Given a registration is displayed, the Admin can clearly identify whether it belongs to Buyer, Seller, or Logistics.

## AC-07 — Registration Detail

Given a pending registration exists, the Admin can open it and review the submitted application details required by that role's registration schema.

## AC-08 — Approve Pending Account

Given an authorized Admin reviews a `PENDING` registration, when the Admin approves it, the backend transitions it to `APPROVED`.

## AC-09 — Reject Pending Account

Given an authorized Admin reviews a `PENDING` registration, when the Admin rejects it, the backend transitions it to `REJECTED`.

## AC-10 — Approved Login Access

Given a Buyer, Seller, or Logistics account is `APPROVED`, the account may proceed to the normal sign-in stage for its domain.

## AC-11 — Pending Login Denied

Given an account is `PENDING`, normal authenticated access for that role is not granted.

## AC-12 — Rejected Login Denied

Given an account is `REJECTED`, normal authenticated access for that role is not granted.

## AC-13 — Approval Email

Given a registration successfully transitions to `APPROVED`, a corresponding applicant email is dispatched through the application's email infrastructure.

## AC-14 — Rejection Email

Given a registration successfully transitions to `REJECTED`, a corresponding applicant email is dispatched through the application's email infrastructure.

## AC-15 — Logistics Subscription Boundary

Given a Logistics registration is approved, approval does not falsely mark the Logistics subscription as active; the documented next stage remains sign-in followed by subscription.

## AC-16 — Role-Scoped Identity

Given the same email exists under multiple roles, approving one `(email, role)` registration does not alter another role's account.

## AC-17 — No Arbitrary Email Matching

Given an Admin acts on a registration, the backend targets the specific registration/account identifier and role rather than updating whichever user shares the email.

## AC-18 — Reviewed Metadata

Given an application is approved or rejected, the system records the decision state, reviewing Admin, and review time.

## AC-19 — Audit Record

Given an Admin approves or rejects an account, the administrative action is recorded through the system audit mechanism.

## AC-20 — Concurrent Decision Protection

Given two Admins load the same `PENDING` application and one completes a decision first, the second cannot overwrite the finalized decision as though it were still pending.

## AC-21 — List Pagination

Given many registrations exist, the Admin registration queue returns bounded paginated/cursor-based results instead of loading all registrations at once.

## AC-22 — Filter by Role

Given registrations from multiple Admin-managed roles exist, the Admin can filter the queue by Buyer, Seller, or Logistics.

## AC-23 — Filter by Status

Given registrations have different states, the Admin can filter by `PENDING`, `APPROVED`, or `REJECTED`.

## AC-24 — Search

Given a registration exists with an available searchable identity field, the Admin can locate it using the feature's supported search fields.

## AC-25 — Dashboard Consistency

Given the Admin Dashboard displays a pending-registration count, its role scope and pending state reconcile with Manage Account Registrations.

## AC-26 — Email Failure Does Not Corrupt Decision

Given the registration decision commits successfully but email delivery temporarily fails, the account remains in its committed approval/rejection state and the notification can follow the project's retry mechanism.

## AC-27 — Unauthorized Admin Operation

Given an authenticated user is not authorized to manage registrations, registration details and approval/rejection operations are denied by the backend.

## AC-28 — Sensitive Field Protection

Given the Admin loads a registration, the API does not expose password hashes, session identifiers, or unrelated authentication secrets.

---

# 66. Suggested Backend Tests

Test:

- Buyer registration enters `PENDING`
- Seller registration enters `PENDING`
- Logistics registration enters `PENDING`
- Courier registration is not included in Admin-managed registration queue
- guest cannot list Admin registrations
- non-Admin cannot list Admin registrations
- unauthorized Admin cannot perform decisions if permission model restricts it
- Admin can filter by `PENDING`
- Admin can filter by role
- list endpoint is paginated
- Admin can view registration detail
- pending Buyer can be approved
- pending Seller can be approved
- pending Logistics can be approved
- pending account can be rejected
- approval stores reviewer and timestamp
- rejection stores reviewer and timestamp
- approval creates/schedules approval email
- rejection creates/schedules rejection email
- pending account cannot sign in normally
- rejected account cannot sign in normally
- approved account can proceed through normal sign-in
- approved Logistics account still requires the separate subscription stage
- decision against non-pending application is rejected/conflicted
- simultaneous decisions cannot overwrite each other
- approval of one role does not update same-email account in another role
- `(email, role)` uniqueness remains intact
- registration endpoints never expose password hashes
- audit record is created for approval
- audit record is created for rejection

---

# 67. Suggested Frontend Tests

Where frontend testing infrastructure exists, test:

- registration queue loads
- pending is default/prioritized view
- role filter works
- status filter works
- search sends correct query
- pagination works
- detail page renders role and submitted application data
- approve control appears only for actionable pending application
- reject control appears only for actionable pending application
- approve confirmation is shown
- reject confirmation is shown
- successful approve updates visible status
- successful reject updates visible status
- mutation buttons disable while request is in flight
- server failure does not show false success
- already-reviewed conflict refreshes current state
- empty-state copy renders
- forbidden state does not expose protected data
- Courier does not appear as an Admin registration role option

---

# 68. Open Decisions

The current source documents do not define:

1. exact Buyer registration fields
2. exact Seller registration fields
3. exact Logistics registration fields
4. whether any registration requires uploaded documents
5. exact required credentials for approval
6. whether a rejection reason is mandatory
7. allowed rejection reason categories
8. whether rejected applicants may reapply
9. whether rejected applications may be edited/resubmitted
10. whether Admin can reverse an approval/rejection decision
11. whether applicants can cancel pending registration
12. whether applications expire
13. whether approval has an SLA
14. whether registration review has priority/severity
15. whether approval can be automated
16. whether duplicate business entities across accounts need validation
17. whether Seller shop creation occurs before or after approval
18. exact Logistics verification requirements
19. exact email templates
20. exact Brevo retry/failure policy
21. exact Admin permission keys
22. exact API route names
23. whether approved/rejected records are archived
24. how long registration application data is retained
25. whether Admin notes are required
26. whether an applicant-facing rejection explanation is required
27. whether notification emails include support/appeal links

These must be specified separately before being treated as business requirements.

---

# 69. Source Traceability

## From `app.md`

This feature derives:

```text
Admin approves Customer/Buyer registrations
Admin approves Seller registrations
Admin approves Logistics registrations

Customer & Seller:
register → Admin approval → email → sign in

Logistics:
register → Admin approval → email → sign in → subscription

Courier:
search Logistics hubs → register for Logistics
→ Logistics Admin approval → sign in

all roles share users table
unique(email, role)

Brevo sends emails
```

## From `Admin.md`

This feature derives:

```text
Manage Account Registrations

approve/disapprove accounts
review submitted credentials/application details
grant access through approval
reject applications that fail platform criteria
PENDING / APPROVED / REJECTED state machine
state transitions dispatch corresponding notification emails
```

It also derives security/accountability context from:

```text
Manage User Accounts
System Audit Logs
```

## From `Buyer.md`

Buyer is a distinct user/account domain with authenticated account-management functionality after access is granted.

No more specific Buyer registration approval fields are defined.

## From `Seller.md`

Seller is a distinct user/account domain with seller account-management and operational capabilities after access is granted.

No exact Seller registration credentials/documents are defined.

## From `Logistics.md`

Logistics is a distinct operational account/domain with its own account management after access is granted.

No exact Logistics registration credentials/documents are defined.

## From `Courier.md`

Courier is an operational role associated with Logistics.

Together with `app.md`, this reinforces that Courier approval belongs to the Logistics workflow, not platform Admin account approvals.

---

# 70. Final Feature Definition

AISLEY Manage Account Registrations is:

```text
an Admin-only review workflow

for:

    Buyer
    Seller
    Logistics

that takes:

    newly submitted registration
        ↓
    PENDING
        ↓
    Admin review
       ├── APPROVED
       │      ↓
       │   email
       │      ↓
       │   role may proceed to sign-in
       │
       └── REJECTED
              ↓
           email
              ↓
           sign-in access not granted

while:

    preserving unique(email, role)
    protecting sensitive applicant data
    recording Admin decisions
    preventing conflicting decisions
    and excluding Courier approvals,
    which belong to Logistics.
```
