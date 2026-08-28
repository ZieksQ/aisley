---
feature: Global Ban / Blocklist Management
system: AISLEY
type: Feature Specification
version: 2.1
status: Draft
scope: Admin Web Application / Shared Security Enforcement
source_coverage: Admin.md, app.md, current AISLEY Admin feature specifications
---

# Global Ban / Blocklist Management Specification

## 1. Purpose

Global Ban / Blocklist Management is AISLEY's centralized security feature for maintaining malicious or prohibited identifiers and blocking matching access or transaction attempts.
`Admin.md` defines three source-backed categories:

```text
fraudulent IP addresses
flagged payment methods
banned users
```

It also requires:

```text
high-performance checks
especially for IP/payment methods
on almost every incoming request
or transaction attempt
```

This file defines requirements, boundaries, data rules, Admin APIs, security controls, acceptance criteria, and Open Decisions. Runtime sequences are in `flow.md`.

## 2. Core Block Types

MVP block types:

```text
USER
IP_ADDRESS
PAYMENT_METHOD
```

Do not silently add:

```text
device fingerprint
email
phone
shipping address
country
browser fingerprint
```

without new requirements.

## 3. Responsibilities

The feature owns:

- user-ban records
- blocked-IP records
- blocked payment-method records
- Admin add/view/disable operations
- fast runtime matching
- shared Blocklist service/middleware
- duplicate prevention
- Audit Log integration
- safe reason/source references
- cache/index synchronization where used
  It does not own:
- normal account suspension/restoration
- registration rejection
- Seller Compliance sanctions
- complaint decisions
- order cancellation/refund
- payment-provider fraud scoring
- automatic AI fraud detection
- Logistics/Courier operational recovery

## 4. Primary Actor

Management actor:

```text
ADMIN
```

Runtime enforcement actor:

```text
shared AISLEY security layer
```

An authorized Admin may:

- list/search/filter entries
- add user bans
- add IP blocks
- add payment-method blocks
- inspect safe entry details
- disable an active entry
- reactivate an entry if supported
  Exact permission keys are Open Decisions.

## 5. Boundary — Manage User Accounts

Keep these states separate:

```text
Manage User Accounts
    suspension / restoration / deactivation

Global Ban / Blocklist
    security-level user ban
    fraudulent IP
    flagged payment method
```

Rules:

- restoring an account does not clear Global Ban
- disabling Global Ban does not restore an independently suspended account
- account status and security block can coexist

## 6. Boundary — Account Approval

Registration states:

```text
PENDING
APPROVED
REJECTED
```

are not blocklist states.
Rules:

- rejected registration is not automatically a ban
- banned user is not automatically `REJECTED`
- approval/rejection must not implicitly add/remove Global Ban

## 7. Boundary — Seller Compliance

Seller Compliance may warn, suspend, audit, or remove listings.
Rules:

- compliance suspension is separate from Global Ban
- unbanning does not clear compliance restrictions
- compliance cases do not auto-ban unless future policy explicitly adds that behavior

## 8. Boundary — Complaints & Disputes

A complaint may provide evidence supporting a separate security action.
Recommended:

```text
Complaint
→ explicit "Create Blocklist Entry"
→ prefill safe case reference
→ Admin reviews
→ Admin confirms
```

Complaint resolution itself must not silently ban/unban.

## 9. Identity Rule

AISLEY uses:

```text
unique(email, role)
```

Example:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

User bans must target:

```text
user_id
```

with role context.
Do not ban by email alone.

## 10. Same Email Across Roles

Banning:

```text
Seller user_id = 123
```

must not automatically ban:

```text
Buyer user_id = 456
```

even if both accounts share the same email.
Cross-role person-wide bans are not currently defined.

# User Ban

## 11. User Ban Definition

A `USER` entry blocks a specific AISLEY role-account according to the shared enforcement policy.
Minimum identifier:

```text
user_id
```

Recommended Admin display:

- name
- role
- masked email
- stable user ID where useful

## 12. Existing Session / Token

A user already authenticated must not bypass a newly active ban.
Web:

```text
Sanctum session
```

Mobile:

```text
Bearer personal access token
```

Both remain subject to backend block checks on subsequent protected requests.
Actual session/token revocation is Open.

## 13. Role-Specific Operational Effects

The source does not define downstream operational recovery after a user ban.
Open examples:

- Buyer with in-flight order
- Seller with existing orders/listings
- Logistics with active shipments
- Courier with active task
  Global Ban should deny protected access, but should not silently rewrite unrelated order/financial records.

## 14. Admin Ban

Whether `ADMIN` role-accounts can be globally banned through this feature is not defined and requires separate governance.

# IP Block

## 15. IP Purpose

`IP_ADDRESS` entries represent known fraudulent IP addresses.
Active IP blocks should be checked on incoming requests according to configured middleware scope.

## 16. IP Validation

Minimum support:

```text
IPv4
IPv6
```

Requirements:

- reject malformed input
- normalize deterministically
- compare canonical values
- prevent duplicate active equivalents

## 17. CIDR / Range

The source says "IP addresses", not networks/ranges.
Therefore minimum requirement:

```text
exact IP match
```

CIDR/subnet/range support is Open.

## 18. Trusted Proxy Rule

Do not blindly trust arbitrary:

```text
X-Forwarded-For
```

Client IP resolution must use trusted proxy configuration appropriate to deployment.

## 19. Shared IP Risk

An IP may represent many legitimate users behind:

- NAT
- office network
- carrier-grade NAT
- public Wi-Fi
- VPN
  IP blocks should therefore be deliberate and auditable.
  Exact false-positive handling is Open.

## 20. Middleware Scope

`Admin.md` says block checks run on almost every incoming request.
Exact exceptions may include:

- health checks
- internal callbacks
- provider webhooks
- static assets
- emergency recovery routes
  Exact route scope is Open.

# Payment Method Block

## 21. Payment Purpose

`PAYMENT_METHOD` entries represent flagged payment methods that should stop applicable transaction attempts.

## 22. Sensitive Payment Data

Never store as blocklist identifiers:

```text
full card number
CVV
OTP
bank password
```

Use provider-safe values such as:

```text
payment token
provider fingerprint
provider reference
masked identifier
```

depending on actual payment architecture.

## 23. Provider Dependency

Current AISLEY sources do not define the payment provider or fingerprint model.
Therefore:

```text
exact payment identifier format = Open Decision
```

The system may only store identifiers that are safe and reliably comparable.

## 24. Backend Transaction Check

The authoritative block check must occur on the backend transaction path.
Conceptually:

```text
payment attempt
→ derive safe identifier
→ BlocklistService check
→ blocked?
   yes → deny
   no  → continue
```

A frontend-only checkout check is insufficient.

## 25. Historical Payment Integrity

Adding a payment block controls future/applicable attempts.
It must not rewrite completed historical transactions.

## 26. COD

Cash-on-Delivery block behavior is not defined and remains Open.

# Entry Lifecycle

## 27. Recommended Status

The source does not define lifecycle enums.
Recommended:

```text
ACTIVE
INACTIVE
```

or equivalent.
`ACTIVE` participates in enforcement.
`INACTIVE` does not participate in enforcement but remains for history.

## 28. Hard Delete

Hard deleting historical blocklist records is not recommended.
Prefer:

```text
disable / deactivate
```

to preserve accountability.

## 29. Expiry

The source does not define:

```text
temporary bans
expires_at
automatic expiry
```

These remain Open.

## 30. Reason and Source

Recommended fields:

```text
reason
source_type
source_id
```

Possible source references:

- complaint case
- Seller Compliance case
- security investigation
  Prefer references over copied evidence.

## 31. Actor Metadata

Recommended:

```text
created_by_admin_id
created_at
disabled_by_admin_id
disabled_at
```

## 32. Duplicate Active Entry

Prevent equivalent active duplicates:

```text
USER
    same user_id

IP_ADDRESS
    same canonical IP

PAYMENT_METHOD
    same provider + safe fingerprint/reference
```

## 33. Reactivation

If a matching inactive historical entry exists, reactivation may be supported instead of creating another record.
Not source-required.

# Runtime Enforcement

## 34. Central Service

Recommended conceptual service:

```text
BlocklistService

isUserBlocked(userId)
isIpBlocked(ip)
isPaymentMethodBlocked(provider, identifier)
```

Exact class names are implementation-specific.

## 35. Middleware Strategy

Recommended:

```text
IP check
    high-level middleware

User check
    after authenticated identity is available

Payment check
    near payment/transaction service
```

Avoid scattering manual block checks across controllers.

## 36. Request Evaluation

Conceptually:

```text
incoming request
→ resolve trusted IP
→ IP blocked?
   yes → deny
   no  → continue

if authenticated:
→ user blocked?
   yes → deny
   no  → authorization/business logic
```

## 37. Payment Evaluation

Conceptually:

```text
transaction attempt
→ safe provider identifier available
→ payment block check
→ allow or deny
```

## 38. Blocked Response

Return a safe generic denial.
Do not reveal:

- internal reason
- Admin creator
- linked evidence
- fraud rules
- payment fingerprint
- security notes

## 39. No Public Security Oracle

Do not expose public endpoints such as:

```text
/is-this-ip-blacklisted
/is-this-payment-blocked
```

that allow attackers to probe internal security lists.

# Performance

## 40. Performance Requirement

The source explicitly requires high-performance matching because checks may run on almost every request/transaction attempt.
Runtime lookups must avoid:

- broad scans
- unnecessary joins
- loading the entire blocklist per request
- controller-by-controller custom queries

## 41. Recommended Architecture

```text
durable Blocklist store
→ optimized index/cache
→ BlocklistService / middleware
```

Database remains authoritative.

## 42. Cache Rule

Critical:

```text
cache = acceleration
database = source of truth
```

Cache loss must not erase security state.

## 43. Cache Invalidation

Admin mutations should promptly update/invalidate relevant cached keys.
Examples:

```text
add
disable
reactivate
```

## 44. Database Fallback

Recommended:

```text
cache unavailable
→ database fallback
```

where feasible.

## 45. Fail-Open / Fail-Closed

The source does not define behavior if blocklist infrastructure is unavailable.
The project must decide separately for:

- user checks
- IP checks
- payment checks
  This is a major security/availability decision.

## 46. Indexing

Runtime lookup fields should be indexed.
Examples:

```text
active user_id
active canonical IP
active provider + payment identifier
```

## 47. Performance SLO

The source says high-performance but provides no concrete latency/throughput target.
Exact SLO remains Open.

# Admin UI

## 48. Recommended Route

```text
/security/blocklist
```

or:

```text
/blocklist
```

## 49. List

Recommended columns:

```text
Type
Identifier
Role / Provider
Status
Reason
Created By
Created At
```

Payment values must remain masked/provider-safe.

## 50. Filters

Recommended:

```text
All
Users
IP Addresses
Payment Methods
```

Additional:

```text
status
creator
date
```

## 51. Search

Possible:

- user name
- user email
- user ID
- IP address
- masked payment reference
- entry ID
  If searching by email, always show role.

## 52. Pagination

Blocklist lists must be paginated/bounded.

## 53. Add User Ban UI

Select an exact role-account.
Show:

```text
name
role
masked email
```

Do not target email alone.

## 54. Add IP UI

Require a valid IPv4/IPv6 value.
Normalize before persistence.

## 55. Add Payment UI

Require only provider-safe identifiers.
Never request:

```text
CVV
OTP
bank password
full card number
```

## 56. Confirmation

Block/unblock actions are high-impact.
Recommended confirmation shows:

```text
Type
Target
Reason
Source reference
Expected security effect
```

## 57. Duplicate UI

If an active equivalent already exists:

```text
This target is already blocked.
```

Link to the existing entry.

## 58. Disable UI

Prefer:

```text
Disable Block
```

over hard delete.
The UI should explain that independent suspension/compliance restrictions remain unchanged.

## 59. Detail View

Recommended:

- entry ID
- block type
- safe target
- status
- reason
- source reference
- creator/time
- disabled actor/time
- Audit Log reference

# API

## 60. List / Detail

Conceptual:

```http
GET /api/admin/security/blocklist
GET /api/admin/security/blocklist/{entryId}
```

## 61. Add User

Conceptual:

```http
POST /api/admin/security/blocklist/users
```

```json
{
  "user_id": "user-id",
  "reason": "...",
  "source_type": "...",
  "source_id": "..."
}
```

## 62. Add IP

Conceptual:

```http
POST /api/admin/security/blocklist/ip-addresses
```

```json
{
  "ip_address": "203.0.113.10",
  "reason": "..."
}
```

## 63. Add Payment

Conceptual:

```http
POST /api/admin/security/blocklist/payment-methods
```

Illustrative only:

```json
{
  "provider": "provider-name",
  "fingerprint": "safe-provider-value",
  "reason": "..."
}
```

## 64. Disable / Reactivate

Conceptual:

```http
POST /api/admin/security/blocklist/{entryId}/disable
POST /api/admin/security/blocklist/{entryId}/reactivate
```

Reactivation is optional.

# Data Model

## 65. Storage Design

Possible:

```text
single blocklist_entries table
```

or separate type-specific tables.
The source does not dictate schema.

## 66. Conceptual Unified Entry

Possible fields:

```text
id
type
status
user_id
ip_address
payment_provider
payment_identifier
reason
source_type
source_id
created_by_admin_id
created_at
disabled_by_admin_id
disabled_at
```

Only type-relevant identifier fields are populated.

## 67. Historical Integrity

Disabling a block must not erase:

- original target
- original creator
- original creation time
- Audit Log history

# Audit Logs

## 68. Audit Requirement

Blocklist mutations are high-impact Admin actions.
Recommended events:

```text
BLOCKLIST_USER_ADDED
BLOCKLIST_IP_ADDED
BLOCKLIST_PAYMENT_METHOD_ADDED
BLOCKLIST_ENTRY_DISABLED
BLOCKLIST_ENTRY_REACTIVATED
```

## 69. Audit Data

Recommended:

```text
Admin actor
entry ID
block type
safe target reference
safe reason/source
before/after status
timestamp
```

Never audit raw sensitive payment credentials.

## 70. Runtime Match Logging Boundary

Routine blocked requests should not create one System Audit Log record each.
Use:

```text
security/application logs
```

for runtime matches.
Use:

```text
System Audit Logs
```

for Admin mutations.

## 71. Admin Notifications

Repeated/high-risk block matches may optionally create aggregated Admin security notifications.
Not source-required.
Avoid one notification per malicious request.

# Security

## 72. Authentication / Authorization

All management endpoints require:

```text
authenticated ADMIN
```

Possible permission split:

```text
view
add user ban
add IP block
add payment block
disable/reactivate
```

Exact permission keys are Open.

## 73. CSRF

Admin web mutations require Sanctum CSRF protection.

## 74. Self-Lockout

Blocking the current Admin or current Admin's IP may cause administrative lockout.
Whether to prevent or specially confirm this is Open.

## 75. Payment Secret Safety

Never expose raw payment credentials through:

- UI
- API
- logs
- Audit Logs
- cache keys where unsafe

## 76. IP Privacy

IP addresses are sensitive security data and should be visible only to authorized Admins.

## 77. XSS Safety

Admin-entered reasons/notes must render safely.

## 78. Metrics Privacy

Do not use raw:

```text
IP
user ID
payment fingerprint
```

as high-cardinality public metric labels.

# Integrations

## 79. Manage User Accounts

User detail may show:

```text
Globally Banned
```

when authorized.
Restoring account status does not clear the ban.

## 80. Seller Compliance

A case may link to an explicit "Create Global Ban" action.
No automatic coupling.

## 81. Complaints & Disputes

A complaint may link to an explicit blocklist action.
No automatic coupling.

## 82. Push Notification Management

Recommended for promotional campaigns:

```text
exclude globally banned users
```

This is not source-mandated; critical/security communications remain Open.

# Error Handling

## 83. Admin Errors

Handle:

```text
duplicate active block
invalid user
invalid IP
invalid payment identifier
permission denied
entry not found
already disabled
session expired
storage/cache error
```

## 84. Runtime Infrastructure Failure

If blocklist infrastructure fails, behavior follows the configured fail-open/fail-closed policy and the failure is logged safely.

# Observability

## 85. Recommended Metrics

Useful aggregates:

```text
user block matches
IP block matches
payment block matches
lookup latency
cache hit/miss
blocklist service errors
```

No sensitive identifiers in metric labels.

# Accessibility / UX

## 86. Accessibility

Admin UI should:

- label block type/status clearly
- support keyboard navigation
- expose validation errors accessibly
- use accessible confirmation dialogs
- not rely on color alone

## 87. Responsive Behavior

Lists/forms/detail views should remain usable on smaller screens.
Long identifiers should truncate/wrap safely without exposing more sensitive data than permitted.

# MVP Scope

## 88. Required

- authenticated Admin blocklist page
- USER type
- IP_ADDRESS type
- PAYMENT_METHOD type
- role-aware user targeting
- exact IPv4/IPv6 validation
- provider-safe payment identifier
- list/search/filter/pagination
- add active block
- safe detail view
- disable without erasing history
- duplicate active-entry prevention
- shared runtime Blocklist service
- IP middleware check
- authenticated-user check
- backend payment check
- generic blocked response
- Audit Log integration
- CSRF
- PII/payment-secret protection
- loading/empty/error states

## 89. Recommended

- cache/index acceleration
- database fallback
- immediate cache invalidation
- reason/source references
- reactivation
- runtime security logs
- aggregate monitoring
- deliberate confirmation

## 90. Not Required

- CIDR/ranges
- automatic expiry
- hard delete
- device/email/phone blocks
- geo bans
- automatic fraud scoring
- AI anomaly detection
- automatic complaint/compliance bans
- cross-role person-wide bans
- threat-intelligence feeds
- SIEM integration

# Acceptance Criteria

## 91. AC-01 — Authenticated Admin

Guests and non-Admins cannot manage Blocklist entries.

## 92. AC-02 — Permission

Admin mutations require the configured Blocklist permission.

## 93. AC-03 — Exact User Target

A user ban targets `user_id`, not email alone.

## 94. AC-04 — Cross-Role Isolation

Banning a Seller does not automatically ban a same-email Buyer.

## 95. AC-05 — Runtime User Ban

An active user ban denies applicable protected requests.

## 96. AC-06 — Existing Session

An existing web session does not bypass a newly active user ban.

## 97. AC-07 — Existing Mobile Token

An existing Bearer token does not bypass a newly active user ban.

## 98. AC-08 — IP Validation

Malformed IP values cannot be persisted as valid blocks.

## 99. AC-09 — IPv4/IPv6 Match

Canonical active IPv4/IPv6 entries match their corresponding request IPs.

## 100. AC-10 — Trusted Proxy

Client IP resolution follows trusted proxy configuration.

## 101. AC-11 — Payment Secrets

Raw card/CVV/OTP/bank-password data is never required or stored.

## 102. AC-12 — Payment Enforcement

A matching active provider-safe payment identifier blocks the backend transaction attempt.

## 103. AC-13 — Backend Recheck

Payment blocking is enforced at transaction time, not only at frontend load.

## 104. AC-14 — Historical Integrity

Blocking a payment method does not rewrite completed historical transactions.

## 105. AC-15 — Duplicate Prevention

Equivalent active user/IP/payment blocks cannot be duplicated.

## 106. AC-16 — Disable

Disabling an entry removes it from enforcement without deleting history.

## 107. AC-17 — Account Independence

Unban does not restore an independently suspended/deactivated account.

## 108. AC-18 — Compliance Independence

Unban does not clear Seller Compliance restrictions.

## 109. AC-19 — Registration Independence

Blocklist changes do not change approval/rejection state.

## 110. AC-20 — Complaint Independence

Blocklist changes do not change complaint state.

## 111. AC-21 — Efficient Lookup

Runtime checks use indexed/cache-optimized lookups.

## 112. AC-22 — Cache Invalidation

Add/disable/reactivate updates enforcement cache/index promptly.

## 113. AC-23 — Durable Authority

Cache loss does not erase Blocklist records.

## 114. AC-24 — Generic Denial

Blocked users do not receive internal security evidence or block reasons.

## 115. AC-25 — No Public Oracle

Public users cannot probe arbitrary blocklist identifiers.

## 116. AC-26 — Audit Add/Disable

Admin blocklist mutations create safe Audit events.

## 117. AC-27 — Audit Secret Safety

Audit Logs contain no raw payment credentials.

## 118. AC-28 — Runtime Log Boundary

Blocked-request matches do not flood the Admin mutation Audit Log.

## 119. AC-29 — CSRF

Admin blocklist mutations require configured Sanctum CSRF protection.

## 120. AC-30 — Pagination

The Admin blocklist list is bounded/paginated.

## 121. AC-31 — Search Role Context

User search results show role so same-email accounts are distinguishable.

## 122. AC-32 — No Automatic Order Mutation

Adding/removing a block does not silently cancel or rewrite orders/financial records.

# Tests

## 123. Backend Tests

Test:

- guest denied
- non-Admin denied
- Admin without permission denied
- create user ban
- exact user ID targeting
- same-email role isolation
- existing web session blocked
- existing mobile token blocked
- valid IPv4 accepted
- valid IPv6 accepted
- malformed IP rejected
- canonical duplicate IP detected
- trusted proxy behavior
- safe payment identifier accepted
- raw card/CVV/OTP not stored
- backend payment block enforced
- historical payment unchanged
- duplicate active user/IP/payment blocks prevented
- disable removes enforcement
- disable preserves history
- account suspension survives unban
- compliance restriction survives unban
- approval state remains independent
- complaint state remains independent
- cache invalidates on add/disable
- cache loss does not delete database records
- generic denial response
- no public blocklist probe
- add/disable audited
- payment secrets absent from Audit Logs
- runtime matches use security logs
- CSRF required
- pagination works

## 124. Frontend Tests

Test:

- Blocklist page loads
- loading/empty states
- type/status filters
- search
- role visible in user results
- add User ban confirmation
- IP validation
- Payment form never asks for raw secrets
- duplicate links to existing entry
- disable confirmation
- inactive entry remains in history
- masked payment identifier
- unauthorized action unavailable
- session expiration handling
- safe reason rendering
- responsive layout
- keyboard navigation
- textual status

# Open Decisions

## 125. Open Decisions

Current sources do not define:

1. exact schema
2. unified vs type-specific tables
3. status enum
4. hard-delete policy
5. expiry/temporary bans
6. reason taxonomy
7. required source references
8. reactivation
9. permission keys
10. Admin-account bans
11. self-lockout protection
12. cross-role person-wide bans
13. session revocation on user ban
14. mobile-token revocation
15. banned-user support/chat access
16. Buyer in-flight order behavior
17. Seller existing-order/listing behavior
18. Logistics active-shipment behavior
19. Courier active-task behavior
20. CIDR/range support
21. private/internal IP restrictions
22. NAT/VPN false-positive policy
23. trusted proxy topology
24. IP middleware exclusions
25. payment provider
26. payment fingerprint/reference format
27. payment identifier retention/protection
28. COD behavior
29. transaction failure semantics
30. cache technology
31. cache TTL/key design
32. cache invalidation implementation
33. database fallback
34. fail-open/fail-closed per check type
35. latency/throughput SLO
36. match-log retention
37. security-alert thresholds
38. Push campaign handling for banned users
39. privacy retention
40. threat-intelligence/SIEM integration

# Final Definition

## 126. Final Definition

AISLEY Global Ban / Blocklist Management is:

```text
an Admin-managed security blocklist

for:
    banned users
    fraudulent IP addresses
    flagged payment methods
```

Runtime enforcement:

```text
incoming request
→ IP check
→ user check where identity is known
→ allow / deny

transaction attempt
→ safe payment identifier
→ payment block check
→ allow / deny
```

Central identity rule:

```text
A user ban targets a specific user ID / role-account,
not an email address.
```

Central boundary:

```text
Global Ban is separate from
account suspension,
registration approval,
Seller Compliance,
and complaint resolution.
```

Central performance rule:

```text
Durable Blocklist state must be enforceable
efficiently on high-frequency request
and transaction paths.
```
