---
feature: Manage Account Registrations
system: AISLEY
type: Feature Specification
version: 2.1
status: Draft
scope: Admin Web Application
source_coverage: Admin.md, app.md, current AISLEY Admin feature specifications
---

# Manage Account Registrations Specification

## 1. Purpose

Manage Account Registrations is the Admin feature used to review and decide registration requests for AISLEY roles whose access requires Admin approval.
`Admin.md` defines:

```text
Core Value:
Approve / disapprove account registrations.

Expanded Definition:
A centralized approval module
where administrators verify and decide
whether a newly registered account
may access the system.

System Context:
Registration status:
PENDING
APPROVED
REJECTED

After approval or rejection,
the user receives an email notification.
```

This specification defines the requirements, boundaries, APIs, security rules, acceptance criteria, and Open Decisions.
The state-transition sequence is kept in `flow.md`.

## 2. Source Roles

From `app.md`:

```text
Customer / Buyer
register
→ Admin approval
→ email
→ sign in

Seller
register
→ Admin approval
→ email
→ sign in

Logistics
register
→ Admin approval
→ email
→ sign in
→ subscription

Courier
search Logistics hubs
→ register for chosen Logistics
→ Logistics Admin approval
→ mobile sign in
```

Therefore Admin-owned registration approval applies to:

```text
BUYER
SELLER
LOGISTICS
```

Courier approval is not owned by Admin.

## 3. Primary Actor

The primary actor is:

```text
ADMIN
```

Only an authenticated and authorized Admin may review and decide Admin-owned registration requests.

## 4. Core Responsibility

This feature owns:

- listing pending Buyer registrations
- listing pending Seller registrations
- listing pending Logistics registrations
- viewing safe registration details
- approving a PENDING registration
- rejecting a PENDING registration
- preserving decision metadata
- sending decision email
- Audit Log integration
- search/filter/pagination
  It does not own:
- Courier registration approval
- ongoing user suspension/restoration
- Seller Compliance
- Logistics subscription payment
- Admin account creation
- Global Ban
- user profile lifecycle after approval
- KYC rules that are not defined in source
- automatic approval scoring

## 5. Registration States

Source-backed states:

```text
PENDING
APPROVED
REJECTED
```

These are the authoritative registration decision states.
Do not invent extra required states such as:

```text
UNDER_REVIEW
KYC_PENDING
WAITLISTED
ESCALATED
```

without new requirements.

## 6. State Transition Rule

Valid Admin decision transitions:

```text
PENDING → APPROVED
PENDING → REJECTED
```

The source does not define:

```text
REJECTED → APPROVED
APPROVED → REJECTED
```

as normal Account Registration transitions.
Those belong to later lifecycle management or a separate reconsideration policy.

## 7. Pending Access Rule

Before approval:

```text
registration status = PENDING
```

The account must not receive normal role access.
The exact login error/message is owned by the authentication flow.

## 8. Approved Access Rule

After:

```text
PENDING → APPROVED
```

the role-account becomes eligible for normal sign-in subject to any additional role-specific requirements.
For Logistics:

```text
APPROVED
≠
SUBSCRIBED
```

Approval allows the Logistics account to proceed to the later subscription step.

## 9. Rejected Access Rule

After:

```text
PENDING → REJECTED
```

the account is not eligible for normal role access.
The source does not define whether a rejected user may edit/resubmit the registration.
That is an Open Decision.

## 10. Role-Aware Identity

AISLEY uses:

```text
unique(email, role)
```

Therefore:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

are different accounts.
An Admin decision applies to the exact role-account selected.
Approval of one role must not approve another same-email role-account.

## 11. Exact Target

A decision should target:

```text
user/account ID
```

with role context.
Do not identify the registration by email alone.

## 12. Buyer Registration

Buyer registration is Admin-approved.
A pending Buyer may:

- exist as a registered account record
- remain unable to sign in normally
- become eligible after approval
  Exact pre-approval browsing behavior is separate because guests can browse the storefront without sign-in.

## 13. Seller Registration

Seller registration is Admin-approved.
A pending Seller must not gain normal Seller application access before approval.
Approval does not imply Seller Compliance clearance for future products/actions.

## 14. Logistics Registration

Logistics registration is Admin-approved.
Important sequence:

```text
register
→ Admin approval
→ email
→ sign in
→ subscription
```

Therefore:

```text
APPROVED Logistics
≠
subscription active
```

The Account Registration feature must not mark Logistics subscription paid/active.

## 15. Courier Exclusion

Courier registration is approved by Logistics, not Admin.
Therefore Courier requests must not appear in the Admin Account Registration queue.

## 16. Registration List

Recommended Admin columns:

```text
Applicant
Role
Email
Status
Submitted At
```

Optional safe fields may be shown if present in the registration schema.
Do not expose unnecessary PII in the table.

## 17. Filters

Recommended:

```text
status
role
date
```

Default Admin workload view:

```text
status = PENDING
```

## 18. Search

Recommended:

```text
name
email
registration/user ID
```

If searching by email, show role clearly.

## 19. Pagination

The registration list must be paginated/bounded.
Do not load all registrations into the browser.

## 20. Registration Detail

The Admin should be able to inspect the registration data required to make the decision.
The exact fields depend on the real Buyer/Seller/Logistics registration schemas.
Do not invent mandatory verification fields not present in source/schema.

## 21. KYC Boundary

The current source says:

```text
verify and decide
```

but does not define a formal KYC/document-verification process.
Therefore this feature must not assume:

- government ID verification
- facial recognition
- business permits
- tax certificates
- address proof
- background checks
  unless those requirements are separately added.

## 22. Approve Action

Approve is valid only when:

```text
current status = PENDING
```

Backend responsibilities:

- authenticate Admin
- authorize action
- resolve exact role-account
- verify current status
- change status to `APPROVED`
- record decision metadata
- commit
- emit Audit event
- trigger approval email

## 23. Reject Action

Reject is valid only when:

```text
current status = PENDING
```

Backend responsibilities:

- authenticate Admin
- authorize action
- resolve exact role-account
- verify current status
- change status to `REJECTED`
- record decision metadata
- commit
- emit Audit event
- trigger rejection email

## 24. Rejection Reason

The source does not say whether a rejection reason is required.
Recommended:

```text
optional or required according to policy
```

This remains Open.
If stored, distinguish:

- internal Admin reason
- user-visible rejection explanation
  if product policy later requires both.

## 25. Confirmation

Approve and Reject are consequential state changes.
Recommended:

```text
explicit confirmation
```

The confirmation should show:

- applicant
- role
- current status
- intended decision

## 26. Decision Metadata

Recommended fields:

```text
reviewed_by_admin_id
reviewed_at
```

Optional:

```text
rejection_reason
```

Exact schema is implementation-specific.

## 27. Concurrency

Two Admins may open the same PENDING registration.
The backend must prevent conflicting decisions.
Recommended:

```text
atomic update where status = PENDING
```

or equivalent optimistic locking.
Only one decision should win.

## 28. Idempotency

Repeated submission of the same already-committed decision should not cause duplicate business effects.
Example:

```text
PENDING → APPROVED
```

commits once.
A second stale approval request must not resend/reapply the transition blindly.

## 29. Email Notification Requirement

`Admin.md` explicitly requires the applicant to receive an email after approval or rejection.

`app.md` specifies:

```text
Brevo
```

as AISLEY's email delivery service.

Therefore Manage Account Registrations uses the existing shared Brevo email integration for decision emails.

## 30. Third-Party Boundary

Brevo is involved only in:

```text
email transport
```

AISLEY remains authoritative for:

```text
registration state
Admin decision
role-aware account identity
decision metadata
access eligibility
Audit Log
email content selection
```

Brevo must not decide whether an account is approved or rejected.

Conceptually:

```text
Admin decides in AISLEY
→ AISLEY commits APPROVED / REJECTED
→ AISLEY asks Brevo to deliver the corresponding email
```

## 31. No Additional Provider Requirement

This feature does not require:

```text
Firebase
Twilio
AWS SNS
mobile Push provider
SMS gateway
```

Only the already-selected Brevo email service is required by the current project sources.

## 32. Email Timing

Required architecture:

```text
commit decision first
→ trigger/queue email delivery after commit
```

Do not keep the registration decision transaction open while waiting for Brevo.

## 33. Email Queueing

Background queueing is recommended so email-provider latency does not block the Admin decision request.

The queue technology itself is not a third-party requirement.

AISLEY may use its existing Laravel/backend queue mechanism.

## 34. Email Failure

If the database decision succeeds but Brevo delivery fails:

```text
registration decision remains committed
```

Recommended:

- retry the email
- log the delivery failure
- expose safe operational status where useful

Never:

```text
Brevo failure
→ roll back APPROVED / REJECTED
```

## 35. Approval Email

Approval email should communicate:

```text
registration approved
role/account context
next safe action
```

For Logistics:

```text
APPROVED
≠
SUBSCRIBED
```

The email must not claim that subscription is already active.

## 36. Rejection Email

Rejection email should communicate:

```text
registration rejected
```

Whether to include a reason or resubmission instructions remains Open.

## 37. Email Security

Do not send:

- password
- password hash
- session token
- personal access token
- Admin-only notes
- sensitive verification material

Brevo credentials must remain server-side and must not appear in browser payloads, Audit Logs, or email content.

## 35. Login Integration

Authentication must check registration/access eligibility.
Conceptually:

```text
valid credentials
+
role-account status APPROVED
→ normal role sign-in allowed
```

Exact Auth implementation belongs to the relevant role authentication flow.

## 36. Guest Buyer Boundary

AISLEY allows guests to browse the storefront.
A pending Buyer being unable to sign in does not prevent anonymous marketplace browsing.

## 37. Manage User Accounts Boundary

```text
Manage Account Registrations
    pre-access registration decision

Manage User Accounts
    ongoing lifecycle after account exists/has access
```

Examples owned by Manage User Accounts:

- temporary suspension
- restoration
- deactivation
- profile/status administration

## 38. Global Ban Boundary

Registration rejection is not equivalent to a security ban.
Global Ban must be a separate explicit security action.

## 39. Seller Compliance Boundary

Seller Compliance begins as an ongoing Seller governance feature.
Approval does not guarantee permanent compliance.

## 40. Admin Notifications Integration

A newly submitted Admin-owned registration may create an Admin Notification such as:

```text
ACCOUNT_REGISTRATION_PENDING
```

Admin Notifications owns the alert.
Manage Account Registrations owns the decision.

## 41. Dashboard Integration

Admin Dashboard may show:

```text
Pending Registrations
```

Recommended count:

```text
BUYER PENDING
+
SELLER PENDING
+
LOGISTICS PENDING
```

Courier requests are excluded.

## 42. Audit Logs

Approval/rejection are consequential Admin actions.
Recommended Audit events:

```text
ACCOUNT_REGISTRATION_APPROVED
ACCOUNT_REGISTRATION_REJECTED
```

## 43. Audit Data

Recommended:

```text
Admin actor
target user ID
target role
previous status
new status
timestamp
safe reason/reference
```

Never include:

- passwords
- tokens
- secret credentials

## 44. Authentication / Authorization

All management endpoints require:

```text
authenticated ADMIN
```

Possible conceptual permissions:

```text
view registrations
approve registrations
reject registrations
```

Exact keys are Open.

## 45. CSRF

Approve/reject actions are Admin web mutations and must use Sanctum CSRF protection.

## 46. PII Protection

Registration records may contain personal/business data.
The list should expose only necessary summary information.
Detailed sensitive fields should be shown only where required and authorized.

## 47. No Mass Assignment

The decision endpoint must not accept arbitrary account fields.
The client should not be able to change:

```text
role
password
permissions
subscription status
other account fields
```

through an approval request.

## 48. Recommended API

Conceptual:

```http
GET  /api/admin/account-registrations
GET  /api/admin/account-registrations/{id}
POST /api/admin/account-registrations/{id}/approve
POST /api/admin/account-registrations/{id}/reject
```

Exact paths may follow repository naming conventions.

## 49. List API

Recommended filters:

```text
status
role
search
date
page/cursor
```

Backend must exclude Courier registration approvals from Admin-owned queue.

## 50. Detail API

Returns:

- safe applicant identity
- role
- registration status
- submitted data required for review
- submitted/review timestamps
- safe decision metadata
  Do not return credentials/secrets.

## 51. Approve API

Conceptual:

```http
POST /api/admin/account-registrations/{id}/approve
```

Precondition:

```text
status = PENDING
```

Response returns the committed updated registration state.

## 52. Reject API

Conceptual:

```http
POST /api/admin/account-registrations/{id}/reject
```

Possible payload:

```json
{
  "reason": "..."
}
```

Reason requirement remains Open.

## 53. Invalid Transition

If the registration is no longer `PENDING`, the backend must not overwrite the existing decision.
Return a conflict/current-state response.

## 54. Missing Registration

If the target does not exist:

```text
not found
```

Do not infer by email.

## 55. Wrong Role

If the target is a Courier registration:

```text
Admin Account Registration action denied/not applicable
```

Courier approval belongs to Logistics.

## 56. Error Handling

Handle:

```text
registration not found
already decided
permission denied
validation error
session expired
email provider failure
database failure
```

Decision and email outcomes should be distinguished.

## 57. Loading States

Admin list/detail should support:

```text
loading
empty
error
```

Decision actions:

```text
idle
confirming
submitting
success
conflict
error
```

## 58. Empty State

Example:

```text
No pending account registrations.
```

Zero pending requests is valid.

## 59. Decision Feedback

After a successful decision:

- update the detail state
- remove/update the row in PENDING view
- update Dashboard count eventually
- show decision success
- do not falsely guarantee email delivery if email is still queued

## 60. Email Delivery Feedback

Recommended wording if queued:

```text
Registration approved.
Notification email queued.
```

If email later fails, the business decision remains valid.

## 61. Search Role Clarity

Because email is role-aware:

```text
same email
different roles
```

search results must show role clearly.

## 62. Accessibility

The UI should:

- label role/status clearly
- make Approve/Reject actions keyboard accessible
- use accessible confirmations
- expose validation/errors to assistive technologies
- not rely on color alone for state

## 63. Responsive Behavior

List/detail/decision UI should remain usable on smaller Admin screens.

## 64. Performance

Use:

- indexed status/role queries
- pagination
- bounded detail loading
  Avoid loading all PENDING records at once.

## 65. No Flow-Specific Business Logic in Frontend

The frontend may present the decision flow, but:

```text
backend
```

must enforce:

- current status
- role ownership
- transition validity
- authorization

## 66. MVP Scope

### Required

- authenticated Admin registration queue
- Buyer registrations
- Seller registrations
- Logistics registrations
- Courier exclusion
- `PENDING / APPROVED / REJECTED`
- list/search/filter/pagination
- registration detail
- Approve
- Reject
- role-aware exact target
- atomic transition
- concurrency safety
- decision metadata
- Brevo/shared email notification
- approval email
- rejection email
- email failure not rolling back committed decision
- Audit Log integration
- Admin Dashboard count integration
- Admin Notifications integration for new pending registrations
- CSRF
- PII protection
- loading/empty/error states

### Recommended

- explicit confirmation
- optional rejection reason
- queued email delivery/retry
- conflict response on stale decision
- filtered deep-link from Dashboard
- retry/operational visibility for failed email delivery

### Not Required

- Courier approval
- KYC workflow
- document-verification engine
- automated approval scoring
- bulk approval
- bulk rejection
- public Admin registration
- Logistics subscription activation
- Seller Compliance review
- Global Ban action
- rejected-account resubmission flow
- approval reversal

# Acceptance Criteria

## 67. AC-01 — Admin Access

Only authenticated Admins can access registration-management APIs.

## 68. AC-02 — Permission

Approve/reject actions require the configured Admin permission.

## 69. AC-03 — Buyer Queue

PENDING Buyer registrations appear in the Admin queue.

## 70. AC-04 — Seller Queue

PENDING Seller registrations appear in the Admin queue.

## 71. AC-05 — Logistics Queue

PENDING Logistics registrations appear in the Admin queue.

## 72. AC-06 — Courier Exclusion

Courier registration requests do not appear as Admin-owned approval work.

## 73. AC-07 — Role Isolation

Same-email role-accounts remain separate registrations.

## 74. AC-08 — Exact Target

Decisions target user/account ID, not email alone.

## 75. AC-09 — Approve Transition

A PENDING registration can transition to APPROVED.

## 76. AC-10 — Reject Transition

A PENDING registration can transition to REJECTED.

## 77. AC-11 — Invalid Re-Decision

An already decided registration cannot be overwritten by a stale second decision.

## 78. AC-12 — Concurrency

Two Admins deciding the same PENDING record cannot commit conflicting final states.

## 79. AC-13 — Pending Access

A PENDING role-account does not receive normal authenticated role access.

## 80. AC-14 — Rejected Access

A REJECTED role-account does not receive normal role access.

## 81. AC-15 — Approved Access

An APPROVED role-account becomes eligible for normal role sign-in subject to additional role rules.

## 82. AC-16 — Logistics Subscription Boundary

APPROVED Logistics is not automatically marked subscribed.

## 83. AC-17 — Approval Email

A successful approval triggers/queues an approval email.

## 84. AC-18 — Rejection Email

A successful rejection triggers/queues a rejection email.

## 85. AC-19 — Email Failure Independence

Email-provider failure does not roll back a committed approval/rejection.

## 86. AC-20 — Audit Approve

Approval creates a safe Audit event.

## 87. AC-21 — Audit Reject

Rejection creates a safe Audit event.

## 88. AC-22 — Dashboard Count

Dashboard Pending Registrations reflects Admin-owned PENDING Buyer/Seller/Logistics records.

## 89. AC-23 — No KYC Assumption

The feature does not require verification documents absent from actual schema/requirements.

## 90. AC-24 — No Lifecycle Mutation

Approval/rejection endpoint cannot arbitrarily suspend/deactivate/change role/permissions.

## 91. AC-25 — CSRF

Admin decision mutations require configured Sanctum CSRF protection.

## 92. AC-26 — Secret Safety

Registration APIs/emails/Audit Logs do not expose passwords, hashes, or tokens.

## 93. AC-27 — Pagination

Registration lists are bounded/paginated.

## 94. AC-28 — Search Role Context

Same-email search results show role so registrations are distinguishable.

## Brevo / Third-Party Acceptance

- Decision state is committed by AISLEY before Brevo delivery is attempted.
- Brevo only transports approval/rejection email and never determines registration state.
- Brevo failure never rolls back a committed approval/rejection.
- No Push/SMS provider is required by Manage Account Registrations.
- Brevo credentials are never exposed to the browser or Audit Logs.

# Tests

## 95. Backend Tests

Test:

- guest denied
- non-Admin denied
- Admin without view permission denied
- Admin without decision permission denied
- Buyer PENDING listed
- Seller PENDING listed
- Logistics PENDING listed
- Courier excluded
- APPROVED excluded from default PENDING queue
- REJECTED excluded from default PENDING queue
- same-email Buyer/Seller separated
- decision targets exact ID
- PENDING → APPROVED succeeds
- PENDING → REJECTED succeeds
- APPROVED cannot be overwritten by stale reject
- REJECTED cannot be overwritten by stale approve
- concurrent conflicting decisions allow one winner
- reviewed_by/reviewed_at recorded
- Logistics approval does not activate subscription
- approval email queued/sent
- rejection email queued/sent
- email failure does not roll back decision
- approval audited
- rejection audited
- Audit data excludes secrets
- mass-assignment fields ignored/rejected
- CSRF required
- pagination/filter/search work

## 96. Frontend Tests

Test:

- registration list loads
- empty state
- role/status filters
- search
- role visible for same-email results
- detail loads
- Approve confirmation
- Reject confirmation
- decision submitting state
- successful decision updates UI
- stale/conflict decision handled
- email queued status wording
- session expiration handled
- unauthorized actions hidden/disabled
- responsive layout
- keyboard accessibility
- status not color-only

# Open Decisions

## 97. Open Decisions

Current sources do not define:

1. exact route naming
2. exact permission keys
3. exact registration-detail fields
4. whether rejection reason is required
5. whether rejection reason is user-visible
6. whether rejected registrations can resubmit
7. whether rejected registrations can be reconsidered
8. whether approved registrations can later return to pending/rejected
9. email template wording
10. email retry count/backoff
11. Admin visibility for failed email delivery
12. whether an Admin may manually resend the decision email
13. bulk approval/rejection
14. exact search fields
15. exact pagination strategy
16. registration submission timestamp field
17. current-account status integration naming
18. login response for PENDING accounts
19. login response for REJECTED accounts
20. whether approval requires a note
21. whether Seller/Logistics require additional review data
22. whether any KYC/document process will be introduced
23. Dashboard refresh/invalidation strategy
24. Admin Notification deduplication for new registration
25. exact Audit event taxonomy
26. decision conflict HTTP response convention
27. retention policy for rejected registrations
28. whether an applicant may withdraw a pending registration

## Email Integration Decisions

Still Open:

- exact Brevo email template structure
- retry count/backoff
- whether Admin can manually resend a decision email
- whether failed delivery is visible in the registration detail
- exact queue implementation

Not Open:

```text
email provider = Brevo
```

for the current AISLEY email architecture.

# Final Definition

## 98. Final Definition

AISLEY Manage Account Registrations is:

```text
an Admin-only registration decision feature

for:
    Buyer
    Seller
    Logistics
```

with source-backed states:

```text
PENDING
APPROVED
REJECTED
```

and transitions:

```text
PENDING → APPROVED
PENDING → REJECTED
```

After a decision:

```text
commit registration state
→ write Audit event
→ send/queue decision email
```

Courier registration is excluded because:

```text
Courier approval belongs to Logistics.
```

Central identity rule:

```text
Decide the exact AISLEY role-account,
not every account sharing the email.
```

Central Logistics rule:

```text
APPROVED Logistics
does not mean
SUBSCRIBED Logistics.
```
