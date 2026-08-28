---
feature: Manage Platform Settings
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft
scope: Admin Web Application / Shared Platform Configuration
source_coverage: Admin.md, app.md, current AISLEY Admin feature specifications
---

# Manage Platform Settings Specification

## 1. Purpose

Manage Platform Settings is the Admin feature for maintaining platform-wide announcements and policy content.
`Admin.md` defines:

```text
Core Value:
Post Announcements and Update/Add Platform Policies.

Expanded Definition:
A global configuration module allowing administrators
to control system-wide variables.

It includes a CMS capability
to draft and broadcast platform-wide announcements,

as well as the ability to dynamically update:
- Terms of Service
- Privacy Policy
- internal rules

System Context:
Announcements should integrate with the user dashboard feed.

Policy updates might require triggering
a "requires re-consent" flag
for all active users upon their next login.
```

This specification defines requirements, boundaries, APIs, security rules, acceptance criteria, and Open Decisions.
State transitions for announcements and policy publication/re-consent are kept in `flow.md`.

## 2. Primary Actor

The primary actor is:

```text
ADMIN
```

Only authenticated and authorized Admins may create, edit, publish, archive, or otherwise manage platform settings content.

## 3. Core Responsibilities

The feature owns:

- announcement drafts
- announcement publishing
- announcement history
- Terms of Service content
- Privacy Policy content
- internal platform rules
- policy versioning
- publication metadata
- optional re-consent requirement
- user dashboard/feed integration
- policy retrieval for web/mobile surfaces
- Audit Log integration
- safe content rendering
  It does not own:
- Push/SMS campaign dispatch
- direct Admin Chat
- Admin Notifications inbox
- user account settings
- Admin account settings
- user suspension
- Global Ban
- Seller Compliance
- complaint resolution
- Logistics subscription billing
- shipping fee configuration
- secret/API key management
- deployment/environment settings

## 4. Feature Boundary

This feature manages:

```text
global platform content and policy
```

It does not mean every system variable belongs here.
Do not automatically place:

```text
API keys
database credentials
Brevo credentials
Mapbox tokens
Google API secrets
session secrets
deployment flags
```

into Admin-editable Platform Settings.

## 5. Core Content Types

Source-backed content:

```text
ANNOUNCEMENT
TERMS_OF_SERVICE
PRIVACY_POLICY
INTERNAL_RULES
```

Exact enum/storage naming is implementation-specific.

## 6. Announcement Purpose

Announcements are platform-wide content intended to appear in the user dashboard/feed.
Examples may include:

```text
platform updates
service notices
important information
```

The source does not define exact announcement categories.

## 7. Announcement vs Push Notification

Critical boundary:

```text
Manage Platform Settings
    stores/publishes announcement content

Push Notification Management
    actively sends Push/SMS campaigns
```

Publishing an announcement must not automatically send a Push/SMS blast.
If Admin wants both:

```text
publish announcement
+
create separate Push Notification campaign
```

## 8. Announcement vs Admin Notifications

```text
Admin Notifications
    inbound alerts for Admin attention

Platform Announcements
    outbound platform content for users
```

These must remain separate.

## 9. Announcement vs Chat

```text
Admin Chat
    direct one-to-one conversation

Announcement
    one-to-many platform content
```

Do not create chat threads for every user when publishing an announcement.

## 10. Announcement State

The source requires drafting and broadcasting/publishing.
Recommended lifecycle:

```text
DRAFT
PUBLISHED
ARCHIVED
```

`ARCHIVED` is recommended rather than source-mandated.

## 11. Draft

A draft:

- is editable
- is not visible in normal user feeds
- has not become authoritative public content

## 12. Published

A published announcement:

- is visible to applicable users
- records publication metadata
- should not be silently replaced without history

## 13. Archived

If supported, archived announcements:

- are removed from the active user feed
- remain historically retrievable by authorized Admins
- are not hard-deleted by default

## 14. Announcement Editing

Recommended:

```text
DRAFT
    editable

PUBLISHED
    edits should create a new revision
    or use controlled update semantics
```

Exact published-edit policy is Open.

## 15. Announcement Fields

Recommended:

```text
id
title
body
status
created_by_admin_id
created_at
updated_at
published_by_admin_id
published_at
archived_at
```

Only fields needed by implementation are required.

## 16. Announcement Body

The source requires CMS-like content but does not define:

```text
plain text
Markdown
rich text
HTML
```

Recommended MVP:

```text
plain text or safely sanitized rich text
```

Exact format is Open.

## 17. Announcement Audience

The source says:

```text
platform-wide announcements
```

Therefore default interpretation:

```text
all applicable AISLEY users
```

Role-targeted announcements are not source-required.

## 18. Announcement Feed Integration

Published announcements should integrate with:

```text
user dashboard feed
```

Exact placement differs by app.
The platform should expose a shared announcement query/API that each user surface can consume.

## 19. Guest Visibility

Whether announcements are visible to unauthenticated storefront guests is not defined.
Open Decision.

## 20. Announcement Ordering

Recommended:

```text
most recently published first
```

Pinned/sticky announcements are not source-required.

## 21. Announcement Pagination

User/Admin announcement lists should be bounded/paginated where necessary.

## 22. Announcement Expiry

The source does not define:

```text
expires_at
scheduled removal
```

Open Decision.

## 23. Scheduled Publication

The source does not define future scheduling.
Open Decision.

## 24. Announcement Deletion

Hard deleting a published announcement is not recommended.
Prefer archive/history for accountability.
Exact retention is Open.

# Policies

## 25. Policy Types

Source-backed policies:

```text
Terms of Service
Privacy Policy
Internal Rules
```

These should be maintained as platform-controlled documents rather than hardcoded mutable text only.

## 26. Policy Versioning

Policy updates should preserve historical versions.
Recommended:

```text
Policy
    logical policy type

PolicyVersion
    versioned published content
```

## 27. Why Versioning Matters

Versioning allows AISLEY to determine:

```text
which policy version was active
which version a user accepted
whether a newer version requires re-consent
```

## 28. Draft Policy Version

Recommended:

```text
DRAFT
```

A draft:

- is editable
- is not the current authoritative public policy
- can be reviewed before publication

## 29. Published Policy Version

Recommended:

```text
PUBLISHED
```

Once published, a policy version should be immutable or treated as immutable.
Future edits should create another draft/version.

## 30. Policy Immutability

Recommended rule:

```text
published policy versions are not overwritten
```

This protects consent and historical records.

## 31. Current Version

Each policy type should have at most one:

```text
current published version
```

at a time.
Historical versions remain retrievable to authorized Admins.

## 32. Version Identifier

Recommended:

```text
version_number
or
version_label
```

Exact scheme is Open.

## 33. Effective Date

Recommended:

```text
effective_at
```

The source does not define delayed effective dates.
If not needed, `published_at` may serve as effective time.

## 34. Policy Fields

Recommended:

```text
id
policy_type
version
title
body
status
requires_reconsent
created_by_admin_id
created_at
published_by_admin_id
published_at
effective_at
```

## 35. Policy Content Format

Exact editor format is Open.
Requirements:

- safely stored
- safely rendered
- supports sufficiently long legal/policy content
- does not execute unsafe scripts

## 36. Terms of Service

Admin may create/update Terms of Service through versioned policy publication.

## 37. Privacy Policy

Admin may create/update Privacy Policy through versioned policy publication.

## 38. Internal Rules

Admin may create/update internal platform rules.
Whether these rules are:

```text
public
role-specific
Admin-only
```

is not defined.
Open Decision.

# Re-Consent

## 39. Source Requirement

`Admin.md` says policy updates:

```text
might require triggering
a "requires re-consent" flag
for all active users
upon their next login
```

Therefore re-consent must be supported as an optional publication property.

## 40. Re-Consent Is Not Automatic

Not every policy publication must require re-consent.
Admin publication should explicitly decide:

```text
requires_reconsent = true / false
```

if the UI exposes that control.

## 41. Affected Users

Source wording says:

```text
all active users
```

The exact definition of active is not defined.
Open Decision.

## 42. Role-Aware Consent Identity

AISLEY uses:

```text
unique(email, role)
```

Consent must therefore attach to:

```text
user/account ID
```

not email alone.
Example:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

may require separate consent records.

## 43. Consent Record

Recommended:

```text
user_id
policy_type
policy_version_id
accepted_at
```

Optional:

```text
source/application
IP/user-agent
```

Exact fields are Open and subject to privacy policy.

## 44. Re-Consent Trigger

When a published policy requires re-consent:

```text
affected user
→ next authenticated session/login
→ system detects missing acceptance
→ show new policy
→ collect consent according to policy
```

Detailed sequence is in `flow.md`.

## 45. Blocking Behavior

The source says re-consent may be required on next login, but does not define whether users are:

```text
fully blocked
partially blocked
allowed read-only access
allowed to decline
```

This is a major Open Decision.

## 46. Decline Behavior

The source does not define what happens if a user declines an updated policy.
Open Decision.

## 47. Multiple Policies

If Terms and Privacy both require re-consent, the system must handle multiple outstanding policy acceptances deterministically.
Exact UX is Open.

## 48. Re-Consent Reset

Publishing a new version with:

```text
requires_reconsent = true
```

must not delete older consent history.
It creates a new required acceptance for the new version.

## 49. Existing Consent History

Do not rewrite:

```text
accepted version 1
```

into:

```text
accepted version 2
```

A new consent record is required.

# Publication

## 50. Announcement Publication

Publishing should:

- authenticate Admin
- authorize publication
- validate content
- verify current draft state
- set publication metadata
- commit
- emit Audit event
- make content available to user feed

## 51. Policy Publication

Publishing should:

- authenticate Admin
- authorize policy management
- validate content
- create/finalize version
- preserve historical versions
- set current published version
- record `requires_reconsent`
- commit
- emit Audit event
- activate re-consent requirement when applicable

## 52. Atomicity

Policy current-version switching should be atomic.
The system must not temporarily expose two conflicting "current" versions because of partial writes.

## 53. Concurrency

Two Admins may edit/publish simultaneously.
Use:

```text
optimistic locking
version checks
atomic publication transaction
```

or equivalent.
Exact mechanism is Open.

## 54. Duplicate Publish

Repeated publish requests should not create duplicate published versions accidentally.

## 55. Preview

Recommended:

```text
preview before publish
```

This is particularly useful for long policy content.

## 56. Confirmation

Publishing is consequential.
Recommended confirmation:

```text
content type
title/version
re-consent yes/no
```

## 57. Rollback

The source does not define rollback.
Recommended policy approach:

```text
publish a new version
rather than mutate history
```

Exact rollback semantics are Open.

# User Retrieval

## 58. Announcement API

Conceptual:

```http
GET /api/platform/announcements
```

Returns active published announcements applicable to the current user/surface.

## 59. Policy API

Conceptual:

```http
GET /api/platform/policies/{type}/current
```

Returns the current published policy.

## 60. Outstanding Consent API

Conceptual:

```http
GET /api/account/policy-consents/pending
```

Exact route naming is implementation-specific.

## 61. Accept Policy API

Conceptual:

```http
POST /api/account/policy-consents
```

Payload should identify:

```text
policy_version_id
```

The authenticated account is derived from session/token.

## 62. No Client Identity Trust

Consent endpoint must not trust client-supplied:

```text
user_id
email
role
```

as the accepting identity.

## 63. Consent Validation

Before recording acceptance:

- policy version exists
- policy version is valid/published
- acceptance applies to current authenticated account
- duplicate acceptance is handled idempotently

## 64. Consent Idempotency

Repeated acceptance of the same:

```text
user_id + policy_version_id
```

should not create inconsistent duplicate state.

# Admin UI

## 65. Recommended Route

```text
/settings/platform
```

or:

```text
/platform-settings
```

## 66. Recommended Sections

```text
Announcements
Terms of Service
Privacy Policy
Internal Rules
```

## 67. Announcement List

Recommended columns:

```text
Title
Status
Updated At
Published At
Published By
```

## 68. Policy List

Recommended:

```text
Policy Type
Current Version
Published At
Requires Re-Consent
```

## 69. Policy History

Authorized Admin should be able to inspect historical versions.

## 70. Editor States

Support:

```text
loading
editing
dirty
saving
saved
publishing
published
validation error
conflict
server error
```

## 71. Empty Announcement State

Example:

```text
No announcements have been created.
```

## 72. Empty Policy State

If no policy exists:

```text
No published policy version.
```

Do not fabricate default legal text.

# Admin API

## 73. Announcement Management API

Conceptual:

```http
GET  /api/admin/platform-settings/announcements
POST /api/admin/platform-settings/announcements
GET  /api/admin/platform-settings/announcements/{id}
PATCH /api/admin/platform-settings/announcements/{id}
POST /api/admin/platform-settings/announcements/{id}/publish
POST /api/admin/platform-settings/announcements/{id}/archive
```

Archive is optional.

## 74. Policy Management API

Conceptual:

```http
GET  /api/admin/platform-settings/policies
POST /api/admin/platform-settings/policies/{type}/versions
GET  /api/admin/platform-settings/policies/{type}/versions/{id}
PATCH /api/admin/platform-settings/policies/{type}/versions/{id}
POST /api/admin/platform-settings/policies/{type}/versions/{id}/publish
```

## 75. Draft Editing

Only editable/unpublished versions should accept normal PATCH updates.

## 76. Published Version Mutation

Recommended:

```text
reject direct mutation
→ create new draft/version
```

# Data Model

## 77. Announcement Storage

Possible:

```text
announcements
```

Conceptual fields:

```text
id
title
body
status
created_by
updated_by
published_by
published_at
archived_at
timestamps
```

## 78. Policy Storage

Possible:

```text
policies
policy_versions
```

or a single versioned table.
Exact schema is Open.

## 79. Consent Storage

Possible:

```text
policy_consents
```

Conceptual unique relation:

```text
user_id + policy_version_id
```

## 80. User Role Isolation

Consent and publication access should resolve the exact AISLEY account identity.
Email is not a universal user identifier.

# Security

## 81. Authentication

All Admin management endpoints require:

```text
authenticated ADMIN
```

## 82. Authorization

Possible conceptual permissions:

```text
view platform settings
manage announcements
publish announcements
manage policies
publish policies
require re-consent
```

Exact permission names are Open.

## 83. CSRF

Admin web mutations require Sanctum CSRF protection.

## 84. XSS Safety

Announcement/policy content must be safely rendered.
If rich text/HTML is supported:

```text
sanitize on input/output according to editor model
```

Do not trust Admin-authored HTML automatically.

## 85. Secrets

Platform Settings must not expose infrastructure secrets.

## 86. Policy Integrity

Published policy versions should have strong integrity/history protection.

## 87. PII

Policy consent history contains user-account associations and must be access-controlled.

# Audit Logs

## 88. Audit Requirement

Platform publication actions are consequential Admin mutations.
Recommended events:

```text
ANNOUNCEMENT_CREATED
ANNOUNCEMENT_UPDATED
ANNOUNCEMENT_PUBLISHED
ANNOUNCEMENT_ARCHIVED
POLICY_VERSION_CREATED
POLICY_VERSION_PUBLISHED
POLICY_RECONSENT_REQUIRED
```

Exact taxonomy follows System Audit Logs.

## 89. Audit Data

Recommended:

```text
Admin actor
content ID/version
content type
before/after status
requires_reconsent flag
timestamp
```

Avoid duplicating entire long policy bodies in Audit Logs.

## 90. User Consent Audit

User acceptance history should be retained in the consent domain.
Whether every user consent is also written to System Audit Logs is not required and may be too high-volume.

# Integrations

## 91. User Dashboard Feed

Published announcements should appear in the applicable user dashboard/feed.
Exact UI placement is app-specific.

## 92. Admin Dashboard

Admin Dashboard may link to Platform Settings but does not need to duplicate announcement/policy management.

## 93. Push Notification Management

Publishing does not auto-send Push/SMS.
A separate campaign may reference the announcement.

## 94. Admin Chat

Announcements should not create direct-message threads.

## 95. Admin Notifications

Publishing a platform announcement is not an inbound Admin Notification event by default.

## 96. Admin Auth

Policy re-consent may be checked during or immediately after authenticated session establishment.
Admin Auth remains responsible for authentication; policy consent remains owned by Platform Settings/consent logic.

# Error Handling

## 97. Errors

Handle:

```text
content not found
invalid status
permission denied
validation error
publish conflict
already published
policy version conflict
session expired
storage/database failure
```

## 98. Publication Failure

If publication transaction fails:

```text
do not expose content as published
```

## 99. Feed Failure

If publication commits but a downstream cached feed update fails:

```text
published state remains authoritative
→ invalidate/retry feed cache
```

## 100. Re-Consent Activation Failure

If publication requiring re-consent commits but downstream cache/event processing fails:

```text
policy version remains published
```

The authoritative re-consent query should still derive the requirement from durable version/consent records.

# Performance

## 101. Announcement Queries

Use:

- published-status index
- publication ordering
- bounded pagination

## 102. Current Policy Query

Current published policy should be efficient and cacheable.

## 103. Re-Consent Scale

Do not necessarily create one synchronous row/update for every active user during policy publication.
Recommended scalable model:

```text
publish new policy version requiring consent
→ on next authenticated session
→ compare user's consent records with current required version
```

This avoids mass-updating every user during publication.

## 104. Mass User Update Boundary

`Admin.md` says trigger a requires-re-consent flag for all active users, but implementation need not mean:

```text
UPDATE every user row synchronously
```

The requirement is behavioral:

```text
affected active users must be recognized as needing re-consent
```

## 105. Caching

Announcements/current policy may be cached.
Publication must invalidate/update relevant caches.

# Accessibility / UX

## 106. Accessibility

The Admin editor should:

- use semantic labels
- expose status in text
- support keyboard operation
- make publish confirmations accessible
- expose validation errors clearly
- not rely on color alone

## 107. User Policy Screen

Re-consent UI should:

- clearly identify policy type/version
- provide readable policy content
- provide accessible consent controls
- not pre-check acceptance by default
  Exact legal UX is Open.

## 108. Responsive Behavior

Platform Settings management and user-facing policy content should remain usable on smaller screens.

# MVP Scope

## 109. Required

- authenticated Admin Platform Settings page
- announcement drafts
- announcement publish
- user dashboard/feed integration
- Terms of Service versions
- Privacy Policy versions
- internal rules versions/content
- draft vs published distinction
- publication metadata
- historical policy versions
- optional `requires_reconsent`
- role-aware user consent records
- next-login/session re-consent detection
- safe content rendering
- Admin authorization
- CSRF
- System Audit Log integration
- loading/empty/error states

## 110. Recommended

- `DRAFT → PUBLISHED → ARCHIVED` announcements
- immutable published policy versions
- preview before publish
- explicit publish confirmation
- policy version history UI
- scalable consent comparison rather than mass user-row update
- cache invalidation
- idempotent policy acceptance

## 111. Not Required

- Push/SMS sending
- email campaign sending
- announcement scheduling
- role-targeted announcements
- announcement expiry
- localization
- legal-text generation
- external CMS
- external consent-management provider
- API key editing
- payment/shipping configuration
- deployment configuration
- feature flags
- automatic policy translation

# Acceptance Criteria

## 112. AC-01 — Admin Access

Unauthenticated/non-Admin users cannot manage Platform Settings.

## 113. AC-02 — Permission

Announcement/policy mutations require configured Admin permissions.

## 114. AC-03 — Draft Announcement

Authorized Admin can create/save an unpublished announcement draft.

## 115. AC-04 — Draft Visibility

A DRAFT announcement is not visible in the normal user feed.

## 116. AC-05 — Publish Announcement

Authorized Admin can publish a valid draft.

## 117. AC-06 — Feed Visibility

Published announcement becomes retrievable by the applicable user feed.

## 118. AC-07 — No Push Auto-Send

Publishing an announcement does not automatically dispatch Push/SMS.

## 119. AC-08 — Announcement History

Archiving/removing from active feed does not erase required historical metadata.

## 120. AC-09 — Terms Version

Admin can create/publish a version of Terms of Service.

## 121. AC-10 — Privacy Version

Admin can create/publish a version of Privacy Policy.

## 122. AC-11 — Internal Rules

Admin can maintain internal-rules content/version according to visibility policy.

## 123. AC-12 — Published Policy History

Publishing a new version does not overwrite historical published versions.

## 124. AC-13 — Single Current Version

A policy type resolves deterministically to one current published version.

## 125. AC-14 — Re-Consent Optional

Admin can publish a policy with re-consent required or not required according to policy.

## 126. AC-15 — Role-Aware Consent

Consent attaches to exact user/account ID, not email alone.

## 127. AC-16 — Same Email Isolation

Buyer and Seller accounts sharing an email may hold separate consent records.

## 128. AC-17 — New Version Consent

Acceptance of an older policy version does not satisfy a newer required version.

## 129. AC-18 — Consent Idempotency

Repeated acceptance of the same required version does not create inconsistent duplicate state.

## 130. AC-19 — Next Login Detection

An affected authenticated user can be detected as requiring re-consent on a later login/session.

## 131. AC-20 — Published Content Safety

Announcement/policy content cannot execute unsafe scripts in user/Admin UI.

## 132. AC-21 — No Secret Editing

Platform Settings does not expose deployment/API secrets as ordinary Admin-editable content.

## 133. AC-22 — CSRF

Admin mutations use configured Sanctum CSRF protection.

## 134. AC-23 — Audit Publish

Announcement/policy publication creates safe Audit events.

## 135. AC-24 — Audit Re-Consent

Publishing with re-consent records the flag/action safely.

## 136. AC-25 — No Full Policy Body in Audit

Audit Logs need not duplicate the complete long policy text.

## 137. AC-26 — Publication Concurrency

Two simultaneous publish attempts cannot leave conflicting current policy versions.

## 138. AC-27 — Publication Failure

Failed publication does not present content as successfully published.

## 139. AC-28 — Scalable Re-Consent

Policy publication does not require synchronously updating every user row to enforce future re-consent.

# Tests

## 140. Backend Tests

Test:

- guest denied
- non-Admin denied
- Admin without permission denied
- create announcement draft
- draft excluded from user feed
- publish announcement
- published announcement appears in feed
- publish does not invoke Push/SMS automatically
- archive removes from active feed without losing history
- create Terms draft/version
- publish Terms version
- create/publish Privacy version
- create/publish internal rules
- old policy version preserved
- one current published version per type
- requires_reconsent true persisted
- requires_reconsent false persisted
- user consent attaches to exact user ID
- same-email role accounts isolated
- old consent does not satisfy new required version
- duplicate consent idempotent
- pending consent detection works
- unsafe HTML sanitized/escaped
- API secrets are not exposed
- publication concurrency handled
- publish Audit event created
- re-consent flag audited
- CSRF required
- cache/feed invalidation works if caching used

## 141. Frontend Tests

Test:

- Platform Settings loads
- announcement empty state
- create/edit draft
- preview
- publish confirmation
- published status shown
- archive behavior if supported
- Terms version list
- Privacy version list
- internal-rules view
- historical versions visible
- requires-reconsent control visible when authorized
- warning shown before re-consent publication
- unsafe content does not execute
- session expiration handled
- permission-restricted actions unavailable
- responsive layout
- keyboard accessibility
- status not color-only

# Open Decisions

## 142. Open Decisions

Current sources do not define:

1. exact routes
2. exact Admin permission keys
3. announcement status enum
4. archive support
5. published announcement editing
6. announcement scheduling
7. announcement expiry
8. pinned announcements
9. announcement categories
10. role-targeted announcements
11. guest announcement visibility
12. rich text vs Markdown vs plain text
13. exact sanitizer/editor
14. announcement retention
15. policy version numbering
16. effective-date behavior
17. internal-rules audience/visibility
18. whether internal rules require consent
19. exact definition of active user
20. whether all roles require policy consent
21. whether Courier mobile users are included
22. whether Admin accounts require policy consent
23. exact re-consent blocking behavior
24. decline behavior
25. grace period
26. multiple-policy re-consent ordering
27. policy acceptance UX
28. policy consent metadata beyond user/version/time
29. consent IP/user-agent storage
30. consent retention
31. policy rollback
32. policy appeal/legal review workflow
33. whether a second Admin must approve policy publication
34. feed API shape
35. feed pagination
36. cache technology/TTL
37. publication cache invalidation
38. user notification beyond dashboard feed
39. email notification of policy updates
40. announcement analytics/read tracking
41. localization/translation
42. external CMS
43. external consent provider
44. exact Audit event names
45. whether announcement updates after publish create revisions

# Final Definition

## 143. Final Definition

AISLEY Manage Platform Settings is:

```text
an Admin-controlled global content and policy module

for:
    platform announcements
    Terms of Service
    Privacy Policy
    internal rules
```

Announcement behavior:

```text
draft
→ publish
→ user dashboard/feed
→ optional archive
```

Policy behavior:

```text
draft new version
→ publish immutable/current version
→ optional requires_reconsent
→ affected user detected on next authenticated session
→ consent stored against exact account + version
```

Central announcement boundary:

```text
Publishing an announcement
does not automatically send
Push/SMS campaigns.
```

Central consent rule:

```text
Consent belongs to a specific AISLEY account,
not merely an email address.
```

Central history rule:

```text
Published policy versions and prior consent history
must not be silently overwritten.
```
