---
feature: account-management
title: Seller Account Management
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Account Management
## WHAT
- **Purpose:** Give an authenticated Seller a self-service settings area for managing storefront identity, business/profile information, payout information, security credentials, and notification preferences.
- **Canonical role:** `SELLER`.
- **Source-defined editable areas:**
  - business/store name
  - store description
  - personal/business profile details
  - payout information
  - security credentials
  - preferences
  - replacement verification documents where policy permits
- `Seller.md` defines Account Management as the Seller self-service portal for storefront identity and internal settings, including business names, payout details, store descriptions, and security credentials. fileciteturn65file0turn65file4
- **System-flow distinction:**
  - ordinary storefront/profile changes may become active immediately or enter moderation according to policy
  - payout, identity, ownership, and credential changes require re-authentication and/or `PENDING_REVIEW`
  - rejected controlled changes leave the previously approved value active
  - sensitive changes are audited
  - applicable security changes trigger confirmation/out-of-band notice
- **Recommended route:**
```text
/seller/account
```
- Recommended sections:
```text
/seller/account/profile
/seller/account/storefront
/seller/account/payout
/seller/account/security
/seller/account/notifications
```
- **Architecture:**
  - Next.js/React owns settings forms, masked payout display, document upload UI, pending-review indicators, password form, notification preferences, and validation/error states.
  - Laravel owns authenticated Seller identity, field allow-lists, validation, uniqueness, re-authentication, controlled-change workflow, payout token/reference handling, password hashing, audit/events, and safe DTOs.
  - Database/Eloquent remains authoritative.
- **Feature boundaries:**
  - Seller Auth owns login/session establishment and logout.
  - Admin Manage User Accounts / Seller Compliance owns suspension/compliance state.
  - Admin approval/review workflow owns approval of controlled account changes where required.
  - Payment/payout integration owns external payout-account tokenization/provider details.
  - Notifications owns actual notification delivery.
- **Seller cannot self-edit:**
  - role
  - compliance/suspension status
  - platform commission
  - platform permissions
  - administrative approval state except by submitting a controlled change
- **Non-goals:**
  - Seller registration/approval
  - Admin account moderation
  - Product/catalog editing
  - changing platform commission
  - bypassing document/reverification requirements
  - exposing full payout credentials
  - inventing MFA/2FA implementation not defined by the Seller source
## MUST
### Authentication
- Every Account Management endpoint requires authenticated `SELLER`.
- Laravel derives Seller identity from the authenticated account/session.
- Never trust client-submitted:
  - `seller_id`
  - role
  - compliance status
  - commission
  - permissions
  - approval state
- Frontend route guards are convenience only; Laravel authorization is authoritative. fileciteturn65file3turn65file15
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `404` scoped resource missing
  - `422` validation failure
  - `409` stale/review-state conflict where applicable
### Current Seller settings
- Provide a safe current-settings response.
- Conceptual:
```http
GET /api/seller/account
```
- Recommended response groups:
```text
profile
storefront
payout_summary
security_summary
notification_preferences
controlled_changes
```
- Do not return:
  - password hash
  - plaintext/current password
  - session identifiers
  - tokens
  - full payout credentials
  - verification-provider secrets
  - private Admin/compliance notes
- Sensitive profile/payment/contact data must be masked before serialization. fileciteturn65file11
### Field ownership / allow-list
- Account update endpoints must explicitly allow-list mutable fields.
- Seller cannot modify arbitrary columns through generic mass assignment.
- Read-only fields include at minimum:
```text
seller role
compliance status
suspension state
platform commission
platform permissions
system IDs
Admin approval decision
```
- If repository models contain additional platform-controlled fields, they remain server-controlled.
### Ordinary profile changes
- Ordinary fields may update immediately when policy allows.
- Examples supported by source:
  - public store description
  - ordinary contact/profile details
  - non-sensitive preferences
- Exact field list depends on the actual Seller schema.
- Every update is validated server-side.
- Public-facing changes must use only approved/active values.
### Storefront identity
- Seller may edit storefront identity fields supported by schema.
- Source explicitly includes business/store names and store descriptions.
- Validate:
  - required fields
  - length/content
  - unique shop identifiers/names where configured
  - prohibited/reserved values where platform policy defines them
- Do not assume store name must be globally unique unless repository/policy establishes that requirement.
- If a storefront identity change requires review, keep the previous approved value public until approval.
### Public vs pending values
- Controlled fields should distinguish:
```text
active approved value
pending proposed value
```
where review is required.
- Buyer-facing shop pages must continue using the approved active value until review succeeds.
- A rejected controlled change must not overwrite the approved value.
- Seller UI should show:
  - current active value
  - pending review state
  - rejected state/reason where policy allows
- Do not expose internal moderator notes unless explicitly intended for Seller communication.
### Controlled change lifecycle
- Recommended lifecycle:
```text
NONE
PENDING_REVIEW
APPROVED
REJECTED
```
- Exact persisted model may differ.
- Seller submits a proposed controlled change.
- Laravel validates and records it separately from the active value where necessary.
- Admin/review workflow approves or rejects.
- Only approved changes become active.
- Duplicate/stale review actions return stable conflict behavior.
### Sensitive-change classification
- Source flow identifies these as sensitive/controlled:
  - payout details
  - identity
  - ownership
  - security credentials
- Additional regulated fields may be classified sensitive by policy.
- Do not infer that every profile field requires re-authentication.
- Keep sensitive-change rules centralized server-side.
### Re-authentication
- Sensitive changes require the configured verification path.
- At minimum, current credentials may be required when password-based re-authentication is configured.
- Laravel 12 includes a `current_password` validation rule for verifying the authenticated user's current password. citeturn627402search2turn627402search13
- OWASP recommends re-authentication before sensitive changes such as password, email, and payment-related details. citeturn982260search0turn982260search8
- Re-authentication is enforced by Laravel, never by a React-only flag.
- Exact step-up method is Open:
  - current password
  - configured MFA
  - another approved verification mechanism
### Re-auth freshness
- Any recent-auth window is enforced/expired server-side; frontend timestamps are not proof.
- Exact duration and whether some high-risk changes always require a fresh challenge are Open.
### Password change
- Seller Account Management owns authenticated password change.
- Conceptual:
```http
PUT /api/seller/account/password
```
- Require:
  - authenticated Seller
  - current-password/re-auth verification
  - valid new password
  - confirmation where UI/API convention uses it
- Hash the new password with Laravel's configured password hashing mechanism.
- Never store or log plaintext passwords.
- Laravel's hashing service supports secure password hashing/checking, and Laravel validation exposes password rules/current-password verification. citeturn627402search0turn627402search6
### Password policy
- Reuse the project-wide password policy; Seller source does not define a Seller-specific length/complexity rule.
### Session behavior after password change
- Session invalidation policy after password change is Open and must align with Seller Auth.
- OWASP treats password changes as a risk event requiring careful session protection. citeturn982260search4
### MFA / 2FA
- `Seller.md` says security credentials but does **not** explicitly define MFA/2FA.
- Do not make TOTP, SMS OTP, email OTP, or passkeys mandatory in this spec.
- If project-wide Seller Auth later supports MFA:
  - enabling/disabling/changing factors belongs in this security section
  - factor changes require re-authentication
  - secrets/recovery codes are never returned after initial provisioning except as explicitly designed
- Exact MFA behavior is Open.
- OWASP recommends strong verification for factor changes. citeturn982260search5
### Email / primary login identifier
- Whether Seller can change login email is not explicitly defined.
- If allowed, treat it as a sensitive identity change.
- Recommended security pattern:
  - re-authenticate
  - validate uniqueness according to AISLEY role-aware identity rules
  - verify new email where verification exists
  - notify old contact out-of-band where appropriate
- OWASP recommends re-authentication and verification for email changes. citeturn982260search9
- Exact email-change workflow remains Open.
### Business / identity changes
- Changes that affect legal/business identity or account ownership may require:
  - supporting documents
  - re-authentication
  - `PENDING_REVIEW`
- Seller cannot directly overwrite active verified identity fields.
- Exact regulated fields/documents depend on registration/compliance requirements.
- Do not invent mandatory document types not present in current source/schema.
### Verification document replacement
- System flow allows replacement verification documents.
- Upload must follow AISLEY shared file rules:
  - Laravel-authorized upload
  - type/size validation
  - malware scanning
  - configured object/file storage
  - asset reference in domain record
  - signed/authorized access when private
- Shared architecture explicitly requires these protections. fileciteturn65file11
- Document replacement may create `PENDING_REVIEW` rather than immediately replacing the approved verification state.
### Payout information
- Seller source explicitly includes payout details and requires strict validation for banking/payout fields. fileciteturn65file0turn65file4
- Payout updates are sensitive.
- Require:
  - authenticated Seller
  - re-authentication/step-up
  - format/provider validation
  - controlled review where policy requires
- Do not return full payout credentials after storage/submission.
### Payout storage
- System flow requires full payout credentials to be tokenized/masked and never returned.
- Preferred architecture:
```text
Seller enters payout data
→ trusted payout provider / secured Laravel integration
→ provider token/reference
→ AISLEY stores provider reference + safe summary
```
- If any sensitive payout value must be stored by AISLEY:
  - minimize it
  - encrypt at rest using approved project mechanisms
  - never expose it through logs/resources
- Laravel provides application-level authenticated encryption, but provider tokenization is preferable for provider-managed payout secrets when available. citeturn627402search4
### Payout display
- Show only provider/type, masked identifier where allowed, and verification/review state.
- Never return complete payout identifiers; replacement uses a new secure submission.
### Payout change review
- If payout updates require review:
```text
ACTIVE payout reference
+ PENDING proposed payout reference
```
- Current active payout destination remains until approval unless security policy freezes payouts.
- Exact payout-freeze behavior is Open.
- Rejected proposal leaves previous approved payout active.
### Transaction authorization recommendation
- Payout-destination changes are high-risk; enforce authorization server-side and show the safe destination summary being confirmed. citeturn982260search2
- Exact second-factor mechanism is Open.
### Notification preferences
- Seller may update configured notification preferences; exact event/channel matrix is Open.
- System-required compliance/security notices cannot be disabled by a generic preference flag.
### Out-of-band security notice
- System flow requires confirmation/out-of-band notice where applicable.
- Recommended triggers:
  - password changed
  - payout destination changed/approved
  - primary identity/login identifier changed
  - MFA factor changed if MFA exists
- Send only after the source mutation commits.
- Notification failure must not silently revert a valid account mutation.
- Exact channel is Open.
### Audit trail
- Sensitive mutations must be audited.
- Recommended audit entries:
  - Seller ID
  - change type
  - timestamp
  - result
  - request/reference ID
  - safe old/new summaries where appropriate
- Never audit:
  - plaintext password
  - password hash
  - full payout credential
  - session/token
  - MFA secret
- Shared architecture requires security-sensitive mutations in the appropriate audit trail. fileciteturn65file15
### Store description/content safety
- Treat Seller-authored storefront text as untrusted content.
- Validate length/content.
- Render safely on Buyer-facing pages.
- Do not allow arbitrary executable HTML unless explicit rich-text sanitization exists.
### Concurrent / stale updates
- If account settings use versioning/updated timestamps, reject stale sensitive writes with `409`.
- Controlled change submissions must not overwrite a newer pending/approved proposal unexpectedly.
- React should refetch latest settings after conflict.
- Exact optimistic-lock strategy is Open.
### Account deletion / deactivation
- Seller self-deactivation/deletion is **not** defined by current source.
- Do not add it as mandatory Account Management behavior.
- Admin Manage User Accounts owns platform-level account activation/suspension/deactivation.
- Seller-initiated closure may be a future separate workflow due to Orders/payout/compliance dependencies.
### Public storefront propagation
- Approved storefront changes should propagate to:
  - Browse Shop
  - Search Product/shop summaries
  - Homepage shop references where present
- Pending/rejected values must not leak into public Buyer views.
- Cache/search propagation, if needed, happens after commit.
### Frontend states
- Settings: loading, loaded, error.
- Ordinary form: idle/editing/validating/saving/success/error.
- Sensitive form: re-auth required/verifying/submitting/pending/approved/rejected/failure.
- Documents/payout/password must expose their upload, masked/pending, validation, and success/error states.
### Accessibility
- Use labeled fields, field-addressable errors, textual sensitive/review states, correct password autocomplete, understandable masked payout summaries, and keyboard-accessible confirmations.
### Acceptance criteria
- [ ] Seller can read/update only their own account/storefront settings.
- [ ] Role, compliance status, commission, permissions, and Admin-controlled state are not self-editable.
- [ ] Ordinary approved fields update according to policy.
- [ ] Controlled fields keep prior approved values active until approval.
- [ ] Rejected controlled changes do not overwrite approved values.
- [ ] Sensitive payout/identity/credential changes require configured re-auth/review path.
- [ ] Password change verifies current credentials and stores only a hash.
- [ ] Full payout credentials are never returned to the browser.
- [ ] Payout UI uses masked/tokenized/provider-reference data.
- [ ] Verification document replacements use authorized private file storage.
- [ ] Sensitive mutations are audited without secrets.
- [ ] Applicable security changes trigger after-commit confirmation/security notice.
- [ ] Public Buyer-facing shop data uses only approved/active Seller values.
- [ ] Seller self-account deletion/deactivation is not invented by this feature.
## HOW
### Project findings
- `Seller.md` defines Seller Account Management as self-service updates to Seller/storefront identity, business details, payout details, store descriptions, and security credentials. fileciteturn65file0turn65file4
- The dedicated Seller Account Management system flow adds:
  - personal/business/storefront/payout/security/notification settings
  - replacement verification documents
  - optional moderation for ordinary storefront changes
  - re-authentication and/or `PENDING_REVIEW` for payout/identity/ownership/credential changes
  - sensitive-action auditing
  - out-of-band notice
  - masked/tokenized payout credentials
  - platform-controlled role/compliance/commission/permissions
- AISLEY architecture requires Laravel authorization/validation, safe sensitive DTOs, private file storage, after-commit notifications, and audit trails. fileciteturn65file11turn65file15
- Current sources do not define exact Seller profile fields, payout provider, MFA, password policy, email-change behavior, controlled-review SLA, or session invalidation after password change.
### Recommended API
```http
GET   /api/seller/account
PATCH /api/seller/account/profile
PATCH /api/seller/account/storefront
POST  /api/seller/account/controlled-changes
PUT   /api/seller/account/password
PUT   /api/seller/account/notification-preferences
POST  /api/seller/account/payout-change
POST  /api/seller/account/verification-documents
```
- Exact grouping may be simplified to repository conventions.
- Avoid one unrestricted `PATCH /seller` accepting every account column.
- Use Form Requests and safe `SellerAccountResource`.
### Recommended actions
```text
UpdateSellerProfile
UpdateSellerStorefront
SubmitSellerControlledChange
ChangeSellerPassword
SubmitSellerPayoutChange
ReplaceSellerVerificationDocument
UpdateSellerNotificationPreferences
ApplyApprovedSellerChange
RejectSellerChange
```
- Keep review/approval mutation authorized to the appropriate Admin workflow.
### Sensitive change pattern
```text
Seller submits sensitive change
→ re-authenticate
→ validate proposed value/document
→ store pending proposal
→ PENDING_REVIEW where required
→ commit
→ audit + security notice after commit
→ Admin/reviewer approves/rejects
→ approved value becomes active
```
- For a sensitive change that does not require human review, the same pattern can apply immediately after successful re-authentication.
### Password implementation
- Use Laravel `current_password` or equivalent configured credential verification. citeturn627402search2turn627402search13
- Hash new passwords through the configured Laravel hasher. citeturn627402search0
- Reuse project-wide password policy.
- Apply the chosen Auth/session invalidation rule after commit.
### Payout implementation
```text
Seller
→ re-authenticated payout form
→ trusted payout integration/provider
→ tokenize/register payout destination
→ AISLEY stores safe provider reference + masked summary
→ optional PENDING_REVIEW
```
- Never round-trip full secrets through later GET responses.
- If provider integration does not exist yet, keep payout provider/token fields abstract rather than inventing a gateway.
### Review data model
Conceptual:
```text
seller_account_changes
- id
- seller_id
- change_type
- proposed_payload/reference
- status
- submitted_at
- reviewed_at nullable
- reviewed_by nullable
- rejection_reason nullable
```
- Sensitive proposed payloads must be minimized/encrypted/referenced rather than stored as arbitrary plaintext JSON.
- Existing generic approval/audit models may be reused.
### Next.js / React
```text
/seller/account
├── ProfileSettings
├── StorefrontSettings
├── PayoutSettings
├── SecuritySettings
├── NotificationSettings
└── PendingChanges
```
- Use Client Components for interactive forms/uploads.
- All business/security decisions remain in Laravel.
- After successful mutations, refresh from the canonical account resource.
### Tests
- **Laravel:** Seller isolation; protected fields; ordinary update; validation/uniqueness; sensitive re-auth; password hash; payout masking; document auth; pending/approve/reject; secret-free audit; after-commit notice.
- **Frontend:** settings/forms; password failure; pending/rejected; payout masking; upload/validation/conflict states; accessibility.
### Research-backed recommendations
- Require re-authentication for password, primary identity, and payout/payment-detail changes; OWASP specifically recommends this for sensitive account features. citeturn982260search0turn982260search8
- Enforce all sensitive authorization server-side, particularly financial/payout changes. citeturn982260search2
- Use Laravel's current-password validation and configured hashing rather than implementing password verification manually. citeturn627402search2turn627402search0
### Risks
- **Takeover/payout theft:** weak re-auth or secret handling can change credentials/identity/payout destination.
- **Tenant/privilege leakage:** weak scoping or generic PATCH can expose data or alter platform-controlled fields.
- **Pending/secret leakage:** unapproved values or sensitive data can escape through public DTOs/logs.
- **Review races:** concurrent controlled-change decisions can activate stale values.
### Open questions
- Exact editable fields and which storefront/identity/ownership changes require review.
- Payout provider/model, review/freeze behavior.
- Password/session policy; email-change flow; Seller MFA/2FA.
- Notification preferences/security-notice channels.
- Controlled-change UX and verification-document requirements.
- Store/shop identifier uniqueness.
- Seller-initiated closure/deactivation.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller feature source: `Seller.md`
- Seller flow: `feature-system-flows/seller/account-management.md`
- Laravel 12 Validator API: https://api.laravel.com/docs/12.x/Illuminate/Validation/Validator.html
- Laravel 12 Hash Manager: https://api.laravel.com/docs/12.x/Illuminate/Hashing/HashManager.html
- Laravel 12 Encryption: https://laravel.com/framework/docs/12.x/encryption
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Transaction Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html
