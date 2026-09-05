---
role: Courier/Rider
feature: Account Management
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Self-Service Profile and Security Settings
source_coverage: Courier.md, app.md
---
# Courier / Rider Account Management Specification
## 1. Purpose
Courier / Rider Account Management is AISLEY's self-service settings feature for maintaining Courier profile, operational, payout, and login information.
`Courier.md` defines:
`Core Value: → Update Courier information. → Basically account settings.`
Expanded definition:
```text
Profile management
for the driver.

Handles updates to:
- vehicle details
- license information
- payout methods
- secure login credentials
```
System context:
```text
Standard CRUD operations
on the Couriers table.

Sensitive updates
(like changing vehicle types)

may require middleware
for administrative verification.
```
This feature is primarily self-service CRUD/settings behavior.
A separate `flow.md` is not required because the source does not define a business-state lifecycle for Account Management itself.
## 2. Primary Actor
Primary actor:
`COURIER / RIDER`
The Courier manages account settings through the Flutter mobile application.
## 3. Application Context
From `app.md`:
`Mobile App: → Rider → Storefront`
Therefore Courier Account Management is mobile-first.
## 4. Authentication
Courier mobile authentication follows `app.md`:
```text
Flutter sends:
credentials + device_name
→ /login

Laravel:
createToken()
→ personal access token

Flutter:
stores token in flutter_secure_storage

Future requests:
Authorization: Bearer <token>
```
All Account Management requests must resolve:
`authenticated user_id → + → COURIER role`
## 5. Account Identity Rule
AISLEY identity uniqueness is:
`unique(email, role)`
A same-email Buyer/Seller/Logistics account is a separate role account.
Never identify or update the Courier account using email alone.
# Source Schema Tension
## 6. Courier.md Schema Statement
`Courier.md` says:
`Standard CRUD operations → on the Couriers table.`
## 7. app.md Shared User Model
`app.md` says:
`all roles live in the same users table`
with:
`unique(email, role)`
## 8. Recommended Reconciliation
Recommended architecture:
```text
users
→ authentication / shared account identity

courier_profiles or couriers
→ Courier-specific operational profile
```
This recommendation preserves both source statements without requiring all Courier-specific fields to live directly on `users`.
## 9. Schema Is Not Finalized
The exact table layout remains an Open Decision.
Do not silently assume either:
`everything is on users`
or:
`Courier authentication is completely separate from users`
without final schema confirmation.
# Feature Responsibility
## 10. Account Management Owns
Courier Account Management owns:
- reading the authenticated Courier's account/profile settings
- updating allowed Courier profile fields
- updating vehicle details where this self-service feature permits
- updating license information
- managing payout-method information
- changing secure login credentials
- validating sensitive field updates
- routing sensitive changes through administrative verification where required
- protecting account/private financial information
- mobile validation and error handling
- role-safe self-service updates
## 11. Account Management Does Not Own
It does not own:
- initial Courier registration
- Logistics approval of Courier registration
- Courier dispatch
- delivery acceptance
- pickup/delivery status transitions
- Fleet master vehicle registry
- Zone/Territory mapping
- Courier availability monitoring
- earnings calculation
- payout disbursement
- bank/e-wallet transfer execution
- delivery-history editing
- performance scoring
- incident processing
- SOS alerting
unless explicitly added later.
## 12. Core Boundary
Account Management answers:
```text
What profile,
operational,
payout,
and login information
belongs to my Courier account,
and what am I allowed to update?
```
It does not answer:
`Which delivery should I take?`
or:
`How much should I be paid?`
# Registration / Approval Boundary
## 13. Courier Registration Source
From `app.md`:
```text
courier
→ search for logistics hubs
→ register for that logistics
→ logistics admin approved
→ sign in
```
## 14. Account Management Starts After Access
Account Management is a post-registration self-service feature.
It does not replace Logistics approval.
## 15. Approval State
Changing ordinary profile information must not silently:
`approve → reject → or re-register`
the Courier.
## 16. Logistics Relationship
The Courier is registered under a Logistics organization.
Account Management must not allow arbitrary reassignment to another Logistics organization unless a separate transfer workflow is defined.
# Profile Information
## 17. Source Profile Scope
The source describes:
`profile management → for the driver`
but does not enumerate all general profile fields.
## 18. Recommended General Fields
Where already present in the shared user/profile model, self-service may include fields such as:
`display name → contact number → profile image`
only if the project already defines them.
These are recommendations, not explicit Courier.md requirements.
## 19. Role
Courier role is not an editable profile field.
Never allow:
`COURIER → LOGISTICS → COURIER → SELLER`
through self-service settings.
## 20. Logistics Ownership
The Courier's Logistics organization relationship should not be freely editable from Account Management.
## 21. Immutable System Fields
Do not expose self-service mutation for:
```text
user_id
role
created_at
system approval flags
internal moderation state
```
unless another feature explicitly owns that change.
# Vehicle Details
## 22. Source Requirement
Courier Account Management explicitly handles:
`vehicle details`
## 23. Vehicle Detail Meaning
The source does not enumerate exact fields.
Possible vehicle-profile fields may include:
`vehicle type/class → plate/reference → vehicle description`
where defined by the project.
Exact fields are Open.
## 24. Fleet Management Relationship
Logistics Vehicle Fleet Management separately owns the Logistics vehicle registry, including:
```text
plate numbers
maintenance schedules
Courier assignments
vehicle capacities
```
## 25. Source Overlap
Courier Account Management also says the Courier may update:
`vehicle details`
This creates overlap with the Logistics Fleet registry.
## 26. Recommended Ownership
Recommended:
```text
Courier Account Management
→ Courier submits/maintains self-service vehicle profile data

Vehicle Fleet Management
→ authoritative Logistics fleet/assignment registry
```
Sensitive changes may require Logistics/Admin verification before becoming dispatch-authoritative.
## 27. Vehicle Type Sensitivity
`Courier.md` explicitly says:
`changing vehicle types → may require → administrative verification`
Therefore vehicle-type change should be treated as a sensitive update.
## 28. Vehicle Type Is Not Instantly Authoritative by Default
Recommended:
`Courier requests vehicle-type change → → verification required where configured → → authoritative operational value updates after approval`
The exact verifier is not named in the source.
## 29. Administrative Verification Actor
Because Courier accounts belong to Logistics, the likely verifier may be:
`Logistics administration`
but `Courier.md` only says:
`administrative verification`
Exact actor is Open.
## 30. Vehicle Capacity
Vehicle-capacity rules belong to Fleet Management.
Courier Account Management should not let a Courier arbitrarily increase authoritative vehicle capacity used by Deploy Rider.
## 31. Maintenance
Vehicle maintenance schedules belong to Vehicle Fleet Management.
Not Account Management.
# License Information
## 32. Source Requirement
Account Management handles:
`license information`
## 33. License Fields
The source does not define:
- license number
- license class
- issue date
- expiry date
- document image
- issuing authority
- verification status
Open Decision.
## 34. Sensitive Information
License information is sensitive personal/operational data.
Return and display only what is necessary.
## 35. Verification
Whether all license changes require administrative verification is not explicitly stated.
Open Decision.
## 36. Expiration
The source does not define automatic license-expiry enforcement.
Do not invent:
`expired license → → automatic account suspension`
without explicit policy.
## 37. Document Upload
The source does not explicitly require uploading a license image/document.
Open Decision.
## 38. External Verification
No government licensing API is required by the current sources.
# Payout Methods
## 39. Source Requirement
Courier Account Management handles:
`payout methods`
## 40. Payout Method Meaning
The source does not define supported methods such as:
```text
bank account
e-wallet
cash
platform balance
```
Open Decision.
## 41. Payout Method vs Payout Execution
Account Management owns:
`where/how the Courier wishes to receive payouts`
where such fields are implemented.
It does not own:
`actual disbursement → settlement → withdrawal`
## 42. Profit Dashboard Boundary
Profit Dashboard shows:
`recorded Courier earnings`
It does not edit payout methods.
## 43. Financial Data Security
Payout-method information is sensitive.
Use:
- server-side authorization
- minimum response exposure
- masked display where possible
- secure storage/encryption according to implementation policy
## 44. No Raw Secret Display
Do not return full sensitive payout credentials unnecessarily.
## 45. Payment Gateway
The source does not select a payout provider.
Do not introduce a bank/e-wallet/payment gateway as mandatory.
## 46. Payout Verification
Whether payout-method changes require administrative verification is not explicitly defined.
Recommended for high-risk changes, but Open Decision.
## 47. Change Confirmation
Additional credential re-authentication for payout-method change is recommended.
Not explicitly source-required.
# Secure Login Credentials
## 48. Source Requirement
Account Management explicitly handles:
`secure login credentials`
## 49. Password Change
Password change is a core supported credential-management operation.
## 50. Current Password
Recommended security rule:
`changing password → → verify current credential`
unless the user is in a dedicated recovery flow.
## 51. Password Validation
New password must follow the platform's centralized password policy.
The exact policy is not defined in the current source.
## 52. Password Storage
Laravel must store passwords using secure hashing.
Never store or return plaintext passwords.
## 53. Token Sessions
Changing password may affect existing personal-access-token sessions.
Exact token revocation policy is Open.
## 54. Device Tokens
Courier mobile auth may have multiple:
`personal_access_tokens`
associated with devices.
Whether Account Management exposes active devices/sessions is not source-required.
Open Decision.
## 55. Login Email
Whether Courier can change their login email is not explicitly defined in Courier.md.
Open Decision.
## 56. Email Uniqueness
If self-service email change is implemented:
`unique(email, COURIER)`
must remain valid.
## 57. Same Email Across Roles
Changing Courier email does not require that the email be globally unique across all roles.
The project rule is:
`unique(email, role)`
## 58. Email Verification
Whether email change requires re-verification is not defined.
If transactional email is used, AISLEY can reuse Brevo.
This is optional until policy is defined.
# Two-Factor Authentication
## 59. Source Boundary
Unlike some other account-management sources, Courier.md does not explicitly mention:
`2FA`
## 60. MVP
Do not make 2FA mandatory for Courier Account Management based on the current source.
It may be added later as a security enhancement.
# Sensitive Update Verification
## 61. Source Requirement
`Courier.md` says:
```text
Sensitive updates
(like changing vehicle types)
may require middleware
for administrative verification.
```
## 62. Sensitive Update Category
At minimum:
`vehicle type`
is a source-backed example.
## 63. Other Sensitive Fields
Potentially sensitive updates may include:
`license information → payout methods → login email`
but the source does not explicitly say they all require admin verification.
Open Decision.
## 64. Verification Middleware
The source expects middleware or equivalent backend enforcement.
The mobile app must not decide whether a sensitive update is verified.
## 65. Pending Change Model
Recommended:
```text
current verified value
+
pending requested value
+
verification status
```
for fields that require approval.
This is a recommendation.
## 66. No Instant Dispatch Effect
For a verification-required vehicle-type change:
`submitted change → ≠ immediately dispatch-authoritative`
until approved.
## 67. Current Value Preservation
Recommended:
`pending sensitive update → → current approved operational value remains active`
until verification succeeds.
## 68. Rejection
If verification rejects a sensitive update:
`current approved value remains`
The exact rejection workflow is Open.
## 69. Verification Notifications
Whether the Courier receives in-app/email notification for approved/rejected changes is not defined.
Open Decision.
# Self-Service CRUD Model
## 70. Read Account
Courier can retrieve their current settings/profile.
## 71. Update Allowed Fields
Courier can update only explicitly allowlisted fields.
## 72. Partial Update
PATCH-style updates are appropriate for profile/settings changes.
## 73. Create Semantics
Although the source says standard CRUD, the Courier account/profile is initially created by registration.
Account Management should not create a second Courier identity.
## 74. Delete Semantics
Self-service account deletion is not defined.
Do not add account deletion as required merely because the source says CRUD.
## 75. Deactivation
Courier deactivation/suspension lifecycle is not defined in this feature.
Open Decision / separate account-lifecycle concern.
# API
## 76. Account Detail
Conceptual:
```http
GET /api/courier/account
```
## 77. Profile Update
Conceptual:
```http
PATCH /api/courier/account/profile
```
## 78. Vehicle Update
Conceptual:
```http
PATCH /api/courier/account/vehicle
```
or:
```http
POST /api/courier/account/vehicle-change-request
```
for verification-sensitive changes.
Exact API is Open.
## 79. License Update
Conceptual:
```http
PATCH /api/courier/account/license
```
or a pending-change endpoint where verification is required.
## 80. Payout Method
Conceptual:
```http
GET /api/courier/account/payout-method
PATCH /api/courier/account/payout-method
```
Exact implementation depends on payout architecture.
## 81. Password Change
Conceptual:
```http
POST /api/courier/account/password
```
## 82. Email Update
Only if supported:
```http
PATCH /api/courier/account/email
```
## 83. Pending Sensitive Changes
Possible:
```http
GET /api/courier/account/change-requests
```
if the verification model exposes them.
# Backend Authority
## 84. Authenticated Identity
The backend derives:
`courier user_id → role → Logistics relationship`
from the authenticated token/domain model.
## 85. No Client User ID Authority
Do not trust:
```text
user_id
courier_id
role
logistics_id
```
from the client for self-service ownership.
## 86. Field Allowlist
Every update endpoint must explicitly allow only supported fields.
## 87. Mass Assignment
Do not accept arbitrary model attributes from JSON.
## 88. Sensitive Change Detection
Backend determines whether a requested update requires administrative verification.
## 89. Verification State
Client cannot mark its own update:
`APPROVED → VERIFIED`
# Authorization
## 90. Bearer Authentication
All Courier Account Management endpoints require a valid personal access token.
## 91. Exact Role
Backend verifies:
`role = COURIER`
## 92. Own Account Only
Courier may update only their own account/profile.
## 93. IDOR
Knowing another Courier:
```text
user_id
courier_id
profile_id
payout_method_id
```
must not expose or modify that account.
## 94. Same-Email Role Isolation
A Buyer/Seller/Logistics account with the same email cannot access the Courier settings.
# Security
## 95. Password
Never return:
`password → password hash`
## 96. Tokens
Never return/log:
`plain-text personal access token`
from Account Management responses.
## 97. Payout Data
Mask sensitive payout identifiers in standard reads.
## 98. License Data
Expose only necessary license fields.
## 99. Vehicle Data
Vehicle data may affect dispatch eligibility and therefore must be backend validated.
## 100. Reauthentication
For high-risk updates such as:
`password → payout method → possibly email`
reauthentication is recommended.
Exact requirements are Open.
## 101. Rate Limiting
Credential-sensitive endpoints should use reasonable rate limits.
Exact values are Open.
# Validation
## 102. General Profile Validation
Validate according to field type and project rules.
## 103. Vehicle Type
Vehicle type must come from the configured/accepted Fleet/domain values.
Do not accept arbitrary values that bypass dispatch capacity logic.
## 104. Plate Number
If the Courier can submit/edit plate information, validation must be consistent with Vehicle Fleet Management.
## 105. License
License-field format/rules are Open.
Do not hardcode unsupported jurisdiction rules.
## 106. Payout Method
Validate according to the selected payout-method type/provider architecture.
## 107. Password
Use centralized platform password validation.
## 108. Email
If editable:
`valid format → + → unique(email, COURIER)`
## 109. Phone
If a contact number is editable, exact format rules are Open.
# Vehicle Fleet Integration
## 110. Authoritative Fleet
Logistics Vehicle Fleet Management owns the operational Fleet registry.
## 111. Courier Vehicle Profile
Courier Account Management may expose self-service vehicle information.
## 112. Sync Problem
The system must avoid:
`Courier profile vehicle = motorcycle → Fleet registry vehicle = van`
without a defined source-of-truth rule.
## 113. Recommended Approach
Recommended:
`Courier proposes vehicle detail change → → Logistics/Fleet verification → → authoritative Fleet relationship updated`
for dispatch-impacting fields.
## 114. Non-Authoritative Display Fields
Purely descriptive fields may be self-service if they do not affect dispatch safety/eligibility.
Exact split is Open.
# Deploy Rider Integration
## 115. Vehicle Type Impact
Deploy Rider may filter using:
`vehicle capacity/type`
from Fleet Management.
## 116. Sensitive Change Reason
This is why changing vehicle type may require verification.
## 117. No Immediate Candidate Manipulation
Courier must not be able to self-change a vehicle type and instantly gain eligibility for tasks requiring a larger vehicle without server verification.
# License / Eligibility Integration
## 118. Dispatch Eligibility
Whether license status directly affects dispatch eligibility is not defined.
Open Decision.
## 119. No Invented Suspension
Do not automatically suspend a Courier for license edits/expiry without defined rules.
# Payout / Profit Integration
## 120. Profit Dashboard
Profit Dashboard reads Courier earnings from the authoritative earnings ledger.
## 121. Payout Method
Account Management may store where payout is sent.
## 122. Separation
```text
Profit Dashboard
= earnings visibility

Account Management
= payout destination/settings

Payout/Settlement feature
= actual money transfer
```
## 123. No Ledger Mutation
Changing payout method must not alter historical earnings amounts.
# Account Security
## 124. Password Change Success
After successful password update:
`new credential → → used for future sign-in`
## 125. Current Session
Whether the current token remains valid after password change is Open.
## 126. Other Sessions
Whether other device tokens are revoked is Open.
## 127. Session Management UI
Not required by current source.
## 128. Password Recovery
Forgot-password recovery is authentication infrastructure, not Account Management CRUD.
# Operational Requirements

## Profile and Document Scope

`Courier.md` does not explicitly require:

`profile image → license document upload → vehicle document upload`

These remain Open Decisions.

Do not introduce cloud media storage solely for Account Management unless document/image upload is later selected.

No exact regulatory document, insurance, or government verification requirement is defined by the source.

## Notifications

Core Account Management requires immediate in-app success/error feedback.

If a sensitive update requires administrative verification, the Courier should be able to see a clear pending/approved/rejected state where that workflow exists.

Email notifications for sensitive changes are not required. If later selected, AISLEY may reuse Brevo.

SMS and Push are not required for core Account Management.

## Error Handling

Validation errors should return field-level feedback.

Unauthorized updates must fail without mutation.

If a sensitive update requires verification:

`submit requested change → → preserve current authoritative value → → show pending verification`

where the pending-change model is adopted.

Network failure must not be presented as a successful update.

Concurrent updates remain backend-authoritative; optimistic locking/versioning is an Open Decision.

## Sensitive Change History

Recommended significant history events include:

```text
vehicle-type change request
license change
payout-method change
password-change event
```

History must never contain plaintext passwords, access tokens, or full sensitive payout credentials.

Whether these events feed a generalized platform audit ledger is Open.

## Privacy

Account responses should expose only fields required by the Courier settings UI.

Payout identifiers should be masked/minimized.

License information should remain restricted to authorized account/verification surfaces.

Vehicle information may be visible to authorized Logistics/Fleet systems according to operational policy.

## Offline Behavior

Account/security changes should generally require connectivity.

Safe display data may be cached, but cached profile state is not authoritative.

Do not queue password changes offline.

Do not queue payout-method changes offline unless a deliberately secure sync model is defined.

## Performance

Account settings should use bounded single-account/profile queries.

Do not load delivery history, earnings ledger, messages, or incidents to render the settings page.

Load sensitive verification/change-request metadata only where needed.

## UI

Recommended mobile structure:

```text
Account Management
├── Profile
├── Vehicle Details
├── License Information
├── Payout Method
└── Security
```

For verification-sensitive vehicle changes, distinguish:

`current verified value → pending requested value → verification status`

Payout information should use masked display.

At minimum, the Security section should provide:

`Change Password`

Role and associated Logistics organization should be read-only where displayed.

Section-specific saves are recommended because different sections have different validation/security requirements.

The UI should provide semantic labels, accessible errors, adequate touch targets, and textual verification states rather than relying on color alone.

## Third-Party Dependencies

No new third-party provider is required for core Account Management.

No external vehicle/license verification provider is required by current sources.

No payout provider is required merely to store payout settings.

Brevo is optional only if email verification/security messages are later added.

Mapbox, Google Maps, SMS, and Push are not required for core Account Management.

# MVP Scope
## 180. Required
- authenticated Courier access
- exact Courier role authorization
- own-account read
- own-profile update
- vehicle-detail support
- license-information support
- payout-method settings support
- secure credential/password update
- field allowlisting
- backend validation
- same-email role isolation
- IDOR protection
- sensitive payout-data protection
- vehicle-type sensitive-update verification hook
- loading/success/error states
## 181. Recommended
- `users` + Courier-specific profile separation
- section-specific update endpoints
- current-password verification for password changes
- payout-method masking
- pending sensitive-change model
- administrative verification status
- sensitive-change history
- Logistics/Fleet handoff for dispatch-impacting vehicle changes
- reauthentication for high-risk updates
## 182. Not Required
- account deletion
- Logistics reassignment
- automatic Courier approval
- automatic vehicle-capacity change
- vehicle maintenance management
- payout execution
- withdrawals
- bank/e-wallet provider integration
- mandatory 2FA
- license government API
- insurance integration
- license document upload
- vehicle document upload
- Mapbox
- Google Maps
- SMS
- Push
- new third-party provider
# Acceptance Criteria
## 183. Access
- Missing/invalid token cannot access account settings.
- Non-Courier token cannot access Courier Account Management.
- Same-email other-role account does not inherit Courier access.
- Courier can access/update only their own account.
## 184. Profile
- Supported self-service fields can be read.
- Supported editable fields can be updated.
- Role cannot be changed through self-service.
- Logistics organization cannot be arbitrarily changed.
- System/internal fields cannot be mass-assigned.
## 185. Vehicle
- Courier can view supported vehicle details.
- Supported vehicle changes are validated.
- Vehicle type is treated as a sensitive update according to configured verification policy.
- Pending vehicle-type change does not bypass Fleet/Deploy Rider authoritative eligibility.
- Courier cannot arbitrarily increase authoritative vehicle capacity.
## 186. License
- Supported license information can be read/updated according to policy.
- Sensitive license data is protected.
- No unsupported automatic suspension/expiry rule is invented.
## 187. Payout Method
- Courier can view configured payout method safely.
- Sensitive identifiers are masked/minimized.
- Courier can update allowed payout-method fields according to policy.
- Updating payout method does not alter historical earnings.
- Profit Dashboard remains read-only earnings authority.
## 188. Security
- Courier can securely change password.
- Plaintext password is never stored/returned.
- Bearer tokens are not exposed by Account Management.
- Password policy is enforced server-side.
- Token/session behavior after password change follows configured policy.
## 189. Sensitive Verification
- Backend determines whether a change requires verification.
- Client cannot self-approve a pending change.
- Current approved value remains authoritative until verification if pending-model is adopted.
- Verification status is presented clearly.
## 190. Schema Integrity
- Shared user identity remains compatible with `unique(email, role)`.
- Courier-specific profile data can coexist with shared `users` identity.
- Email alone is never used as the account primary scope.
## 191. Third-Party
- Core Account Management works without a new third-party provider.
- No government/license API is required.
- No payout provider is required merely to store payout settings.
- Mapbox/Google Maps/SMS/Push are not required.
# Tests
## 192. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer token denied
- Seller token denied
- Logistics token denied
- authenticated Courier allowed
- same-email role isolation
- own account returned
- another Courier account denied
- profile field allowlist
- role mutation rejected
- Logistics relationship mutation rejected
- mass assignment rejected
- vehicle detail update
- invalid vehicle type
- vehicle-type verification path
- pending sensitive update cannot self-approve
- license update
- payout method masked in reads
- payout-method update authorization
- payout update does not mutate earnings ledger
- password current-credential validation if adopted
- password update
- plaintext password absent
- token absent
- email uniqueness `(email, COURIER)` if email update exists
- rate-limit/security tests for sensitive endpoints
## 193. Flutter Tests
Test:
- Account Management screen
- Profile section
- Vehicle section
- License section
- Payout section
- Security section
- profile save
- field validation
- vehicle change
- pending verification state
- license update
- masked payout display
- payout update
- password change
- invalid current password if required
- loading state
- success state
- error state
- offline/network failure
- role read-only
- Logistics relationship read-only
- screen-reader labels
- touch-target sizing
- status text not color-only
# Open Decisions
## 194. Open Decisions
The current sources do not define:
1. exact shared `users` vs `couriers` schema
2. Courier profile table name
3. exact general profile fields
4. whether email is self-editable
5. email re-verification
6. phone/contact-number field
7. profile-image support
8. exact vehicle fields
9. whether plate number is Courier-editable
10. vehicle type enum
11. exact fields requiring administrative verification
12. identity of administrative verifier
13. pending-change schema
14. rejection-reason visibility
15. vehicle change effect on Fleet registry
16. license fields
17. license verification requirements
18. license-expiry policy
19. license document upload
20. vehicle document upload
21. exact payout methods
22. payout provider
23. payout-method verification
24. payout-method masking rules
25. payout settlement/withdrawal feature
26. reauthentication rules for payout changes
27. password policy
28. personal-access-token revocation after password change
29. active-device/session UI
30. 2FA support
31. self-service account deletion/deactivation
32. sensitive-change audit architecture
33. exact API routes
# Final Definition
## 195. Final Definition
AISLEY Courier / Rider Account Management is:
`the Courier's self-service → profile and account-settings portal`
covering source-backed categories:
```text
vehicle details
license information
payout methods
secure login credentials
```
with ordinary Courier identity still grounded in:
`users → + → unique(email, role)`
while `Courier.md` also expects a Courier-specific CRUD model.
Recommended schema boundary:
```text
users
→ auth / shared role identity

Courier profile/table
→ driver-specific operational settings
```
Sensitive-update rule:
`vehicle type change → may require administrative verification`
and should not instantly bypass Fleet/dispatch eligibility controls.
Critical boundaries:
```text
Account Management
≠ Courier registration approval

Account Management
≠ Vehicle Fleet authority

Account Management
≠ Profit calculation

Account Management
≠ payout execution
```
Third-party rule:
`No new third-party provider → is required for core Courier Account Management.`
