---
feature: Manage User Accounts
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application
source_coverage: Current AISLEY project requirements; may be updated as account lifecycle and permission rules evolve
---

# Manage User Accounts Specification

## 1. Purpose

This document defines the **AISLEY Admin Manage User Accounts** feature.

Manage User Accounts is the platform-level administrative interface for viewing user profiles, searching and filtering user records, reviewing account history, updating permitted account/profile information, changing account access status, temporarily suspending users, restoring access, and deactivating or deleting records where the platform's retention rules allow it.

This specification is grounded in the current AISLEY project documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

The source documents explicitly establish that:

- Admins can view user profiles.
- Admins can update account statuses.
- Manage User Accounts provides full CRUD-style management over user records.
- Admins can inspect granular profile details and user history.
- Admins can temporarily suspend access.
- Admins can restore access.
- The module requires robust search and filtering endpoints.
- User metadata must be exposed securely without compromising restricted PII.
- All AISLEY roles share the same user system.
- Account identity uniqueness is based on `(email, role)`.
- Buyer, Seller, Logistics, and Courier each have role-specific profile/account data.
- Seller Compliance can suspend Seller privileges and hide Seller products.
- System Audit Logs must record administrative operations.
- Global Ban/Blocklist is a separate security feature.
- Admin's own account settings are a separate **Account Management** feature.

Where the source documents do not define exact post-registration account status names, deletion policy, restoration rules, session revocation behavior, suspension duration, Admin-created user behavior, or field-level edit permissions, this specification marks those items as open decisions rather than inventing them.

---

# 2. Core Value

`Admin.md` defines:

```text
Manage User Accounts

Core Value:
View user profiles, updates status of accounts.
```

Expanded source definition:

```text
comprehensive data management interface
        ↓
full CRUD over user records
        ↓
view granular profile details
        ↓
review user history
        ↓
manually intervene
        ↓
temporary suspension / restore access / status changes
```

This feature answers:

```text
Who is this user?
Which AISLEY role does this account belong to?
What is the account's current access state?
What relevant history does the platform have?
Should this user remain active?
Does the Admin need to suspend, restore, update, deactivate, or otherwise manage this account?
```

---

# 3. Goals

Manage User Accounts must:

1. provide a centralized Admin directory of user accounts
2. preserve AISLEY's role-scoped `(email, role)` identity model
3. allow Admins to inspect user profiles
4. expose role-appropriate account information
5. support robust server-side search
6. support role and status filtering
7. support pagination
8. support account history review
9. allow authorized profile/account metadata updates where appropriate
10. support temporary account/access suspension
11. support restoration after temporary suspension
12. support deactivation where permitted
13. support deletion only where platform data-retention rules allow it
14. keep registration approval separate from ongoing account administration
15. keep Seller Compliance enforcement linked to the same authoritative Seller access state
16. keep Global Ban/Blocklist as a separate threat/security system
17. keep Admin self-service account settings separate
18. protect sensitive PII
19. protect authentication/security data
20. prevent cross-role account confusion when the same email appears under multiple roles
21. record Admin mutations in the System Audit Log
22. protect against conflicting changes by multiple Admins
23. prevent frontend-only enforcement of account restrictions
24. ensure suspended/deactivated users cannot bypass restrictions through direct APIs
25. preserve referential integrity with Orders, Shops, Logistics records, Couriers, Messages, Reviews, and other platform history

---

# 4. Non-Goals

This feature does not itself define:

- public account registration
- registration approval
- applicant rejection
- applicant approval emails
- Admin authentication
- Admin permission-management UI
- initial Admin creation
- creation of additional Admins with custom permissions
- Admin self-service profile settings
- Seller product moderation
- Seller warning workflow
- product removal
- complaint/dispute adjudication
- global IP blocklist
- payment-method blocklist
- fraud scoring
- password-reset flow
- email-verification flow
- identity verification / KYC
- Logistics subscription billing
- Courier approval by Logistics
- Seller shop lifecycle rules
- payout processing
- account data-retention policy
- account anonymization policy
- legal deletion requirements
- automated sanctions
- automated risk scoring

These belong to separate specifications or remain undefined by current sources.

---

# 5. Primary Actor

## 5.1 Admin

The Admin is the primary operator.

An authorized Admin can:

```text
list users
search users
filter users
view profile
review account history
update permitted metadata
change permitted account status
temporarily suspend access
restore access
deactivate account
delete account if policy permits
```

All access and mutations must be authorization-checked by the backend.

---

# 6. Managed Account Roles

AISLEY defines these primary non-Admin user roles:

```text
BUYER / CUSTOMER
SELLER
LOGISTICS
COURIER / RIDER
```

All roles live in the shared users system.

Manage User Accounts should be capable of representing these account roles.

---

# 7. Admin Accounts Boundary

`app.md` defines a separate Admin lifecycle:

```text
initial Admin created from .env
    ↓
create partners
    ↓
add Admins with custom permissions
```

`Admin.md` separately defines:

```text
Account Management
    = Admin updates their own information/settings
```

Therefore, managing Admin accounts and custom Admin permissions should not be silently folded into ordinary Manage User Accounts behavior.

Recommended boundary:

```text
Manage User Accounts
    Buyer
    Seller
    Logistics
    Courier

Admin account administration
    separate Admin/Partner/Permission workflow
```

If the repository later chooses to display Admin identities in the global user directory, destructive/status actions must still obey dedicated Admin-account rules.

---

# 8. Shared Identity Model

`app.md` defines:

```text
all roles live in the same users table
```

and:

```text
unique(email, role)
```

This is a critical invariant.

The same email may exist as:

```text
alex@example.com + BUYER
alex@example.com + SELLER
alex@example.com + LOGISTICS
```

These are separate accounts.

---

# 9. Cross-Role Identity Safety

Every Admin mutation must target:

```text
user/account id
+
role context
```

rather than:

```text
email alone
```

Example:

```text
Suspend:
alex@example.com + SELLER

Must not suspend:
alex@example.com + BUYER
```

Email-based bulk updates across roles are prohibited unless explicitly designed and confirmed.

---

# 10. Relationship to Account Approval

Account Approval manages the **registration decision**.

Source-backed registration states include:

```text
PENDING
APPROVED
REJECTED
```

Manage User Accounts manages the account after or alongside that lifecycle.

Recommended conceptual separation:

```text
Registration Status
    PENDING
    APPROVED
    REJECTED

Account Access Status
    active / suspended / deactivated / equivalent
```

Exact post-registration status names are not defined by the source documents.

---

# 11. Registration Status Must Not Be Overloaded

Do not repurpose:

```text
REJECTED
```

to mean:

```text
an approved user was later suspended
```

and do not repurpose:

```text
PENDING
```

to mean:

```text
temporarily restricted account
```

Registration decision and ongoing account access are different business dimensions.

---

# 12. Approved Account

An account that passed registration approval may become an active user of its role application.

Manage User Accounts may subsequently change its access status.

Example:

```text
SELLER registration APPROVED
        ↓
account active
        ↓
later temporarily SUSPENDED
```

The original registration approval remains historical.

---

# 13. Recommended Account Access State Model

The source defines temporary suspension, restoration, and deactivation but does not provide exact enum values.

A recommended conceptual model is:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

These names are recommendations, not source-mandated values.

If the repository already has an account status model, reuse it.

---

# 14. ACTIVE

Conceptual meaning:

```text
account has normal access
subject to its role-specific business prerequisites
```

Examples:

- approved Buyer can use authenticated Buyer features
- approved Seller can use Seller features unless restricted by compliance/vacation/business state
- approved Logistics may still require subscription according to its own flow
- Courier access remains subject to Logistics approval and role-specific rules

---

# 15. SUSPENDED

Source-backed meaning:

```text
temporary suspension
```

A suspended account has temporarily restricted access.

The exact role-specific capabilities that remain available are not defined by the source.

Backend access checks must enforce the restriction.

---

# 16. DEACTIVATED

Source-backed concept:

```text
Delete/Deactivate
```

A deactivated account is no longer active for normal use but may need to remain in the database for historical integrity.

The exact deactivation semantics are not defined.

---

# 17. Deactivation vs Deletion

These must remain distinct.

```text
Deactivate
    preserve account record
    disable normal access

Delete
    remove data according to retention rules
```

Because AISLEY users may be referenced by:

- Orders
- Reviews
- Messages
- Shops
- Logistics records
- Courier delivery history
- e-POD
- Audit Logs
- Complaints

hard deletion can break historical integrity.

Therefore, deactivation is the safer default administrative action unless a defined deletion policy permits hard deletion.

---

# 18. Hard Delete

`Admin.md` mentions full CRUD including:

```text
Delete/Deactivate
```

but does not define when hard delete is allowed.

Hard deletion should therefore **not** be a default MVP action unless the platform's retention and referential-integrity rules are explicitly defined.

If implemented, the backend must:

```text
check related records
enforce retention policy
prevent broken references
audit the action
```

---

# 19. Create User

`Admin.md` states full CRUD, which includes Create.

However, `app.md` defines role-specific registration and approval flows.

This creates an unresolved product decision:

```text
Can Admin directly create a Buyer/Seller/Logistics/Courier?
```

If Admin-created users are supported, the system must define whether they:

```text
bypass registration approval
enter APPROVED automatically
enter PENDING
require invitation
require password setup
```

Do not silently bypass the documented registration lifecycle.

---

# 20. MVP Create Recommendation

For MVP, if Admin-side user creation is not explicitly required by product decisions:

```text
do not expose direct Create User
```

while preserving backend architecture that can support it later.

This avoids contradicting role-specific registration flows.

---

# 21. Read User

Reading user profiles is explicitly required.

An Admin should be able to inspect:

```text
account identity
role
account status
registration status where relevant
role-specific profile metadata
relevant history
created date
updated date
```

subject to PII restrictions.

---

# 22. Update User

`Admin.md` permits update capabilities.

Admin-editable fields must be explicitly allowlisted.

Do not allow arbitrary mass assignment of:

```text
role
password hash
permission internals
subscription state
seller compliance state
financial balances
delivery metrics
```

unless the owning domain authorizes it.

---

# 23. Role Changes

Changing an existing user's role is dangerous under:

```text
unique(email, role)
```

and role-specific domain records.

The source does not define role conversion.

Therefore:

```text
BUYER → SELLER
SELLER → LOGISTICS
```

must not be implemented as a simple role edit.

A user can instead have separate accounts under the same email for different roles.

---

# 24. Email Changes

Role-specific account management features allow users to update profile/security information.

Whether Admin can edit a user's email is not explicitly defined.

If Admin email editing is supported:

- validate format
- preserve `(email, role)` uniqueness
- handle auth implications
- audit old/new values without exposing sensitive data
- define whether re-verification is required

Email re-verification is not defined by current sources.

---

# 25. Password Changes by Admin

User account-management docs mention users changing security credentials themselves.

`Admin.md` does not explicitly state that Admin can set another user's password.

Therefore, direct Admin password setting should not be assumed.

A safer future flow is:

```text
Admin triggers password reset / recovery
```

but password-reset behavior is not currently specified.

---

# 26. Sensitive Authentication Fields

Never expose to Admin UI:

```text
password hash
remember token
personal access token plaintext
session ids
CSRF secrets
2FA recovery secrets
raw security credentials
```

Admin capability does not justify exposing authentication secrets.

---

# 27. Buyer Profile Context

`Buyer.md` defines Buyer Account Management as handling:

```text
core profile details
authentication credentials
notification preferences
```

Buyer also has:

```text
Address Book
Orders
Reviews
Wishlist
Recently Viewed
```

Manage User Accounts may show a high-level Buyer profile and history, but should not indiscriminately expose all private Buyer activity.

---

# 28. Buyer Detail — Recommended Overview

Recommended Admin-safe Buyer context:

```text
user id
name/display identity
email
role = BUYER
registration status
account access status
created date
last relevant account update
high-level order/history references if needed
```

Addresses should only be shown where operationally justified.

---

# 29. Buyer Address Privacy

Buyer Address Book contains shipping/billing addresses.

These are sensitive PII.

Do not expose full address history in the general user directory.

If a support/dispute workflow needs an address, access it through the relevant Order/Complaint context and authorization.

---

# 30. Seller Profile Context

`Seller.md` defines Seller Account Management as handling:

```text
business names
payout details
store descriptions
security credentials
```

`app.md` defines:

```text
one Seller account : one Shop
```

Manage User Accounts should reflect the Seller/Shop relationship.

---

# 31. Seller Detail — Recommended Overview

Recommended context:

```text
user id
seller identity
email
role = SELLER
shop id
shop name
registration status
account access status
Seller Compliance status/reference where available
created date
high-level relevant history
```

Do not expose payout/banking details by default.

---

# 32. Seller Payout Data

`Seller.md` explicitly identifies payout information as sensitive.

Admin user-management endpoints must not include full payout/banking details unless a separate authorized financial/support workflow requires them.

---

# 33. Seller Shop Relationship

A Seller account corresponds to one shop.

If a Seller account is deactivated/suspended, the Shop's accessibility may be affected.

Exact shop behavior must be coordinated with Seller domain logic.

Do not simply delete the Shop when an account is deactivated.

---

# 34. Seller Compliance Relationship

Seller Compliance can:

```text
issue warning
temporarily suspend Seller privileges
hide Seller products
remove product listings
```

Manage User Accounts can:

```text
temporarily suspend account
restore access
```

These must share authoritative status/access services rather than creating separate contradictory flags.

---

# 35. Seller Suspension Source

The system should preserve why a Seller is suspended.

Conceptually:

```text
suspension source:
    MANUAL_ACCOUNT_ADMIN
    SELLER_COMPLIANCE
```

Exact values are not source-defined.

The goal is to prevent restoration from one module accidentally overriding another active restriction.

---

# 36. Multiple Restriction Reasons

A Seller may theoretically be restricted for more than one reason.

Example:

```text
Seller Compliance suspension
+
security/account suspension
```

Restoring one reason must not automatically clear all restrictions.

A shared restriction model is recommended if the platform needs multiple simultaneous restrictions.

---

# 37. Seller Product Visibility

`Admin.md` states that Seller suspension can cascade to:

```text
hide seller's products
```

If the account is suspended through Manage User Accounts and the platform treats it as the same Seller suspension, product visibility must follow the shared Seller restriction rules.

Do not rely only on Seller frontend access.

---

# 38. Seller Vacation Mode

`Seller.md` defines Vacation Mode, which can hide products voluntarily.

This is separate from Admin suspension.

```text
Vacation Mode
    Seller-controlled

Account/Compliance Suspension
    Admin-controlled
```

Restoring a Seller account must not automatically disable Vacation Mode.

---

# 39. Logistics Profile Context

`Logistics.md` defines Logistics Account Management as handling:

```text
operational details
contact numbers
security credentials
```

Logistics also owns:

- dispatch
- vehicles
- Couriers
- waybills
- capacity monitoring

Manage User Accounts should show account/profile status, not become the Logistics operations dashboard.

---

# 40. Logistics Detail — Recommended Overview

Recommended:

```text
user id
Logistics organization identity
email
role = LOGISTICS
registration status
account access status
subscription status reference
created date
high-level profile metadata
```

Subscription data should come from the authoritative billing/subscription domain.

---

# 41. Logistics Approval vs Subscription

`app.md` defines:

```text
register
→ Admin approved
→ email
→ sign in
→ subscription
```

Therefore:

```text
approved Logistics account
    ≠
active paid subscription
```

Manage User Accounts should display these as separate states where available.

---

# 42. Logistics Suspension

The source does not define what happens to:

```text
active deliveries
Couriers
in-progress waybills
```

if a Logistics account is suspended.

Do not automatically cancel or corrupt operational records.

Exact operational consequences are an open decision.

---

# 43. Courier Profile Context

`Courier.md` defines Courier Account Management as handling:

```text
vehicle details
license information
payout methods
security credentials
```

Courier accounts are registered through Logistics and approved by Logistics.

---

# 44. Courier Approval Boundary

Platform Admin Account Approval does not approve Couriers.

However, `Admin.md` Manage User Accounts broadly covers user records.

Therefore, Admin may be allowed to view a Courier account and possibly perform platform-level status intervention if product policy permits.

This is distinct from:

```text
Courier registration approval
```

which belongs to Logistics.

---

# 45. Courier Detail — Recommended Overview

Recommended:

```text
user id
Courier identity
email
role = COURIER
associated Logistics
Logistics approval status/reference
account access status
vehicle summary where safe
created date
high-level delivery-history reference
```

Do not expose full payout details by default.

---

# 46. Courier Sensitive Data

Courier profile may contain:

```text
license information
vehicle details
payout methods
```

These can be sensitive.

General Admin directory responses should expose only what is necessary.

---

# 47. Courier Active Delivery Safety

If Admin suspends/deactivates a Courier with an active delivery task, the source does not define how that task is reassigned.

Do not silently abandon or cancel the active task.

The Logistics operational workflow must handle task reassignment/incident behavior.

---

# 48. User Directory Route

Recommended route:

```text
/users
```

or:

```text
/user-accounts
```

Exact route naming should follow Admin conventions.

Navigation label:

```text
Manage User Accounts
```

---

# 49. User Directory

Recommended structure:

```text
Manage User Accounts

Search ______________________

Filters:
Role
Account Status
Registration Status

----------------------------------------------------------
User          Email          Role       Status      Joined
----------------------------------------------------------
...
```

This is an information architecture, not a pixel-perfect layout mandate.

---

# 50. Default Directory View

The default view should show existing user accounts the Admin is authorized to manage.

It should not default to only pending registrations, because those belong in Account Approval.

---

# 51. Directory Summary Fields

Recommended:

```text
user/account id
display name
email
role
registration status where applicable
account access status
created/joined date
```

For business roles, optionally:

```text
shop name
Logistics organization name
```

where useful.

---

# 52. Search

`Admin.md` explicitly requires:

```text
robust search
```

Search must be server-side.

Recommended searchable fields where available:

```text
name
email
user/account reference
shop name
Logistics organization name
```

Courier-specific search may include Courier reference if the domain has one.

---

# 53. Search by Email

Because the same email may exist under multiple roles, search results must show role clearly.

Example:

```text
alex@example.com
    BUYER
    SELLER
```

The Admin must select the correct account.

---

# 54. Role Filter

Required recommended filter:

```text
BUYER
SELLER
LOGISTICS
COURIER
```

Admin role inclusion depends on the separate Admin-account management decision.

---

# 55. Account Status Filter

Filter by the actual post-registration account-access states implemented by the repository.

Conceptually:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

Do not hardcode these labels if the repository uses different names.

---

# 56. Registration Status Filter

Where useful, allow:

```text
APPROVED
REJECTED
PENDING
```

However, `PENDING` application work should primarily route to Account Approval.

This filter is useful for history/investigation, not as a replacement for the registration workflow.

---

# 57. Date Filters

Optional:

```text
created from
created to
```

or account update dates.

The source does not explicitly require date filtering, but robust filtering supports operational lookup.

---

# 58. Sorting

Recommended default:

```text
newest accounts first
```

Alternative:

```text
name
email
status
created date
```

according to Admin table conventions.

---

# 59. Pagination

User records must be paginated or cursor-based.

Do not load the entire user table into the browser.

---

# 60. User Detail Route

Recommended:

```text
/users/{userId}
```

Because identity is role-scoped, the returned record must include role context.

---

# 61. User Detail Information Architecture

Recommended sections:

```text
Account Summary
Role Profile
Account Status
Registration History
Relevant Activity / History
Restrictions / Suspensions
Related Domain Records
Admin Actions
```

Only data relevant to the user's role should appear.

---

# 62. Account Summary

Recommended:

```text
user id
name/display identity
email
role
created date
last updated
registration status
account access status
```

---

# 63. Role Profile

Role-specific data should be loaded through the appropriate domain relationship.

Examples:

```text
Buyer → Buyer profile
Seller → Seller + Shop
Logistics → Logistics organization
Courier → Courier + associated Logistics
```

Avoid one giant flattened response containing every possible role field.

---

# 64. User History

`Admin.md` explicitly requires:

```text
review user history
```

The exact meaning of "history" is not exhaustively defined.

Recommended history includes administrative/account lifecycle events such as:

```text
registration submitted
registration approved/rejected
profile status changes
suspension
restoration
deactivation
relevant compliance action references
relevant complaint/dispute references
```

Do not interpret "user history" as unrestricted surveillance of all activity.

---

# 65. Role Activity References

Where operationally useful, the detail page may link to existing domain history:

```text
Buyer → Orders
Seller → Shop / compliance history
Logistics → organization
Courier → delivery history
```

These should be links or bounded summaries, not full duplicated modules.

---

# 66. Complaint/Dispute Relationship

A user may be involved in complaints or disputes.

Manage User Accounts may show a high-level count/reference if authorized.

Detailed evidence and adjudication remain in:

```text
Manage Complaints and Disputes
```

---

# 67. Compliance Relationship

A Seller may have compliance warnings or restrictions.

Manage User Accounts may show:

```text
active Seller compliance restriction
compliance case references
```

Detailed product evidence/actions remain in Seller Compliance.

---

# 68. Audit Relationship

Admin mutations on a user account must appear in System Audit Logs.

The User detail page may show a bounded administrative history if useful.

The immutable Audit Log remains the source of truth for Admin action accountability.

---

# 69. Account Status Change

Manage User Accounts must allow authorized Admin intervention.

Source-backed actions include:

```text
temporary suspension
restore access
deactivate
```

Each is consequential and must be validated server-side.

---

# 70. Temporary Suspension

Recommended flow:

```text
Admin opens User
        ↓
select Suspend
        ↓
review identity + role
        ↓
enter reason if policy requires
        ↓
confirm
        ↓
backend validates authorization/current state
        ↓
account restriction applied
        ↓
active sessions/tokens handled according to auth policy
        ↓
related role effects applied
        ↓
audit recorded
```

---

# 71. Suspension Reason

The source does not require a suspension reason field.

However, accountability strongly benefits from one.

If implemented, distinguish:

```text
internal Admin reason
```

from any user-visible message.

Whether a reason is mandatory remains an open decision.

---

# 72. Suspension Duration

The source says:

```text
temporary suspensions
```

but does not define whether they are:

```text
fixed duration
Admin-selected expiration
indefinite until manually restored
```

This is an open decision.

---

# 73. Suspension and Authentication

A suspended user must not retain unrestricted normal access merely because they already have a valid session/token.

The authentication/authorization layer must check account access state.

Exact session revocation strategy is not defined.

Recommended security options include:

```text
revoke active mobile personal access tokens
invalidate sessions where practical
deny requests through account-status middleware
```

The final mechanism should align with web/mobile auth architecture.

---

# 74. Web Session Users

Web roles include:

```text
Buyer/Storefront
Seller
Logistics
```

using Laravel session cookies.

Suspension must be enforced on protected requests even if the browser still holds a session cookie.

---

# 75. Courier Mobile Tokens

Courier mobile uses:

```text
personal_access_tokens
Bearer tokens
```

If a Courier is suspended/deactivated by an authorized platform action, token access must be restricted.

Whether tokens are immediately revoked or merely rejected through status middleware is an implementation decision.

---

# 76. Restore Access

Source-backed action:

```text
restoring access
```

Flow:

```text
Admin opens suspended user
        ↓
select Restore Access
        ↓
confirm
        ↓
backend verifies restore is allowed
        ↓
remove applicable temporary restriction
        ↓
audit action
```

---

# 77. Restore Must Respect Other Restrictions

Restoration in Manage User Accounts must not bypass:

```text
Seller Compliance restriction
Global Ban/Blocklist
unapproved registration
unpaid Logistics subscription if required
Courier Logistics approval requirements
```

Access is the product of multiple domain rules.

---

# 78. Restore Seller

If Seller suspension originated from Seller Compliance, restoration behavior must follow the compliance/account policy.

Do not allow an ordinary account restore action to silently clear a compliance sanction unless authorized.

---

# 79. Restore Logistics

Restoring a Logistics account does not imply:

```text
subscription active
```

Subscription remains a separate requirement.

---

# 80. Restore Courier

Restoring a Courier's platform account does not imply:

```text
Logistics approval restored
online/available status enabled
active delivery assignment
```

Those remain Logistics/Courier domain states.

---

# 81. Deactivate Account

Recommended flow:

```text
Admin selects Deactivate
        ↓
explicit confirmation
        ↓
backend validates account + dependencies + permission
        ↓
account marked inactive/deactivated
        ↓
access blocked
        ↓
role-specific visibility/access consequences applied
        ↓
audit recorded
```

---

# 82. Deactivation Confirmation

The confirmation should show:

```text
user identity
role
impact
```

For Seller/Logistics/Courier accounts, impact may be more significant than for an inactive Buyer.

Do not use an ambiguous one-click destructive icon.

---

# 83. Deactivation and Existing Orders

The source does not define what happens when a user with in-progress Orders is deactivated.

Do not automatically delete/cancel Orders without a separate rule.

Historical and active Order state belongs to the Order domain.

---

# 84. Buyer Deactivation

Potential effects:

```text
Buyer cannot use authenticated account
```

The source does not define whether open orders remain trackable through support/admin mechanisms.

Order records must remain intact.

---

# 85. Seller Deactivation

A deactivated Seller should not continue normal selling activity.

Product visibility should follow the same authoritative Seller-access logic used for suspension/compliance.

Existing Orders must not be silently destroyed.

---

# 86. Logistics Deactivation

A Logistics deactivation can affect active delivery infrastructure.

Exact operational migration/reassignment behavior is not defined.

Before allowing destructive/deactivating action, the system may need to warn about active operational dependencies.

This is an open product rule.

---

# 87. Courier Deactivation

A Courier with an active task should not simply disappear from Logistics operations.

If deactivation is allowed during active work, the Logistics system needs reassignment/incident handling.

The source does not define this workflow.

---

# 88. Delete Account

If hard delete is implemented:

```text
Delete
```

must be more restricted than:

```text
Deactivate
```

Recommended constraints:

- no active operational dependencies
- retention policy allows deletion
- referential integrity preserved
- audit record retained
- personally identifying data handled according to policy

Exact rules are open.

---

# 89. Soft Delete

A soft-delete strategy may satisfy Admin CRUD while preserving relationships.

Example:

```text
deleted_at
```

or domain-equivalent.

Whether soft-deleted users can be restored is a separate decision.

---

# 90. Anonymization

The source does not define account anonymization.

If privacy/data-retention policy later requires it, anonymization should be a dedicated lifecycle action rather than ad-hoc field clearing.

---

# 91. User Profile Edit

Admin profile-edit capability should be limited to fields the Admin is authorized to manage.

Recommended implementation:

```text
role-specific allowlist
```

rather than:

```text
accept arbitrary user payload
```

---

# 92. Buyer Editable Fields

Exact Admin-editable Buyer fields are not defined.

Potential fields should come from the Buyer profile schema.

Do not expose Address Book mutation automatically through general User Management.

---

# 93. Seller Editable Fields

Seller profile includes:

```text
business name
store description
payout details
security credentials
```

Not all should be Admin-editable.

Payout/security fields should require specialized authorization or self-service workflows.

---

# 94. Logistics Editable Fields

Logistics profile includes:

```text
operational details
contact numbers
security credentials
```

Admin may view/update permitted operational metadata if product policy allows.

Do not modify subscription/billing state through generic profile editing.

---

# 95. Courier Editable Fields

Courier profile includes:

```text
vehicle details
license information
payout methods
security credentials
```

`Courier.md` notes sensitive updates may require administrative verification.

However, exact platform Admin vs Logistics authority is not defined.

Generic User Management should not silently take over Logistics' Courier-management responsibility.

---

# 96. PII Classification

The source explicitly warns against compromising restricted PII.

Recommended conceptual classes:

```text
Basic identity
Contact data
Address/location data
Financial/payout data
License/identity data
Authentication/security data
```

Each class should have appropriate exposure rules.

---

# 97. Basic Identity Data

May include:

```text
name
display name
role
account reference
business/shop name
Logistics organization name
```

Generally safe for authorized Admin account management.

---

# 98. Contact Data

May include:

```text
email
phone
```

Show only where necessary.

Do not expose broad contact lists through unprotected exports or endpoints.

---

# 99. Address Data

Buyer addresses and delivery addresses are sensitive.

General user profile views should avoid exposing unnecessary full addresses.

---

# 100. Financial/Payout Data

Seller and Courier account management can contain payout methods.

These should be masked or omitted unless the Admin has a defined need and permission.

---

# 101. License / Vehicle Data

Courier license/vehicle information can be sensitive and operational.

Access should be role/permission-aware.

---

# 102. Authentication Data

Never expose:

```text
password hashes
plaintext passwords
session IDs
Bearer tokens
2FA secrets
recovery codes
```

---

# 103. PII in Search Results

Search-result rows should use minimal identity data.

Do not return full user profiles just to display:

```text
name
email
role
status
```

---

# 104. PII in Logs

Audit/application logs should not store unnecessary PII.

For account updates, audit changed fields carefully.

Avoid logging secret values.

---

# 105. Recommended API — List Users

Conceptual:

```http
GET /api/admin/users
```

Possible query parameters:

```text
search
role
account_status
registration_status
page
per_page
sort
created_from
created_to
```

Exact naming should follow repository conventions.

---

# 106. Recommended User Summary Response

Conceptual:

```json
{
  "id": "user-id",
  "name": "User Name",
  "email": "user@example.com",
  "role": "SELLER",
  "registration_status": "APPROVED",
  "account_status": "ACTIVE",
  "created_at": "timestamp"
}
```

Do not force these exact enums if the repository differs.

---

# 107. Recommended API — User Detail

Conceptual:

```http
GET /api/admin/users/{userId}
```

Requirements:

- Admin authentication
- permission enforcement
- safe account summary
- role profile
- account status
- registration history/status
- bounded relevant history
- active restrictions
- safe related-domain references

---

# 108. Recommended API — Update Profile

Conceptual:

```http
PATCH /api/admin/users/{userId}
```

Backend must:

```text
authorize
resolve role
allowlist editable fields
validate values
preserve unique(email, role)
apply update
audit changed fields
return safe updated record
```

---

# 109. Recommended API — Suspend

Conceptual:

```http
POST /api/admin/users/{userId}/suspend
```

Backend:

```text
authorize high-impact action
validate current account state
validate role/domain constraints
apply authoritative restriction
handle sessions/tokens according to auth policy
trigger role-specific consequences
audit
return updated status
```

---

# 110. Recommended API — Restore

Conceptual:

```http
POST /api/admin/users/{userId}/restore
```

Backend:

```text
authorize
validate current restrictions
ensure restoration does not bypass other active restrictions
apply restoration
audit
return effective account state
```

---

# 111. Recommended API — Deactivate

Conceptual:

```http
POST /api/admin/users/{userId}/deactivate
```

Backend:

```text
authorize high-impact action
validate dependencies
deactivate account
enforce access restriction
audit
return updated state
```

---

# 112. Recommended API — Delete

Only if product policy supports hard deletion.

Conceptual:

```http
DELETE /api/admin/users/{userId}
```

Backend must perform retention/dependency checks.

MVP should prefer deactivation.

---

# 113. Effective Access State

Because several domains may restrict a user, the API may need to distinguish:

```text
account_status
registration_status
compliance restriction
subscription requirement
blocklist/security restriction
role-specific approval
```

Recommended:

```text
effective_access
```

as a derived value, while preserving the underlying reasons.

Do not collapse all states irreversibly into one string.

---

# 114. Restriction Reasons

Recommended detail representation:

```json
{
  "effective_access": "RESTRICTED",
  "restrictions": [
    {
      "source": "SELLER_COMPLIANCE",
      "type": "SUSPENSION"
    }
  ]
}
```

This is conceptual only.

---

# 115. Frontend Directory States

The User Directory must support:

```text
loading
loaded with users
empty
filtered empty
search empty
error
unauthenticated
forbidden
```

---

# 116. User Detail States

The detail view must support:

```text
loading
active
suspended/restricted
deactivated
not found
forbidden
stale/conflict
error
```

---

# 117. Loading Behavior

While loading:

- render Admin shell
- show skeleton rows/detail blocks
- do not render stale profile data from a previously viewed user
- disable status actions until current state is known

---

# 118. Empty State

Example:

```text
No user accounts found.
```

---

# 119. Search Empty State

Example:

```text
No users match your search.
```

---

# 120. Filter Empty State

Example:

```text
No suspended Seller accounts found.
```

---

# 121. Error Handling

Handle:

- directory load failure
- detail load failure
- update failure
- status mutation failure
- stale concurrent status
- duplicate `(email, role)` conflict
- dependency conflict
- expired Admin session
- insufficient permission
- user not found

Never show false success.

---

# 122. Concurrency

Multiple Admins may edit the same account.

Example:

```text
Admin A opens ACTIVE Seller
Admin B opens ACTIVE Seller

Admin A suspends Seller

Admin B attempts profile/status mutation using stale state
```

Backend must revalidate current state and prevent unsafe overwrite.

Use optimistic versioning, timestamps, locks, or state checks consistent with repository architecture.

---

# 123. Idempotency

Repeated status operations should be safe where possible.

Examples:

```text
Suspend already suspended account
Restore already active account
Deactivate already deactivated account
```

Return current state or a clear conflict rather than creating duplicate restriction records.

---

# 124. High-Impact Action Confirmation

Require explicit confirmation for:

```text
Suspend
Deactivate
Delete
```

and potentially:

```text
Restore
```

when restoration has significant security/compliance impact.

---

# 125. Confirmation Context

Show:

```text
user name
email
role
current status
requested action
impact
```

to reduce wrong-account mistakes.

This is particularly important when the same email exists across roles.

---

# 126. Same-Email Warning

If another account with the same email exists under another role, the UI may show:

```text
This email also has other AISLEY role accounts.
This action applies only to SELLER.
```

This is a recommended safety UX.

---

# 127. User Notification of Admin Status Change

The source does not explicitly require emails/messages when Admin suspends/restores/deactivates users.

Do not assume notification channel or template.

A future Admin Messaging/Notification policy may define this.

---

# 128. Session Revocation

The source's auth architecture includes:

```text
web session cookies
mobile personal access tokens
```

Account restriction must be effective even for already-authenticated users.

Possible mechanisms:

```text
request-time account status middleware
session invalidation
token revocation
```

Exact policy is open.

---

# 129. Account Status Middleware

Recommended architecture:

```text
authenticated request
        ↓
resolve user
        ↓
check registration/access state
        ↓
check role/domain restrictions
        ↓
allow or deny request
```

This ensures direct API access cannot bypass the Admin action.

---

# 130. Seller Suspension Cascade

When a Seller's effective access is suspended:

```text
products may need to be hidden
```

per `Admin.md`.

Use shared Seller visibility logic.

Do not manually update product visibility differently in multiple Admin modules.

---

# 131. Logistics Suspension Cascade

No exact cascade is source-defined.

Potential issues include:

```text
active orders
active Couriers
waybills
dispatch
```

These require a separate operational rule.

The User Management UI should warn if active dependencies exist if such checks are available.

---

# 132. Courier Suspension Cascade

No exact cascade is source-defined.

Active tasks must be coordinated with Logistics.

Do not simply remove the Courier record.

---

# 133. Buyer Suspension Cascade

No exact effect on in-progress orders is defined.

The account restriction should not delete Orders.

---

# 134. Account History Timeline

Recommended entries:

```text
account created
registration status changed
profile changed by Admin
suspended
restored
deactivated
compliance restriction linked
relevant account-level administrative action
```

Avoid duplicating all normal user activity.

---

# 135. Admin Actor Metadata

Every Admin mutation should preserve:

```text
performed_by Admin
performed_at
action
target account
previous state
new state
```

through System Audit Logs.

---

# 136. System Audit Logs Integration

`Admin.md` requires:

```text
immutable
time-stamped
who
what changed
when
```

Manage User Accounts must integrate with Audit Logs for:

```text
profile updates
status changes
suspension
restoration
deactivation
deletion
user creation if supported
```

---

# 137. Audit Sensitive Fields

Do not store:

```text
plaintext password
full payout credentials
2FA secrets
session tokens
```

in audit diffs.

For sensitive PII changes, use masked/field-level audit representation if policy requires.

---

# 138. Global Ban / Blocklist Boundary

`Admin.md` defines Global Ban/Blocklist separately for:

```text
fraudulent IPs
flagged payment methods
banned users
```

Manage User Accounts handles account record/status administration.

Do not treat:

```text
account suspended
```

as equivalent to:

```text
globally blocklisted
```

unless a separate security action explicitly adds the user to the blocklist.

---

# 139. Blocklist Reference

A User detail page may show:

```text
Global Ban/Blocklist status/reference
```

if authorized.

Actual blocklist operations belong to Global Ban/Blocklist Management.

---

# 140. Complaints/Disputes Boundary

Complaint resolution may identify an account issue.

The complaint module may link to Manage User Accounts for account-level action.

Do not duplicate full user suspension logic inside Complaints.

---

# 141. Seller Compliance Boundary

Seller Compliance owns policy enforcement evidence and product sanctions.

Manage User Accounts owns general account profile/status administration.

Shared suspension/access services should keep behavior consistent.

---

# 142. Dashboard Integration

The current Dashboard may optionally show aggregate account/user counts.

Manage User Accounts should provide authoritative account aggregates if needed.

Examples:

```text
Approved Buyers
Active Sellers
Active Logistics
```

Exact Dashboard user metrics are optional in the Dashboard spec.

---

# 143. Admin Notifications Integration

Admin Notifications should not generate an alert for every routine user edit.

Potential notification-worthy account events require a separate policy.

Audit Logs remain mandatory for Admin mutations.

---

# 144. CRUD Permission Granularity

AISLEY intends custom Admin permissions.

Conceptually separable permissions:

```text
view users
view sensitive user metadata
edit user profile
suspend user
restore user
deactivate user
delete user
create user
```

Exact permission keys are not defined.

Use shared Admin authorization.

---

# 145. Role-Specific Permissions

The future permission model may also scope by role:

```text
manage Buyers
manage Sellers
manage Logistics
manage Couriers
```

This is not currently specified.

The API should be able to enforce whatever shared policy model is chosen.

---

# 146. Sensitive Field Permission

Some fields may require stronger permission than general profile view.

Examples:

```text
Courier license
Seller payout method
Buyer address
Logistics private contact info
```

Field-level authorization may be needed.

Exact implementation is open.

---

# 147. User Export

`Admin.md` does not specify user-directory exports.

Do not include CSV/PDF user export in MVP unless separately requested.

---

# 148. Bulk Actions

The source does not define bulk suspension/deactivation.

For MVP:

```text
do not require bulk destructive account actions
```

Individual confirmation is safer.

---

# 149. Bulk Search/Selection

Bulk selection may be added later for non-destructive operations, but is not required.

---

# 150. Accessibility

The interface should:

- use semantic table/list structure
- identify role and status with text, not color only
- provide accessible search/filter controls
- use accessible confirmation dialogs
- preserve keyboard focus after mutations
- announce success/failure
- avoid ambiguous icon-only destructive actions
- maintain sufficient contrast

---

# 151. Responsive Behavior

Desktop is primary.

On narrower screens:

- table may become stacked rows/cards
- identity, role, and account status remain visible
- actions remain accessible
- long email/IDs wrap safely
- PII is not exposed simply because mobile layout collapses columns

---

# 152. Performance

The directory must:

- use server-side search
- paginate
- index frequent filters
- avoid N+1 role-profile queries
- avoid returning full history in list responses
- lazy-load detailed history
- avoid counting large related collections per row unnecessarily

---

# 153. Recommended Indexing

Frequent shared-user filters suggest indexes around:

```text
role
account/access status
registration status
created_at
email
```

while preserving:

```text
unique(email, role)
```

Exact schema/indexes depend on repository design.

---

# 154. Search Performance

Email search should respect the composite identity model.

Name/business search may require joins or indexed role-specific fields.

Do not fetch all users and filter in React.

---

# 155. History Loading

Load account history separately or as a bounded recent timeline.

Do not embed the user's entire lifetime Order/Message/Review history into the initial detail response.

---

# 156. Security Requirements

All Manage User Accounts endpoints must:

- require authenticated Admin
- enforce feature/action permission
- validate user/role identity
- preserve `(email, role)` uniqueness
- use allowlisted update fields
- prevent mass assignment
- protect PII
- protect auth/security data
- validate account state transitions
- enforce restrictions server-side
- use CSRF protection for state-changing Admin web requests
- prevent IDOR
- audit mutations
- prevent cross-role accidental changes
- protect related domain records
- preserve referential integrity

---

# 157. No Client-Only Suspension

Suspending a user must not simply:

```text
hide menus
```

The backend must reject unauthorized restricted operations.

---

# 158. No Role Mutation by Client

The frontend must not be able to change:

```text
role
```

through a generic profile update unless a future explicit role-conversion workflow exists.

---

# 159. No Direct Security Secret Editing

Generic Admin user update endpoints must not accept:

```text
password_hash
remember_token
personal_access_tokens
2fa_secret
```

---

# 160. Money/Financial Data Boundary

Manage User Accounts may show links/status references but should not mutate:

```text
Seller balances
Courier earnings
Logistics subscription charges
platform commission
```

Those belong to financial domains.

---

# 161. Order Data Boundary

User Management should not mutate Order lifecycle states.

If an account action affects active Orders, use a defined Order/Logistics workflow rather than editing statuses directly.

---

# 162. Messaging Data Boundary

User Management may show support/contact links.

It should not expose all private message histories by default.

Detailed messaging access belongs to Chat/Messaging or Complaints context.

---

# 163. Audit Failure

`Admin.md` says audit writes should occur asynchronously without failing the primary request.

Follow the shared audit architecture.

The system should still reliably persist audit events through queue/outbox/retry mechanisms.

---

# 164. Status Mutation Transaction

Recommended conceptual pattern:

```text
begin transaction
validate user + role
validate current state
apply account status/restriction
apply required shared-domain state
commit

dispatch audit/event work
```

Role-specific large cascades may be asynchronous where safe, but access restriction should become authoritative immediately.

---

# 165. Soft Cascade

Where possible, use authoritative access-state checks rather than updating thousands of related rows synchronously.

Example Seller suspension:

```text
seller restricted
    ↓
product queries check seller restriction
```

Search indexes/caches may still need asynchronous updates.

---

# 166. Search Index Updates

If Buyer marketplace product search uses an external index, Seller suspension/deactivation may require de-indexing/hiding Seller listings.

That behavior belongs to shared Seller/product visibility enforcement.

---

# 167. Effective Status UI

Because multiple state dimensions can exist, the Admin UI should not show one misleading badge.

Recommended display:

```text
Registration: APPROVED
Account: SUSPENDED
Seller Compliance: Restricted
```

where relevant.

---

# 168. Status Reason UI

If a restriction has a source/reason, show it to authorized Admins.

Example:

```text
Suspended
Source: Seller Compliance
```

This helps prevent accidental restoration.

---

# 169. Account Restore Confirmation

Before restore, show active restrictions.

Example:

```text
Account suspension can be restored.

Seller Compliance restriction remains active.
```

The system should compute actual resulting access state before confirmation if practical.

---

# 170. Deactivation Warning for Related Records

If the user has active operational dependencies, the UI may show a warning.

Examples:

```text
Seller has open orders
Logistics has active shipments
Courier has active delivery
```

Exact blocking/warning rules are open.

---

# 171. User Creation Acceptance Boundary

If Admin Create User is implemented, it must preserve:

```text
unique(email, role)
```

and must not use email uniqueness alone.

---

# 172. User Creation Password Boundary

If Admin creates a user, the source does not define credential provisioning.

Do not generate or expose a plaintext password without a defined secure onboarding flow.

---

# 173. User Deactivation and Same Email

Deactivating:

```text
foo@example.com + SELLER
```

does not deactivate:

```text
foo@example.com + BUYER
```

unless explicitly selected.

---

# 174. User Deletion and Same Email

Deleting one role identity must not delete other role identities sharing the email.

---

# 175. Session/API Access Check

Every protected role API should eventually have access to:

```text
effective account access status
```

to enforce Admin interventions.

This is cross-cutting middleware/service behavior.

---

# 176. Account Status Cache

If account status is cached, suspension/deactivation must invalidate that cache quickly enough to make the restriction effective.

Exact caching rules are architecture-specific.

---

# 177. Admin Feedback

After mutation, show clear feedback:

```text
User suspended.
Access restored.
Account deactivated.
Profile updated.
```

Do not show success before server confirmation.

---

# 178. Audit Link

After a status change, the UI may expose:

```text
View audit history
```

if Audit Logs UI exists and the Admin has permission.

Optional.

---

# 179. MVP Scope

## Required for MVP

- Admin-only User Directory
- Buyer accounts
- Seller accounts
- Logistics accounts
- Courier accounts
- role-aware identity
- server-side search
- role filter
- account status filter
- registration status visibility/filter where implemented
- pagination
- user detail
- role-specific profile summary
- safe PII handling
- account history summary
- temporary suspension
- restore access
- deactivation
- backend account-state enforcement
- audit logging for mutations
- Seller Compliance suspension compatibility
- Seller product visibility compatibility
- Logistics subscription-state separation
- Courier Logistics-approval separation
- loading states
- empty states
- error states
- permission-aware actions
- concurrency protection

## Conditional / Product Decision

- Admin-side Create User
- hard Delete User
- direct Admin profile edits for sensitive fields
- suspension duration
- user notification after status action
- active-session revocation
- role-specific restriction cascades
- field-level PII permissions

## Not Required for MVP

- bulk suspension
- bulk deletion
- role conversion
- password setting by Admin
- account impersonation
- account takeover/debug login
- user export
- KYC
- fraud scoring
- automated bans
- payout editing
- direct financial balance editing
- direct order-state editing
- Admin-account permission management
- privacy anonymization workflow
- legal deletion automation

---

# 180. Functional Acceptance Criteria

## AC-01 — Admin Access

Given an authorized authenticated Admin, when Manage User Accounts is opened, the Admin can access the User Directory.

## AC-02 — Guest Denied

Given no Admin session exists, user-management endpoints are inaccessible.

## AC-03 — Permission Denied

Given an Admin lacks User Management permission, protected user data/actions are denied by the backend.

## AC-04 — Buyer Listed

Given a Buyer account exists, it can appear in the User Directory according to filters/permissions.

## AC-05 — Seller Listed

Given a Seller account exists, it can appear in the User Directory.

## AC-06 — Logistics Listed

Given a Logistics account exists, it can appear in the User Directory.

## AC-07 — Courier Listed

Given a Courier account exists, it can appear in the User Directory even though Courier registration approval is owned by Logistics.

## AC-08 — Courier Approval Boundary

Given a Courier account is viewed, Manage User Accounts does not redefine platform Admin as the normal Courier registration approver.

## AC-09 — Same Email Multiple Roles

Given the same email belongs to Buyer and Seller accounts, both appear as distinct role-scoped identities.

## AC-10 — Search by Email

Given the same email exists under multiple roles, email search returns each matching role account clearly rather than merging them.

## AC-11 — Role Filter

Given multiple roles exist, Admin can filter accounts by role.

## AC-12 — Status Filter

Given accounts have different access states, Admin can filter using the repository's account-status values.

## AC-13 — Pagination

Given many users exist, the API returns bounded paginated/cursor results.

## AC-14 — User Detail

Given a user exists, authorized Admin can inspect safe account/profile information and role context.

## AC-15 — PII Protection

Given User Detail is loaded, password hashes, tokens, 2FA secrets, and unrelated sensitive financial/profile data are not exposed.

## AC-16 — Seller Payout Protection

Given Seller account detail is loaded, full payout/banking credentials are not included by default.

## AC-17 — Buyer Address Protection

Given Buyer account detail is loaded, unrelated full shipping-address history is not exposed by default.

## AC-18 — Courier Sensitive Data Protection

Given Courier account detail is loaded, sensitive license/payout data is permission-minimized.

## AC-19 — Suspend User

Given an authorized Admin selects an eligible active account, the backend can apply a temporary suspension.

## AC-20 — Suspension Enforced Server-Side

Given an account is suspended, normal protected operations are denied according to account-access rules even if the user has an existing frontend session/token.

## AC-21 — Restore User

Given an eligible temporary account suspension exists, authorized Admin can restore that restriction.

## AC-22 — Restore Does Not Bypass Other Restriction

Given a Seller has both account suspension and Seller Compliance restriction, restoring only the account suspension does not clear the compliance restriction.

## AC-23 — Deactivate User

Given an authorized Admin deactivates an eligible account, normal account access is blocked and the record remains available according to retention rules.

## AC-24 — Historical Data Preserved

Given a user is deactivated, historical Orders, Reviews, Messages, delivery history, and audit references are not blindly deleted.

## AC-25 — Seller Product Enforcement

Given an effective Seller suspension requires product hiding, Buyer marketplace/product APIs respect the shared Seller restriction.

## AC-26 — Vacation Mode Separation

Given Seller is suspended and in Vacation Mode, restoring the account does not silently turn off Vacation Mode.

## AC-27 — Logistics Subscription Separation

Given a Logistics account is restored/active, that does not automatically mark its subscription paid/active.

## AC-28 — Courier Logistics Approval Separation

Given a Courier's platform account access is restored, that does not automatically change the Courier's Logistics approval/assignment state unless the owning Logistics workflow defines it.

## AC-29 — No Role Mutation

Given a generic profile update is submitted, the backend does not convert Buyer/Seller/Logistics/Courier role through an ordinary user edit.

## AC-30 — Composite Email Uniqueness

Given Admin edits an email, the backend enforces `unique(email, role)` and permits the same email in another role where allowed.

## AC-31 — Cross-Role Update Isolation

Given Admin updates the Seller account for an email shared with a Buyer account, the Buyer account is unchanged.

## AC-32 — Profile Update Allowlist

Given an Admin updates a profile, only explicitly authorized fields can be changed.

## AC-33 — No Secret Update

Given a generic user update payload contains `password_hash` or token fields, those fields are rejected/ignored according to secure validation.

## AC-34 — Mutation Audit

Given Admin changes user profile/status, the System Audit Log records actor, target, action/change, and timestamp.

## AC-35 — Stale State Protection

Given two Admins edit the same account concurrently, a stale destructive/status mutation does not silently overwrite a newer authoritative state.

## AC-36 — Idempotent Suspension

Given an account is already suspended, duplicate suspend requests do not create inconsistent duplicate restrictions.

## AC-37 — Deactivation Confirmation

Given an Admin attempts deactivation, the UI requires deliberate confirmation identifying the account and role.

## AC-38 — Same-Email Confirmation Safety

Given an email exists under multiple roles, a destructive/status action clearly applies to only the selected role/account.

## AC-39 — Registration Separation

Given an account is `PENDING`, the primary workflow for approving/rejecting registration remains Account Approval.

## AC-40 — Rejected Registration Not Restored as Active

Given a registration was rejected, Manage User Accounts does not silently convert it into an approved active account through ordinary "Restore Access" unless a specific reversal workflow is defined.

## AC-41 — No Direct Order Mutation

Given Admin suspends/deactivates a user, Manage User Accounts does not arbitrarily rewrite Order lifecycle statuses.

## AC-42 — No Direct Financial Mutation

Given Admin edits a user, the module does not directly alter Seller balances, Courier earnings, Logistics subscription charges, or platform commission.

## AC-43 — No Blocklist Equivalence

Given a user is suspended, the user is not automatically added to the Global Ban/Blocklist unless a separate security action does so.

## AC-44 — Directory Minimal Payload

Given the User Directory loads, list responses contain summary fields rather than full role profiles/history.

## AC-45 — History Bounded

Given User Detail loads, relevant history is bounded/paginated and does not load the user's entire lifetime platform activity by default.

## AC-46 — Error Safety

Given a status/profile mutation fails, the UI does not display false success.

## AC-47 — Not Found

Given a user no longer exists/is inaccessible, the detail route presents a safe not-found/unavailable state without leaking sensitive data.

## AC-48 — Admin Account Boundary

Given an Admin account exists, ordinary user-management actions do not bypass the dedicated Admin/permission lifecycle defined for administrator accounts.

---

# 181. Suggested Backend Tests

Test:

- guest cannot list users
- non-Admin cannot list users
- permission-restricted Admin cannot manage users
- Buyer appears in directory
- Seller appears in directory
- Logistics appears in directory
- Courier appears in directory
- role filter works
- account status filter works
- registration status filter works if implemented
- search by name works
- search by email works
- same email across roles returns separate accounts
- list is paginated
- user detail returns safe role profile
- user detail excludes password hash
- user detail excludes session/token secrets
- Buyer address PII is minimized
- Seller payout details are minimized
- Courier payout/license data is permission-controlled
- Admin can suspend eligible account
- suspended account denied by shared access middleware
- suspended web user remains restricted despite existing session
- suspended mobile Courier remains restricted despite token
- Admin can restore eligible account
- restoration preserves unrelated active restrictions
- Seller Compliance restriction survives unrelated restore
- Seller suspension hides products through authoritative product visibility
- Seller Vacation Mode remains independent
- Admin can deactivate eligible account
- deactivation blocks access
- deactivation preserves historical references
- role cannot be changed through generic update
- email update respects `(email, role)` uniqueness
- Seller update does not affect same-email Buyer
- generic update rejects protected fields
- mutation creates audit record
- duplicate suspend is safe
- stale concurrent status update is rejected/conflicted
- Logistics account active status does not imply active subscription
- Courier account status does not rewrite Logistics approval state
- user management does not mutate financial values
- user management does not arbitrarily mutate Order status
- rejected registration cannot be restored into active access through ordinary restore without defined workflow
- hard delete is disabled/restricted if retention rules are not defined

---

# 182. Suggested Frontend Tests

Where frontend testing infrastructure exists, test:

- User Directory loads
- loading state renders
- empty state renders
- search sends correct query
- role filter sends correct query
- account status filter sends correct query
- pagination works
- same-email accounts show distinct roles
- user detail shows account role/status
- sensitive fields are not rendered
- Seller detail links Shop/compliance context where available
- Logistics detail distinguishes subscription status
- Courier detail identifies associated Logistics
- suspend action requires confirmation
- restore action requires confirmation where configured
- deactivate action requires confirmation
- action buttons disable during mutation
- failed mutation does not show success
- stale conflict refreshes/shows current state
- role cannot be edited through generic form
- same-email role warning/context renders where implemented
- restricted Admin actions are hidden/disabled
- backend forbidden response is still handled safely
- narrow viewport directory/detail remains usable

---

# 183. Open Decisions

The current AISLEY documents do not define:

1. exact post-registration account status enum
2. whether `ACTIVE`, `SUSPENDED`, `DEACTIVATED` are the final names
3. whether account access status is stored on `users` or role profiles
4. whether Admin can directly create users
5. whether Admin-created users bypass registration approval
6. whether Admin-created users receive invitations
7. credential setup for Admin-created users
8. whether Admin can directly change user email
9. whether email changes require re-verification
10. whether Admin can change user phone
11. whether Admin can trigger password reset
12. whether Admin can directly set passwords
13. suspension reason requirements
14. suspension reason categories
15. suspension duration
16. automatic suspension expiration
17. whether restore requires a reason
18. whether restore requires elevated permission
19. whether Seller Compliance suspension can be restored from User Management
20. multiple simultaneous restriction representation
21. whether all restrictions use one shared table/service
22. whether suspended web sessions are invalidated immediately
23. whether mobile personal access tokens are revoked immediately
24. whether all active sessions/devices are listed
25. whether Admin can force logout
26. exact Buyer fields visible to Admin
27. exact Buyer fields editable by Admin
28. exact Seller fields visible to Admin
29. exact Seller fields editable by Admin
30. exact Logistics fields visible to Admin
31. exact Logistics fields editable by Admin
32. exact Courier fields visible to platform Admin
33. exact Courier fields editable by platform Admin vs Logistics
34. PII field-level permission model
35. whether payout details are ever viewable by Admin
36. whether license information is viewable by platform Admin
37. hard delete policy
38. soft-delete policy
39. anonymization policy
40. data-retention periods
41. legal deletion requirements
42. whether deactivated accounts can be reactivated
43. whether soft-deleted accounts can be restored
44. whether email can be reused in same role after deletion
45. behavior of open Buyer orders after suspension/deactivation
46. behavior of open Seller orders after suspension/deactivation
47. behavior of active Logistics shipments after suspension/deactivation
48. behavior of active Courier tasks after suspension/deactivation
49. whether Logistics deactivation cascades to Courier access
50. whether Seller deactivation hides all listings exactly like compliance suspension
51. whether shop page remains visible for deactivated Seller
52. how reviews/history display after Seller deactivation
53. whether Buyer reviews remain after Buyer deactivation
54. whether messages remain accessible after deactivation
55. whether User Directory includes Admin accounts
56. if Admin accounts are included, which actions are permitted
57. partner/admin account-management workflow
58. exact Admin permission keys
59. role-scoped Admin permissions
60. whether field-level permissions exist
61. whether suspension/restoration sends email
62. whether suspension/restoration sends in-app message
63. whether deactivation notifies user
64. whether account status changes create Admin Notifications
65. whether User Directory export is needed
66. whether bulk actions are needed
67. whether user history includes login history
68. whether user history includes security events
69. whether user history includes all Orders or only summaries
70. whether account-change history is shown from Audit Logs
71. whether Admin can add internal notes to user profiles
72. note retention/visibility
73. exact API route names
74. exact user summary DTO
75. exact role-profile DTO boundaries
76. exact pagination convention
77. search indexing strategy
78. whether search supports phone
79. whether search supports shop name
80. whether search supports Logistics organization name
81. whether search supports Courier ID
82. whether status changes are blocked by active operational dependencies
83. whether active dependency checks are warnings or hard blocks
84. whether delete requires second confirmation
85. whether high-risk actions require 2FA/re-authentication
86. whether account impersonation is ever allowed
87. whether Admin can reset 2FA
88. whether Admin can view login/session history
89. whether blocked users appear differently from suspended users
90. relationship between User Management and Global Ban/Blocklist UI

These decisions should be defined as the account lifecycle, privacy policy, and shared authorization model mature.

---

# 184. Source Traceability

## From `Admin.md`

Manage User Accounts directly derives:

```text
Core Value:
View user profiles, updates status of accounts.

Expanded:
comprehensive data management interface
full CRUD
Create
Read
Update
Delete/Deactivate
granular profile details
review user history
manually intervene
temporary suspensions
restore access

System:
robust search
filtering endpoints
secure user metadata
protect restricted PII
```

It also integrates with:

```text
Monitor Seller Compliance
Manage Complaints and Disputes
System Audit Logs
Global Ban/Blocklist Management
```

while remaining separate from:

```text
Account Management
    Admin's own settings
```

---

## From `app.md`

The account model derives:

```text
Buyer
Seller
Logistics
Courier
Admin

all roles share users table

unique(email, role)
```

Registration ownership:

```text
Buyer → Admin approval
Seller → Admin approval
Logistics → Admin approval
Courier → Logistics approval
Admin → bootstrap/additional Admin permissions flow
```

Auth architecture:

```text
web roles → stateful HttpOnly sessions
mobile Courier → Bearer personal access tokens
```

This affects how account suspension must be enforced.

---

## From `Buyer.md`

Buyer account context includes:

```text
Account Management
core profile details
security credentials
notification preferences
Address Book
Orders
Reviews
```

The Admin feature must protect private Buyer data and avoid unnecessary address exposure.

---

## From `Seller.md`

Seller account context includes:

```text
Account Management
business name
payout details
store description
security credentials
```

Seller also owns:

```text
products
inventory
orders
shop
Vacation Mode
```

The Admin feature must preserve the distinction between:

```text
account suspension
Seller Compliance restriction
Vacation Mode
```

and protect sensitive payout information.

---

## From `Logistics.md`

Logistics account context includes:

```text
operational details
contact numbers
security credentials
```

Logistics owns:

```text
dispatch
Couriers
vehicles
waybills
capacity monitoring
```

User Management may change account access but must not become the Logistics operational console.

---

## From `Courier.md`

Courier account context includes:

```text
vehicle details
license information
payout methods
security credentials
```

Courier registration/approval belongs to Logistics.

Courier also has:

```text
active delivery tasks
delivery history
e-POD
incident reporting
```

which means platform-level suspension/deactivation must preserve operational/history integrity and cannot simply delete Courier records.

---

# 185. Final Feature Definition

AISLEY Manage User Accounts is:

```text
an Admin-only
role-aware user administration system

for:

    Buyer
    Seller
    Logistics
    Courier

that allows authorized Admins to:

    search users
    filter users
    view safe profiles
    review account history
    update permitted metadata
    temporarily suspend access
    restore access
    deactivate accounts
    delete only when retention rules explicitly allow it

while preserving:

    unique(email, role)
    registration history
    role-specific domain state
    Orders
    Shops
    Logistics records
    Courier delivery history
    Messages
    Reviews
    Audit Logs

and integrating with:

    Account Approval
    Seller Compliance
    Complaints & Disputes
    System Audit Logs
    Global Ban/Blocklist

without replacing:

    registration approval
    Seller product enforcement
    Logistics operations
    Courier approval
    financial systems
    Admin account/permission management.
```

The central design rule is:

```text
Account Approval decides
whether a new role-account may enter AISLEY.

Manage User Accounts controls
the ongoing lifecycle and access
of existing user accounts.

Seller Compliance may impose
Seller-specific restrictions.

Global Ban/Blocklist handles
platform security blocks.

All of them must share
authoritative account-access enforcement
without overwriting each other's state.
```
