---
feature: Manage User Accounts
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft
scope: Admin Web Application / Ongoing User Account Administration
source_coverage: Admin.md, app.md, current AISLEY Admin feature boundaries
---

# Manage User Accounts Specification

## 1. Purpose

Manage User Accounts is the Admin feature for viewing user profiles and managing ongoing account status after registration.
`Admin.md` defines:

```text
Core Value:
View user profiles, updates status of accounts.

Expanded Definition:
A comprehensive data management interface
providing full CRUD
(Create, Read, Update, Delete/Deactivate)
capabilities over user records.

Administrators can:
- access granular profile details
- review user history
- manually intervene to update account statuses
- issue temporary suspensions
- restore access

System Context:
Requires robust search and filtering endpoints.

Must securely expose user metadata
without compromising sensitive PII
where restricted.
```

This specification defines requirements, boundaries, APIs, security rules, acceptance criteria, and Open Decisions.
Lifecycle/state transitions are kept in `flow.md`.

## 2. Primary Actor

The primary actor is:

```text
ADMIN
```

Only authenticated and authorized Admins may access or mutate managed user accounts.

## 3. Managed Roles

AISLEY roles include:

```text
BUYER
SELLER
LOGISTICS
COURIER
ADMIN
```

For this feature, the primary managed roles are:

```text
BUYER
SELLER
LOGISTICS
COURIER
```

Admin self-service belongs to:

```text
Admin Account Management
```

Creating or assigning permissions to other Admins belongs to separate Admin governance.
Whether this feature may view other Admin records in a read-only capacity is an Open Decision.

## 4. Role-Aware Identity

AISLEY uses:

```text
unique(email, role)
```

Therefore:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

are separate accounts.
Manage User Accounts must target:

```text
user_id
```

with role context.
Do not mutate users by email alone.

## 5. Core Responsibilities

This feature owns:

- user account list
- robust search/filtering
- user profile detail
- safe account history
- approved profile-field updates where allowed
- temporary suspension
- restoration of access
- deactivation
- account-state metadata
- Audit Log integration
- safe cross-feature status visibility
  It does not own:
- registration approval/rejection
- Courier registration approval
- Seller Compliance case decisions
- Global Ban
- Logistics subscription billing
- Admin self-profile settings
- Admin permission management
- password reset unless separately specified
- order cancellation/refund
- complaint resolution

## 6. Registration Boundary

Manage Account Registrations owns:

```text
PENDING
APPROVED
REJECTED
```

Manage User Accounts begins after or alongside an existing user record and manages ongoing account lifecycle.
It must not silently convert:

```text
REJECTED → APPROVED
```

or:

```text
PENDING → APPROVED
```

Those decisions belong to Manage Account Registrations.

## 7. Courier Approval Boundary

From `app.md`:

```text
Courier
→ registers under Logistics
→ Logistics Admin approves
```

Platform Admin must not use Manage User Accounts to bypass Logistics-owned Courier approval.

## 8. Recommended Account Lifecycle

The source explicitly supports:

```text
temporary suspension
restoring access
deactivation
```

Recommended lifecycle terminology:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

Exact enum names should follow the implemented user schema.

## 9. Recommended Transitions

Recommended:

```text
ACTIVE → SUSPENDED
SUSPENDED → ACTIVE
ACTIVE → DEACTIVATED
SUSPENDED → DEACTIVATED
```

Whether:

```text
DEACTIVATED → ACTIVE
```

is allowed is not defined and remains Open.

## 10. Active

`ACTIVE` means the account is not restricted by this feature's own lifecycle state.
It does not mean all other access conditions are satisfied.
A user may be:

```text
ACTIVE
but globally banned

ACTIVE
but Seller Compliance restricted

ACTIVE
but Logistics subscription inactive
```

## 11. Suspended

`SUSPENDED` is a temporary account-access restriction imposed through Manage User Accounts.
Suspension should preserve:

- user record
- role
- history
- orders
- case references
- Audit Log references
  Suspension is not account deletion.

## 12. Deactivated

`DEACTIVATED` represents a stronger non-active lifecycle state.
The source groups:

```text
Delete/Deactivate
```

For platform accountability, recommended MVP behavior is:

```text
soft deactivation
rather than destructive hard delete
```

Exact hard-delete policy is Open.

## 13. Restore

Restoring means clearing the Manage User Accounts suspension state where permitted.
Restore must not automatically clear independent restrictions from other features.

## 14. Restore Safety Checks

Before restoring effective access, the system should consider independent access gates.
Relevant existing AISLEY rules:

```text
registration approval
Global Ban
Seller Compliance restrictions
Logistics subscription
Courier approval by Logistics
```

Therefore:

```text
restore account lifecycle state
≠
guarantee full platform access
```

## 15. Global Ban Independence

Example:

```text
account status = SUSPENDED
Global Ban = ACTIVE
```

Admin restores account:

```text
account status → ACTIVE
Global Ban remains ACTIVE
```

The user remains blocked by Global Ban enforcement.

## 16. Seller Compliance Independence

Example:

```text
Seller account status = SUSPENDED
Seller Compliance restriction = ACTIVE
```

Restoring Manage User Accounts status must not clear the compliance restriction.

## 17. Registration Approval Independence

A rejected or still-pending registration must not become eligible merely because an Admin changes an unrelated account-lifecycle field.
Manage Account Registrations remains authoritative.

## 18. Logistics Subscription Independence

From `app.md`:

```text
Logistics
register
→ Admin approved
→ email
→ sign in
→ subscription
```

Therefore:

```text
ACTIVE Logistics account
≠
active Logistics subscription
```

Manage User Accounts must not activate subscription/payment state.

## 19. Courier Approval Independence

A Courier may exist in the user table but still be subject to Logistics-owned approval.
Platform Admin restoration must not override that approval authority.

## 20. Existing Orders

Suspension/deactivation must not automatically:

- cancel orders
- mark orders delivered
- trigger refunds
- modify shipment state
- reassign Courier tasks
  Operational consequences require owning-domain rules.

## 21. User List

Recommended columns:

```text
User
Role
Email
Account Status
Registration Status
Created At
```

Optional role-specific status indicators may appear if authorized.

## 22. Role Clarity

Because email can repeat across roles, every user row/search result must make role visible.

## 23. Search

`Admin.md` explicitly requires robust search.
Recommended search fields:

```text
name
email
user ID
```

Role-specific identifiers may be added if present in schema.

## 24. Filters

Recommended:

```text
role
account status
registration status
created date
```

Optional:

```text
Global Ban state
Seller Compliance state
Logistics subscription state
Courier approval state
```

only when the implementation can query them safely and efficiently.

## 25. Pagination

User lists must be paginated/bounded.
Do not load all users into the Admin browser.

## 26. Sorting

Recommended:

```text
created_at
name
status
```

Exact sorting options are Open.

## 27. User Detail

Recommended sections:

```text
Identity
Role
Account Status
Registration Status
Profile
Role-Specific Status
Account History
Related Admin Actions
```

## 28. PII Minimization

`Admin.md` explicitly requires secure exposure of user metadata without compromising restricted PII.
Do not expose unnecessary:

- password hashes
- session tokens
- personal access tokens
- CVV/payment secrets
- full payout credentials
- sensitive evidence
- unrelated addresses/phone numbers

## 29. Role-Specific PII

Only display role-specific sensitive fields when necessary and authorized.
Examples:

- Logistics company metadata
- Seller shop metadata
- Courier operational identity
- Buyer profile data
  Exact field-level access policy is Open.

## 30. Passwords

Never expose:

```text
password
password hash
```

Admin profile editing must not allow direct password-hash assignment.

## 31. Tokens

Never expose:

```text
Sanctum session cookie
personal access token plaintext
CSRF secret
```

## 32. Profile Editing

`Admin.md` says full CRUD over user records.
This does not mean arbitrary database-column editing.
Use an explicit allowlist of user-profile fields.

## 33. Editable Fields

Exact fields depend on the real role schemas.
Possible examples only if supported:

```text
name
contact information
role-specific profile metadata
```

Do not invent mandatory fields.

## 34. Forbidden Fields

Manage User Accounts must not allow arbitrary mutation of:

```text
role
password hash
Admin permissions
subscription payment records
Global Ban records
Seller Compliance state
registration decision
Audit fields
```

## 35. Role Change

Changing:

```text
BUYER → SELLER
SELLER → LOGISTICS
```

through Manage User Accounts is not source-defined.
Do not implement role conversion by default.

## 36. Create User

`Admin.md` says full CRUD including Create.
However, AISLEY defines role-specific registration/approval flows.
Therefore generic Admin-side user creation is ambiguous.
Recommended MVP:

```text
do not expose generic Create User
until role-specific creation semantics are defined
```

This remains an Open Decision rather than silently bypassing registration rules.

## 37. Delete User

The source says:

```text
Delete/Deactivate
```

Recommended:

```text
deactivate
```

instead of hard deletion because AISLEY records may be referenced by:

- orders
- complaints
- Audit Logs
- Seller Compliance
- Logistics/Courier operations

## 38. Hard Delete

Hard deletion requires separate retention/legal/data-integrity rules and is not recommended for MVP.

## 39. Suspension Action

Suspension preconditions:

- authenticated Admin
- authorized permission
- exact target user resolved
- current state permits suspension
- optional reason validation
  Recommended result:

```text
ACTIVE → SUSPENDED
```

## 40. Suspension Reason

A reason is recommended for accountability.
Whether mandatory is Open.

## 41. Suspension Duration

The source says:

```text
temporary suspension
```

But no duration/expiry model is defined.
Possible future:

```text
suspended_until
```

Exact duration behavior is Open.

## 42. Automatic Unsuspend

Not source-defined.
Do not automatically restore access after a timer unless explicitly implemented.

## 43. Restore Action

Restore preconditions:

- authenticated Admin
- authorized permission
- target currently restorable
- independent restrictions re-evaluated
  Recommended own-state transition:

```text
SUSPENDED → ACTIVE
```

## 44. Restore Result

A successful restore means:

```text
Manage User Accounts suspension removed
```

It does not promise:

```text
full effective access
```

if other restrictions remain.

## 45. Deactivate Action

Recommended:

```text
ACTIVE/SUSPENDED → DEACTIVATED
```

Deactivation should preserve historical records.

## 46. Reactivation

Reactivation from `DEACTIVATED` is not source-defined.
Open Decision.

## 47. Confirmation

Suspension, restoration, and deactivation are consequential.
Recommended explicit confirmation containing:

```text
target user
role
current status
new status
reason if applicable
```

## 48. Concurrency

Two Admins may mutate the same account.
Backend must prevent stale state overwrites.
Recommended:

```text
optimistic locking
updated_at/version check
atomic status transition
```

## 49. Idempotency

Repeated requests should not cause inconsistent duplicate state/history.
Examples:

```text
suspend already-SUSPENDED
restore already-ACTIVE
deactivate already-DEACTIVATED
```

should return current/conflict semantics according to API convention.

# History

## 50. User History

`Admin.md` says Admins can review user history.
The source does not define exact history contents.
Recommended safe history may include references to:

- registration decision
- account status changes
- complaint cases
- Seller Compliance cases
- Global Ban state
- relevant orders
- Logistics/Courier relationship status
  Do not duplicate all underlying records into the user table.

## 51. History Aggregation

Prefer:

```text
references / bounded summaries
```

with links to owning features.

## 52. Audit Logs

Account lifecycle mutations are high-impact Admin actions.
Recommended Audit events:

```text
USER_PROFILE_UPDATED
USER_ACCOUNT_SUSPENDED
USER_ACCOUNT_RESTORED
USER_ACCOUNT_DEACTIVATED
```

Exact taxonomy follows System Audit Logs.

## 53. Audit Data

Recommended:

```text
Admin actor
target user ID
target role
previous state
new state
safe reason
timestamp
```

## 54. No Secrets in Audit

Never write:

```text
password
password hash
token
full payment credentials
```

to Audit Logs.

# Cross-Feature Integration

## 55. Manage Account Registrations

User detail may show registration status.
Registration decisions remain owned by:

```text
Manage Account Registrations
```

## 56. Seller Compliance

Seller detail may show compliance state and link to Seller Compliance.
Manage User Accounts must not directly clear compliance sanctions.

## 57. Global Ban

User detail may show Global Ban state.
Unban must happen in:

```text
Global Ban / Blocklist
```

## 58. Complaints & Disputes

User detail may show complaint references.
Complaint decisions remain owned by that feature.

## 59. Admin Chat

Recommended action:

```text
Message User
```

This opens/creates a role-aware Admin Chat thread.
Messaging does not mutate account status.

## 60. Admin Notifications

Account-management mutations do not automatically create inbound Admin Notifications.
Security alerts may be added separately.

## 61. Dashboard

Dashboard may summarize user-related workloads but should link into Manage User Accounts for detailed account administration.

# API

## 62. Recommended API

Conceptual:

```http
GET   /api/admin/users
GET   /api/admin/users/{userId}
PATCH /api/admin/users/{userId}/profile
POST  /api/admin/users/{userId}/suspend
POST  /api/admin/users/{userId}/restore
POST  /api/admin/users/{userId}/deactivate
```

A reactivation endpoint is optional if policy permits.

## 63. List API

Recommended query:

```text
search
role
status
registration_status
page/cursor
sort
```

Optional cross-feature filters depend on query architecture.

## 64. Detail API

Returns safe:

- user ID
- role
- profile fields
- account status
- registration status
- role-specific safe status indicators
- bounded history references

## 65. Profile Update API

Backend must:

- authenticate Admin
- authorize profile update
- derive exact target by user ID
- allowlist fields
- validate
- persist
- Audit if consequential

## 66. Suspend API

Conceptual:

```http
POST /api/admin/users/{userId}/suspend
```

Possible payload:

```json
{
  "reason": "..."
}
```

Exact reason requirement is Open.

## 67. Restore API

Conceptual:

```http
POST /api/admin/users/{userId}/restore
```

Backend must not clear unrelated restrictions.

## 68. Deactivate API

Conceptual:

```http
POST /api/admin/users/{userId}/deactivate
```

Recommended soft-deactivation semantics.

## 69. Invalid Target

If target does not exist:

```text
not found
```

Do not resolve by email fallback.

## 70. Role Safety

A client must not be able to change target role through lifecycle mutation payloads.

# Authentication / Authorization

## 71. Authentication

Every Admin user-management endpoint requires:

```text
authenticated ADMIN
```

## 72. Permissions

Possible conceptual permissions:

```text
view users
edit user profiles
suspend users
restore users
deactivate users
```

Exact permission keys are Open.

## 73. CSRF

Admin web mutations require Sanctum CSRF protection.

## 74. IDOR Protection

Knowing a:

```text
user_id
```

does not grant access.
Backend must enforce Admin permission for every user detail/mutation.

## 75. Self-Targeting Admin

Because this feature primarily manages non-Admin roles, self-targeting Admin account mutations should be rejected or routed to Admin Account Management.

# Effective Access

## 76. Access Is Composite

Effective user access can depend on multiple domains.
Conceptually:

```text
registration eligibility
+
Manage User Accounts lifecycle
+
Global Ban
+
role-specific restrictions
+
subscription/approval requirements
```

## 77. Buyer Access

Possible gates:

```text
registration approved
account not suspended/deactivated
not globally banned
```

Guest browsing remains separate.

## 78. Seller Access

Possible gates:

```text
registration approved
account lifecycle active
not globally banned
Seller Compliance permits access/actions
```

## 79. Logistics Access

Possible gates:

```text
registration approved
account lifecycle active
not globally banned
subscription requirement satisfied where required
```

## 80. Courier Access

Possible gates:

```text
Logistics approval
account lifecycle active
not globally banned
```

Platform Admin restore must not fake Logistics approval.

# Error Handling

## 81. Errors

Handle:

```text
user not found
permission denied
invalid status transition
stale/concurrent update
validation error
independent restriction remains
session expired
server error
```

## 82. Restore Warning

If restore succeeds but another restriction remains, recommended response/UI:

```text
Account suspension removed.
Access is still restricted by <owning feature>.
```

Do not report:

```text
Full access restored
```

when it is false.

## 83. Profile Validation Error

Return field-level validation errors without exposing internal schema details.

# Performance

## 84. Search

Use indexed/appropriate search strategy for:

```text
email
role
status
user ID
```

Name search strategy depends on database capabilities.

## 85. Pagination

Always bound user lists.

## 86. Detail Loading

Do not load all orders/complaints/history eagerly.
Use bounded summaries or secondary endpoints.

# UX

## 87. User List States

Support:

```text
loading
empty
filtered empty
error
```

## 88. User Detail States

Support:

```text
loading
loaded
saving
mutation confirming
mutation submitting
success
conflict
error
```

## 89. Status Display

Clearly distinguish:

```text
Account Status
Registration Status
Global Ban
Seller Compliance
Subscription / Courier Approval
```

Do not collapse them into one ambiguous "Status".

## 90. Role Display

Role must be clearly visible throughout search/list/detail because email is role-aware.

## 91. Accessibility

UI should:

- use semantic labels
- expose status as text
- support keyboard navigation
- use accessible confirmation dialogs
- announce mutation success/errors
- not rely on color alone

## 92. Responsive Behavior

User list/detail/actions should remain usable on narrower Admin screens.

# MVP Scope

## 93. Required

- authenticated Admin user list
- Buyer/Seller/Logistics/Courier records
- role-aware identity
- robust search/filter/pagination
- safe profile detail
- safe account history
- allowlisted profile updates where supported
- temporary suspension
- restoration
- deactivation
- state-transition validation
- concurrency protection
- registration-status visibility
- independent Global Ban visibility/check
- Seller Compliance boundary
- Logistics subscription boundary
- Courier approval boundary
- Admin Chat link
- Audit Log integration
- CSRF
- PII protection
- loading/empty/error states

## 94. Recommended

- `ACTIVE / SUSPENDED / DEACTIVATED`
- soft deactivation
- suspension reason
- explicit confirmation
- restore warning when other restrictions remain
- bounded cross-feature history
- optimistic locking/version checks

## 95. Not Required

- generic Admin-created Buyer/Seller/Logistics/Courier accounts
- hard delete
- role conversion
- Admin permission management
- Courier approval
- registration approval/rejection
- Logistics subscription activation
- Global Ban add/remove
- Seller Compliance sanction management
- refunds/order cancellation
- password reset
- automatic suspension expiry

# Acceptance Criteria

## 96. AC-01 — Admin Access

Unauthenticated/non-Admin users cannot access Admin user-management endpoints.

## 97. AC-02 — Permission

User view/mutation operations require configured Admin permissions.

## 98. AC-03 — Managed Roles

Buyer/Seller/Logistics/Courier accounts can be listed according to authorization.

## 99. AC-04 — Role Isolation

Same-email role-accounts remain distinct.

## 100. AC-05 — Exact Target

Mutations target exact user ID rather than email alone.

## 101. AC-06 — Search

Admin can search/filter users without loading the entire user table.

## 102. AC-07 — PII Safety

User API/UI does not expose passwords, hashes, tokens, or unrelated restricted PII.

## 103. AC-08 — Profile Allowlist

Profile update cannot mass-assign forbidden account/security fields.

## 104. AC-09 — Role Immutable

Manage User Accounts cannot arbitrarily change user role.

## 105. AC-10 — Suspend

A restorable active account can be placed into the configured suspended state.

## 106. AC-11 — Suspend History

Suspension records Admin actor/time and appropriate Audit event.

## 107. AC-12 — Restore

A suspended account can have its Manage User Accounts suspension removed.

## 108. AC-13 — Global Ban Independence

Restore does not clear an active Global Ban.

## 109. AC-14 — Seller Compliance Independence

Restore does not clear Seller Compliance restrictions.

## 110. AC-15 — Registration Independence

Restore does not approve a PENDING/REJECTED registration.

## 111. AC-16 — Logistics Subscription Independence

Restore does not activate Logistics subscription.

## 112. AC-17 — Courier Approval Independence

Restore does not override Logistics-owned Courier approval.

## 113. AC-18 — Deactivate

Authorized Admin can soft-deactivate an eligible account.

## 114. AC-19 — No Automatic Order Mutation

Suspend/deactivate does not silently cancel/rewrite orders or shipment state.

## 115. AC-20 — No Hard Delete by Default

MVP preserves historical references when an account is deactivated.

## 116. AC-21 — Concurrency

Stale simultaneous account mutations cannot silently overwrite each other.

## 117. AC-22 — Restore Accuracy

UI does not claim full access when another independent restriction remains.

## 118. AC-23 — Audit Restore

Restore creates a safe Audit event.

## 119. AC-24 — Audit Deactivate

Deactivation creates a safe Audit event.

## 120. AC-25 — No Secrets in Audit

Audit events contain no password/token/payment secret.

## 121. AC-26 — CSRF

Admin mutations require configured Sanctum CSRF protection.

## 122. AC-27 — Pagination

User list is paginated/bounded.

## 123. AC-28 — Role Visible

Same-email search results display role clearly.

# Tests

## 124. Backend Tests

Test:

- guest denied
- non-Admin denied
- Admin without permission denied
- Buyer/Seller/Logistics/Courier listed
- same-email role accounts remain separate
- exact user ID targeting
- role cannot be changed through profile endpoint
- password/hash/token fields never returned
- profile allowlist enforced
- active account can suspend
- suspension audited
- suspended account can restore
- restore audited
- Global Ban remains after restore
- Seller Compliance restriction remains after restore
- PENDING/REJECTED registration remains unchanged
- Logistics subscription remains unchanged
- Courier approval remains unchanged
- active/suspended account can deactivate according to policy
- deactivation audited
- account history preserved
- orders/shipment state unchanged by lifecycle mutation
- conflicting concurrent mutation handled
- CSRF required
- search/filter/pagination work

## 125. Frontend Tests

Test:

- user list loads
- loading/empty/filter states
- role visible
- same-email accounts distinguishable
- user detail loads
- PII fields restricted
- profile edit validation
- suspend confirmation
- restore confirmation
- deactivation confirmation
- mutation submitting/success/error
- concurrency/conflict message
- independent restriction badges/statuses
- restore warning when access remains blocked
- Message User link targets correct role-account
- responsive layout
- keyboard accessibility
- status not color-only

# Open Decisions

## 126. Open Decisions

Current sources do not define:

1. exact account-status enum
2. whether `ACTIVE/SUSPENDED/DEACTIVATED` names match schema
3. whether DEACTIVATED can be reactivated
4. hard-delete policy
5. suspension reason requirement
6. suspension duration
7. automatic suspension expiry
8. exact Admin permission keys
9. generic Admin-side user creation
10. exact editable profile fields per role
11. exact PII field-level policy
12. whether Admin records appear in this feature
13. role conversion
14. password reset
15. user notification on suspension
16. user notification on restoration
17. user notification on deactivation
18. exact account history sources
19. exact history retention
20. exact concurrency mechanism
21. exact HTTP conflict conventions
22. whether deactivation immediately invalidates sessions/tokens
23. whether suspension immediately invalidates sessions/tokens
24. Buyer in-flight order behavior
25. Seller existing-order/listing behavior
26. Logistics active-shipment behavior
27. Courier active-task behavior
28. support/chat access while suspended/deactivated
29. whether Global Ban state is shown inline or only linked
30. whether Seller Compliance state is shown inline or only linked
31. whether subscription state is shown inline
32. whether Courier approval state is shown inline
33. exact search implementation
34. export capability
35. bulk suspension/restoration/deactivation
36. data retention/privacy erasure procedures

# Final Definition

## 127. Final Definition

AISLEY Manage User Accounts is:

```text
an Admin-controlled account administration feature

for:
    Buyer
    Seller
    Logistics
    Courier
```

It provides:

```text
search/filter
safe profile detail
safe history
allowlisted profile updates
temporary suspension
restoration
deactivation
```

Recommended lifecycle:

```text
ACTIVE → SUSPENDED
SUSPENDED → ACTIVE
ACTIVE/SUSPENDED → DEACTIVATED
```

Central identity rule:

```text
Manage the exact user ID / role-account,
not every AISLEY account sharing an email.
```

Central restore rule:

```text
Restoring Manage User Accounts state
must not clear independent restrictions
from Global Ban,
Seller Compliance,
registration approval,
Logistics subscription,
or Courier approval.
```

Central data rule:

```text
Expose enough metadata for administration,
but never expose restricted PII,
passwords, hashes, or tokens.
```
