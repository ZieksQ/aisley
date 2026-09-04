---
role: Logistics
feature: Account Management
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application / Self-Service Account Settings
source_coverage: Logistics.md, app.md
---
# Logistics Account Management Specification
## 1. Purpose
Logistics Account Management is AISLEY's self-service settings feature for maintaining the Logistics account's profile, operational identity, contact information, and security credentials.
`Logistics.md` defines:
```text
Core Value:
Update Logistics information.
Basically account settings.
```
Expanded definition:
```text
A profile management portal
for the logistics hub
or dispatcher identity.

It handles updates to:
- logistics center operational details
- contact numbers
- security credentials
```
System context:
```text
Standard profile management
and authentication middleware
for the Logistics or Admin user role.
```
This specification applies that requirement to the:
```text
LOGISTICS
```
role and the Logistics web application.
A separate `flow.md` is not required because this feature is primarily self-service CRUD/settings behavior rather than a distinct multi-stage business lifecycle.
## 2. Primary Actor
Primary actor:
```text
LOGISTICS
```
The authenticated Logistics account manages only its own permitted account/settings data.
## 3. Logistics Role Context
From `app.md`:
```text
Logistics
= a company that ships orders

Responsibilities include:
- shipment management
- route optimization
- Courier/Rider management
- dispatching
```
Account Management maintains the identity/settings of that Logistics account.
It does not perform those operational responsibilities directly.
## 4. Application Context
From `app.md`:
```text
Web applications:
Admin
Storefront
Seller
Logistics
```
Logistics Account Management belongs to the dedicated Logistics web application/domain.
## 5. Authentication Model
The Logistics web application uses:
```text
Laravel Sanctum
stateful HttpOnly session cookie
```
Web login flow:
```text
GET /sanctum/csrf-cookie
POST /login
→ encrypted HttpOnly session cookie
```
Account Management uses the existing authenticated Logistics session.
## 6. Account Identity
All AISLEY roles share the same `users` table.
Identity uniqueness is:
```text
unique(email, role)
```
Therefore:
```text
logistics@example.com + LOGISTICS
logistics@example.com + BUYER
```
may be different accounts.
Account Management must resolve the exact:
```text
authenticated user_id
+
LOGISTICS role
```
and never target by email alone.
# Feature Responsibility
## 7. Account Management Owns
This feature owns:
- viewing the current Logistics account profile
- editing permitted Logistics profile fields
- maintaining logistics-center operational details
- maintaining supported contact information
- changing supported authentication credentials
- security-setting access where implemented
- validating and sanitizing account data
- protecting sensitive settings
- safe account-setting responses
- role-aware account isolation
## 8. Account Management Does Not Own
This feature does not own:
- Logistics registration approval
- Logistics subscription billing
- platform commission calculation
- Courier approval
- Courier management
- Fleet management
- Waybill
- Zone/Territory Mapping
- Deploy Rider
- Update Status
- Logistics Chat
- capacity monitoring
- Admin account management
- role conversion
## 9. Self-Service Boundary
Logistics Account Management is:
```text
self-service
```
The authenticated Logistics account may modify only its own allowed fields.
It must not be usable to modify:
```text
another Logistics account
Buyer
Seller
Courier
Admin
```
## 10. Role Immutability
The Logistics account must not change:
```text
LOGISTICS → ADMIN
LOGISTICS → SELLER
LOGISTICS → BUYER
LOGISTICS → COURIER
```
through Account Management.
## 11. Permission Boundary
Account Management must not allow Logistics users to assign themselves:
```text
Admin permissions
Seller privileges
Courier privileges
platform-wide privileges
```
# Registration and Subscription Boundaries
## 12. Registration Flow
From `app.md`:
```text
Logistics
register
→ Admin approved
→ email
→ sign in
→ subscription
```
## 13. Approval Ownership
Registration approval belongs to:
```text
Admin Manage Account Registrations
```
Logistics Account Management must not modify:
```text
PENDING
APPROVED
REJECTED
```
registration state.
## 14. Self-Approval
The Logistics account cannot:
```text
approve itself
reject itself
clear a rejection
```
through Account Management.
## 15. Subscription Boundary
From `app.md`:
```text
Logistics SaaS platform
= base subscription + ₱10 per order
```
Subscription is a separate business capability.
Account Management must not silently treat:
```text
profile update
```
as:
```text
subscription activation
subscription payment
subscription cancellation
```
## 16. Approval Is Not Subscription
Critical rule:
```text
APPROVED
≠
SUBSCRIBED
```
Account Management must keep those concepts separate.
## 17. Subscription Display
The Account Settings UI may display:
```text
subscription status
```
as read-only context if useful.
Actual subscription lifecycle belongs to the subscription/billing feature.
# Profile Model
## 18. Source Profile Scope
`Logistics.md` explicitly mentions:
```text
logistics hub
or
dispatcher identity
```
This creates a schema question:
```text
Is the Logistics account itself the hub/company identity?

or

Is the user a dispatcher identity
linked to a separate Logistics hub/entity?
```
The current sources do not fully define this.
Open Decision.
## 19. Recommended Separation
If AISLEY implements a separate Logistics organization/hub entity:
```text
users
→ authentication/person identity

logistics_hubs / logistics_profiles
→ operational center identity
```
This is a recommendation, not a mandatory schema requirement.
## 20. Current Account Target
Regardless of schema, all updates must be anchored to the authenticated Logistics account and its authorized Logistics profile/hub relation.
## 21. Editable Fields
The source does not define an exact field list.
Therefore editable fields must come from the implemented schema and explicit allowlist.
Source-supported categories include:
```text
operational details
contact numbers
security credentials
```
## 22. Operational Details
Possible operational fields may include:
```text
hub/company display name
operational contact information
center details
```
only where these exist in the actual schema.
Do not invent mandatory fields not supported by requirements.
## 23. Contact Numbers
`Logistics.md` explicitly includes:
```text
contact numbers
```
Therefore Account Management should support updating the Logistics contact number(s) where modeled.
## 24. Contact Number Validation
Contact data must be:
- validated
- normalized where appropriate
- safely stored
- safely displayed
Exact phone format and verification rules are Open.
## 25. Email
Whether Logistics may change the sign-in email is not explicitly defined.
If supported, enforce:
```text
unique(email, LOGISTICS)
```
not global email uniqueness across all roles.
## 26. Same Email Across Roles
Example:
```text
team@example.com + LOGISTICS
team@example.com + SELLER
```
may coexist.
Changing the Logistics email must not mutate the Seller account.
## 27. Email Verification
Whether a changed email requires:
```text
verification
```
is not defined.
Open Decision.
## 28. Address / Hub Location
Although a Logistics hub logically has a location, the Account Management source does not explicitly define which location/address fields are editable here.
If operational hub address exists in the Logistics profile schema, Account Management may expose it.
Exact fields and map/geocoding behavior are Open.
## 29. Profile Image / Logo
A Logistics profile logo/image is not source-required.
Open Decision.
# Field-Level Security
## 30. Allowlist
Profile updates must use an explicit field allowlist.
Do not allow unrestricted mass assignment.
## 31. Forbidden Fields
Account Management must not directly update:
```text
role
Admin permissions
registration approval state
subscription payment state
subscription entitlement
password hash
session identifiers
personal access tokens
Courier records
Fleet records
Zone records
Audit metadata
```
## 32. Backend Validation
Backend validation is authoritative.
Frontend validation is only for user experience.
## 33. Sanitization
The source requires standard profile/authentication handling.
All user-controlled text must be validated and safely rendered.
## 34. XSS
Operational names/contact labels must not create stored XSS in:
```text
Logistics UI
Admin UI
Courier UI
Buyer/Seller order screens
```
where those values are displayed.
# Security Credentials
## 35. Credential Scope
The source explicitly includes:
```text
security credentials
```
At minimum, this includes password-management behavior where password authentication is used.
## 36. Password Change
Conceptual endpoint:
```http
POST /api/logistics/account/password
```
or shared account endpoint.
## 37. Password Rules
The backend must:
- verify required current credentials according to policy
- validate the new password
- securely hash it
- never return plaintext password
- never return password hash
- never log plaintext password
## 38. Password Policy
The current source does not define:
```text
minimum length
complexity
history
expiration
```
Open Decision.
## 39. Current Password Verification
Whether the existing password is always required for a password change is not explicitly defined.
Recommended:
```text
sensitive credential changes
→ recent/current credential verification
```
## 40. Session Revocation
Behavior after password change is not defined.
Possible policy:
```text
keep current session
revoke other sessions
```
Open Decision.
## 41. Password Recovery
Forgot-password/recovery behavior is related authentication functionality but is not explicitly defined as Account Management.
Open Decision / shared authentication feature.
# Additional Security Settings
## 42. Two-Factor Authentication
Unlike Buyer Account Management, `Logistics.md` does not explicitly mention:
```text
2FA
```
Therefore 2FA must not be treated as a mandatory Logistics Account Management requirement solely from this source.
## 43. Shared 2FA
If AISLEY later implements 2FA across roles, Logistics Account Management may expose it through shared security settings.
That remains an optional/shared capability unless separately specified.
## 44. Sensitive Changes
Potentially sensitive changes may include:
```text
password
email
contact number
security settings
```
Exact classification is Open.
## 45. Recent Authentication
Recommended:
```text
sensitive setting
→ recent authentication challenge
```
Exact timeout/challenge mechanism is Open.
# Contact and Operational Identity
## 46. Logistics Center Identity
The source calls this a portal for:
```text
logistics hub
or dispatcher identity
```
The UI should clearly communicate which entity the user is editing.
Avoid mixing:
```text
personal dispatcher identity
```
and:
```text
company/hub operational identity
```
into ambiguous fields.
## 47. Organization-Level Fields
If a Logistics account represents an organization directly, operational settings may belong to the same profile.
## 48. Multi-Dispatcher Model
If a Logistics company later has multiple dispatcher users, organization fields should not automatically be editable by every dispatcher unless permissions are defined.
The source does not define multiple Logistics staff accounts.
Open Decision.
## 49. Contact Visibility
Operational contact details may be displayed elsewhere in the platform.
Only fields intended for operational/public use should be exposed broadly.
Private account/security data must remain restricted.
# Courier Boundary
## 50. Courier Registration
From `app.md`:
```text
Courier
→ searches Logistics hubs
→ registers under Logistics
→ Logistics Admin approves
→ mobile sign in
```
Account Management does not own Courier approval.
## 51. Courier Management
Changing Logistics profile details must not:
```text
approve Couriers
disable Couriers
reassign Couriers
change Courier availability
```
## 52. Hub Relationship
If Courier accounts reference a Logistics hub/entity, profile updates should preserve that stable relationship.
Changing a display name must not orphan Courier relationships.
# Fleet Boundary
## 53. Vehicle Fleet Management
Fleet records belong to:
```text
Vehicle Fleet Management
```
Account Management must not directly edit:
```text
plate numbers
vehicle capacity
maintenance schedule
Courier vehicle assignment
```
## 54. Navigation
Account Settings may link to Fleet Management.
It should not duplicate Fleet CRUD.
# Zone Boundary
## 55. Zone / Territory Mapping
Zone definitions belong to:
```text
Zone / Territory Mapping
```
Account Management should not directly edit:
```text
zone polygons
Courier zone eligibility
territory boundaries
```
## 56. Hub Location vs Zone
A Logistics center's profile location, if editable, is distinct from delivery-zone polygons.
# External APIs
## 57. Core Account Management
Core Logistics Account Management does not require a new third-party provider.
It can use:
```text
AISLEY backend
database
Laravel authentication
```
## 58. Brevo
`app.md` specifies:
```text
Brevo
```
for email.
Brevo is not required merely to update profile/contact information.
If AISLEY later requires email verification or security alerts for account changes, the existing Brevo integration may be reused.
That behavior is not source-required here.
## 59. Maps
`app.md` lists:
```text
Maps JavaScript API
Mapbox Matrix and Optimization
```
These are not required for basic Account Management.
If a hub address/location editor later uses place completion/geocoding, that would be a separate UI/data decision.
## 60. No SMS Requirement
This feature does not require:
```text
Twilio
SMS provider
mobile Push provider
```
from current sources.
# API
## 61. Account Read
Conceptual:
```http
GET /api/logistics/account
```
Returns safe current Logistics account/profile settings.
## 62. Profile Update
Conceptual:
```http
PATCH /api/logistics/account/profile
```
The backend derives the current account from authentication.
## 63. Contact Update
May be part of profile update or use:
```http
PATCH /api/logistics/account/contact
```
Exact route design is Open.
## 64. Password Update
Conceptual:
```http
POST /api/logistics/account/password
```
## 65. Security Settings
If shared security settings are implemented:
```http
GET /api/logistics/account/security
```
Exact API is Open.
## 66. No Client User ID
The account update request must not use client-submitted:
```text
user_id
```
as the authoritative target.
## 67. Safe Response
Responses must exclude:
```text
password
password hash
session cookie
session identifier
access tokens
API/provider secrets
Admin-only metadata
```
# Authentication and Authorization
## 68. Authenticated Logistics
Every account-setting endpoint requires:
```text
authenticated LOGISTICS
```
## 69. Same-Email Role Safety
A same-email Seller/Buyer/Courier account cannot access Logistics settings.
## 70. Self Scope
The authenticated Logistics account can access only its own authorized settings/profile.
## 71. IDOR
Knowing another Logistics:
```text
user ID
profile ID
hub ID
```
must not grant access.
## 72. CSRF
All state-changing web requests require configured Sanctum CSRF protection.
## 73. Server Authority
The backend must derive:
```text
current actor
role
authorized Logistics profile/hub
```
from the authenticated session and domain relationships.
# Concurrency
## 74. Concurrent Changes
Two browser tabs or multiple authorized staff sessions may submit updates concurrently.
The backend should avoid accidental destructive overwrites.
## 75. Partial Updates
Recommended:
```text
PATCH semantics
```
so only explicitly submitted permitted fields change.
## 76. Stale Update Policy
Exact optimistic locking/versioning policy is Open.
## 77. Security Change Atomicity
A password/security change should either:
```text
fully succeed
```
or:
```text
leave protected security state unchanged
```
# Error Handling
## 78. Validation Error
Invalid input returns field-specific errors.
No partial forbidden-field mutation occurs.
## 79. Email Conflict
If email editing is supported and:
```text
(email, LOGISTICS)
```
already exists:
```text
reject
```
## 80. Contact Error
Invalid contact number:
```text
reject
→ preserve prior valid value
```
## 81. Credential Verification Failure
If sensitive verification fails:
```text
do not apply protected change
```
## 82. Session Expired
Expired/invalid Logistics session:
```text
unauthenticated
→ no mutation
```
## 83. Forbidden Field
Attempts to change:
```text
role
approval
subscription
Admin privileges
```
must be rejected/ignored according to validation policy.
# Data Model
## 84. Shared Users Table
From `app.md`:
```text
all roles live in same users table
```
Authentication identity therefore originates from `users`.
## 85. Logistics-Specific Profile
Operational details may live in:
```text
users
```
or:
```text
users
+
logistics profile / hub entity
```
The current sources do not define the final schema.
## 86. Stable Relationships
If operational fields are separated, use stable foreign keys rather than names/emails as relationships.
## 87. Contact Storage
Contact numbers should use an appropriate normalized representation.
Exact format is Open.
## 88. Subscription Storage
Subscription state must remain in the subscription/billing model rather than being an arbitrary profile field.
# Logging / Audit
## 89. Admin Audit Logs Boundary
The existing System Audit Logs specification is Admin-focused.
Routine Logistics self-service updates should not automatically be written into Admin Audit Logs unless AISLEY later broadens the audit subsystem.
## 90. Security History
Sensitive changes should have appropriate security/account-event history.
Examples may include:
```text
password changed
email changed
contact changed
```
Exact logging subsystem is Open.
## 91. Secret Logging
Never log:
```text
plaintext password
password hash
session cookie
access token
security challenge secret
API credentials
```
## 92. Profile Change History
Whether operational profile changes need a user-visible history is not source-required.
Open Decision.
# UX
## 93. Recommended Sections
```text
Account Settings
├── Logistics Profile
├── Contact Information
└── Security
```
Subscription may be shown separately as read-only context or linked to its owning feature.
## 94. Logistics Profile Section
Shows only implemented operational fields.
## 95. Contact Section
Shows supported Logistics contact fields.
## 96. Security Section
At minimum, provides password/credential management where supported.
## 97. Subscription Link
If subscription UI exists:
```text
Account Settings
→ Subscription
```
may navigate to the separate billing feature.
Do not implement subscription payment mutations inside profile forms.
## 98. Save Behavior
Use clear:
```text
Saving
Saved
Validation error
Security verification required
Server error
```
states.
## 99. Field Errors
Show errors beside the relevant field.
## 100. Security Feedback
Credential changes should confirm success without revealing secret values.
## 101. Accessibility
Account Settings should:
- use semantic form labels
- support keyboard navigation
- expose validation errors accessibly
- not rely on color alone
- clearly distinguish profile vs security sections
- identify sensitive actions
## 102. Responsive Layout
Logistics is a web application.
Account Settings should remain usable on practical desktop/tablet/narrow browser widths.
# Performance
## 103. Current Account Query
Account settings should use a bounded current-user/profile lookup.
## 104. No Unrelated Operational Data
Do not load:
```text
orders
Fleet
Courier lists
Zones
chat history
capacity metrics
```
during normal Account Settings retrieval.
## 105. Update Efficiency
Update only changed allowed fields.
# MVP Scope
## 106. Required
- authenticated Logistics Account Settings
- exact `user_id + LOGISTICS` identity
- self-service scope
- safe account/profile read
- Logistics operational-detail updates where modeled
- contact-number updates where modeled
- security credential/password management
- explicit editable-field allowlist
- validation
- sanitization/XSS safety
- role immutability
- approval-state protection
- subscription-state protection
- session-based web authentication
- CSRF for mutations
- safe responses
- loading/success/error states
## 107. Recommended
- recent authentication for sensitive changes
- normalized contact numbers
- security-change history
- session revocation policy after password changes
- separate user identity vs Logistics hub profile if architecture needs it
- partial PATCH updates
- subscription status shown only as read-only/link
## 108. Not Required
- Courier approval
- Courier CRUD
- Fleet management
- Waybill
- Zone management
- Deploy Rider
- Update Status
- Chat
- capacity monitoring
- subscription payment processing
- Admin approval changes
- role conversion
- 2FA unless separately specified
- SMS
- Push
- new third-party provider
- Maps/Mapbox for basic account settings
# Acceptance Criteria
## 109. Access
- Guest cannot access Logistics Account Management.
- Buyer/Seller/Courier accounts cannot access Logistics settings.
- Same-email accounts under another role do not inherit access.
- The backend resolves the authenticated Logistics account.
## 110. Self-Service
- Logistics can read its own safe profile/settings.
- Logistics cannot retrieve another Logistics account's settings by ID.
- Logistics cannot update another account.
## 111. Profile
- Only allowlisted operational/profile fields are editable.
- Contact fields are validated.
- User-controlled content is safely rendered.
- Forbidden mass-assignment fields are rejected.
## 112. Role / Approval / Subscription
- Logistics cannot change its role.
- Logistics cannot self-approve.
- Logistics cannot modify registration approval state.
- Profile updates do not activate/cancel/modify subscription state.
- `APPROVED ≠ SUBSCRIBED` remains preserved.
## 113. Credentials
- Password change securely hashes new password.
- Password/plaintext/hash never appear in response or logs.
- Failed required security verification leaves protected change unapplied.
- Session behavior follows configured security policy.
## 114. Email
If email editing is enabled:
- uniqueness is checked as `(email, LOGISTICS)`
- same email under another role does not incorrectly conflict
- updating Logistics email does not change another role-account
## 115. Security
- Web mutations require CSRF.
- IDOR protections apply.
- Session/auth identifiers are never exposed.
- Provider/API secrets are never exposed.
## 116. Feature Boundaries
- Account Management does not edit Fleet records.
- Account Management does not edit Zone polygons.
- Account Management does not approve Couriers.
- Account Management does not dispatch Couriers.
- Account Management does not mutate shipment/order status.
## 117. Third-Party
- Core Account Management works without a new third-party provider.
- Brevo is not required for normal profile updates.
- Mapbox is not required for normal profile updates.
- SMS/Push providers are not required.
# Tests
## 118. Backend Tests
Test:
- guest denied
- Buyer denied
- Seller denied
- Courier denied
- authenticated Logistics allowed
- same-email role isolation
- own profile retrieval
- arbitrary Logistics profile ID denied
- allowed profile update
- contact validation
- XSS-safe profile text
- role mutation rejected
- approval mutation rejected
- subscription-state mutation rejected
- Admin permission mutation rejected
- password change
- password hash not returned
- plaintext password absent from logs
- failed credential verification
- session behavior according to policy
- email uniqueness by role if email editable
- same email on Seller allowed where constraint permits
- CSRF required
- safe response fields only
## 119. Frontend Tests
Test:
- Account Settings loads
- Logistics Profile section
- Contact section
- Security section
- loading state
- save state
- success confirmation
- field validation
- password fields masked
- forbidden fields absent
- subscription shown only according to boundary
- session-expired handling
- keyboard accessibility
- responsive layout
# Open Decisions
## 120. Open Decisions
The current sources do not define:
1. exact Logistics profile fields
2. whether Logistics represents a company/hub directly
3. whether a separate Logistics hub/profile table exists
4. whether multiple dispatcher users can belong to one Logistics organization
5. which dispatcher can edit organization-level information
6. exact operational-detail fields
7. exact contact-number structure
8. whether email is self-editable
9. email verification after change
10. phone/contact verification
11. hub/location address fields
12. whether hub address uses Google Places
13. profile/logo support
14. password policy
15. current-password requirement
16. recent-authentication timeout
17. session revocation after password change
18. password recovery behavior
19. whether shared 2FA is implemented for Logistics
20. security-change history storage
21. profile-change history
22. optimistic locking/versioning
23. exact API route names
24. subscription-status display behavior
25. account deactivation/self-deletion
26. Logistics account data-retention policy
# Final Definition
## 121. Final Definition
AISLEY Logistics Account Management is:
```text
a self-service Logistics settings portal
for maintaining:

- Logistics hub/dispatcher identity
- operational profile details
- contact information
- security credentials
```
Identity rule:
```text
authenticated user_id + LOGISTICS role
```
AISLEY account constraint:
```text
unique(email, role)
```
Critical boundaries:
```text
Account Management
≠ Admin registration approval

Account Management
≠ Logistics subscription billing

Account Management
≠ Courier management

Account Management
≠ Fleet / Zone / Dispatch operations
```
Security rule:
```text
Logistics may modify only
its own explicitly permitted settings.
```
Third-party rule:
```text
No new third-party provider
is required for core Logistics Account Management.
```
