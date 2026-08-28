---
feature: Notification Management
system: AISLEY
type: Feature Specification
version: 3.0
status: Draft
scope: Admin Web Application / Outbound Role-Targeted User Notifications
source_coverage: app.md, Admin.md, project clarification
project_override: Email via Brevo is the MVP delivery channel. Push and SMS are future extensions, not MVP requirements.
---

# Notification Management Specification

## 1. Purpose

Notification Management is AISLEY's Admin-controlled outbound communication feature for sending targeted notifications to AISLEY user roles and segments.
The intended MVP behavior is:

```text
Admin creates notification
→ selects target role / segment
→ AISLEY resolves recipients
→ AISLEY queues email delivery
→ Brevo sends the email
→ AISLEY records campaign results
```

This project clarification intentionally narrows the older `Admin.md` wording that described Push/SMS delivery.
For the MVP:

```text
EMAIL = required delivery channel
PUSH = future
SMS = future
```

No separate Push or SMS provider is required for the MVP.

## 2. Existing Email Provider

`app.md` explicitly defines:

```text
Brevo
```

for sending emails.
Therefore Notification Management should reuse the existing AISLEY email integration rather than introduce a second notification provider.

## 3. Why Brevo Is Used

AISLEY owns:

- who should receive the notification
- which role/segment is targeted
- notification content
- campaign history
- recipient resolution
- delivery state
  Brevo only handles:

```text
actual email transport
```

Conceptually:

```text
AISLEY business logic
→ Brevo email API
→ recipient inbox
```

## 4. Core Boundary

Notification Management is:

```text
Admin → AISLEY users
```

It is not:

```text
platform → Admin attention feed
```

That belongs to:

```text
Admin Notifications
```

## 5. Admin Notifications vs Notification Management

```text
Admin Notifications
    inbound operational alerts for Admins

Notification Management
    outbound Admin-created user communications
```

These must remain separate.

## 6. Platform Settings Boundary

Manage Platform Settings owns:

```text
platform announcements
Terms of Service
Privacy Policy
internal rules
```

Notification Management may distribute or reference announcement content by email.
Publishing an announcement does not automatically email all users unless an Admin explicitly creates/sends a notification campaign.

## 7. Admin Chat Boundary

Admin Chat / Messaging is:

```text
Admin ↔ specific user
two-way conversation
```

Notification Management is:

```text
Admin → many selected users
one-way campaign communication
```

A campaign must not create one Admin Chat thread per recipient.

## 8. Primary Actor

The primary actor is:

```text
ADMIN
```

Only authenticated and authorized Admins may create, preview, or send user notification campaigns.

# Audience

## 9. Core Role Targets

AISLEY user roles include:

```text
BUYER
SELLER
LOGISTICS
COURIER
```

Notification Management should support targeting these role-accounts.

## 10. Role-Specific Notification Examples

Examples:

```text
BUYER
    marketplace announcement
    promotion
    re-engagement email

SELLER
    Seller-specific announcement
    platform update
    Seller reminder

LOGISTICS
    Logistics-specific announcement
    service notice

COURIER
    Courier-specific announcement
    operational or safety notice
```

These are examples, not mandatory template categories.

## 11. All Users

A campaign may target:

```text
ALL USERS
```

if the Admin has permission and the message is appropriate for all supported user roles.

## 12. Single Role

Examples:

```text
BUYER only
SELLER only
LOGISTICS only
COURIER only
```

## 13. Multiple Roles

Recommended:

```text
BUYER + SELLER
SELLER + LOGISTICS
all supported roles
```

Exact role-combination UI is implementation-specific.

## 14. Role-Aware Identity

AISLEY uses:

```text
unique(email, role)
```

Therefore audience membership is based on:

```text
user_id + role
```

not email alone.

## 15. Same Email Across Roles

Example:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

These are separate AISLEY role-accounts.
If both roles are targeted, the account model may produce two logical recipients even if the physical email address is the same.
Exact duplicate-email delivery policy is an Open Decision.

## 16. Behavioral Segments

The older source gives examples such as:

```text
inactive Buyers
top-performing Sellers
```

These can remain optional segment capabilities.
They are not required to define the basic role-targeting feature.

## 17. Inactive Buyer

If implemented, "inactive" must be configured explicitly.
The source does not define:

```text
30 days
60 days
90 days
```

Do not invent a default inactivity threshold.

## 18. Top-Performing Seller

If implemented, the source does not define whether "top-performing" means:

```text
sales
order count
rating
revenue
time period
```

This remains configurable/Open.

## 19. Segment Membership

A segment returns exact AISLEY role-accounts.
Example:

```text
role = BUYER
last_activity < configured threshold
```

## 20. Audience Preview

Before sending, Admin should be able to see:

```text
target role(s)
segment criteria
matched account count
email-eligible count
excluded count
```

## 21. Recipient Eligibility

For EMAIL MVP, a recipient generally needs:

```text
valid account email
```

Other eligibility rules such as:

- email preferences
- marketing consent
- banned-account exclusion
- suspended-account exclusion
  are Open Decisions unless defined elsewhere.

# Campaign

## 22. Campaign Definition

A notification campaign stores:

- creator
- target audience
- subject
- message body
- delivery channel
- campaign state
- recipient results
- timestamps

## 23. MVP Channel

MVP:

```text
EMAIL
```

Future:

```text
PUSH
SMS
```

## 24. Recommended Campaign Lifecycle

Recommended:

```text
DRAFT
QUEUED
PROCESSING
COMPLETED
PARTIAL
FAILED
```

Exact enum names are implementation-defined.

## 25. Draft

A `DRAFT` campaign:

- is editable
- has not begun delivery
- may be incomplete

## 26. Queued

`QUEUED` means:

```text
Admin confirmed send
and the campaign is waiting for background processing
```

## 27. Processing

`PROCESSING` means:

```text
recipient emails are being generated/sent
```

## 28. Completed

`COMPLETED` means:

```text
campaign processing finished successfully according to configured completion policy
```

It does not guarantee every recipient read the email.

## 29. Partial

Recommended:

```text
some recipients succeeded
some failed or were skipped
```

## 30. Failed

`FAILED` indicates campaign-level processing could not complete meaningfully.
Exact thresholds are Open.

# Message Composition

## 31. Email Subject

Required:

```text
subject
```

Requirements:

- non-empty
- bounded length
- safe text
  Exact maximum length is Open.

## 32. Email Body

Required:

```text
message body
```

Content format may be:

```text
plain text
HTML template
rich email template
```

Exact rendering model is Open.

## 33. Safe HTML

If HTML email is supported:

- sanitize/admin-template content as appropriate
- do not permit unsafe script execution
- ensure generated email markup is provider-compatible

## 34. Branding

Recommended:

```text
AISLEY email branding
```

using shared email layout/templates.
Exact design belongs to the email/design system.

## 35. Message Preview

Admin should preview:

```text
subject
body
target role/segment
estimated recipients
```

before sending.

## 36. Templates

Reusable email templates are optional.
Not required for MVP.

## 37. Personalization

Variables such as:

```text
{{name}}
```

are optional and not source-required.

## 38. Links

Email links should point to approved AISLEY routes/domains.
Avoid arbitrary unsafe links in Admin-authored campaign content.

# Delivery

## 39. Delivery Architecture

MVP:

```text
Admin confirms send
→ campaign QUEUED
→ background worker resolves recipient batch
→ email job calls shared Brevo integration
→ result recorded
```

## 40. Why Queueing Is Still Useful

Even with email only, sending hundreds or thousands of emails synchronously inside one Admin HTTP request is undesirable.
Recommended:

```text
Admin request
→ queue work
→ immediately return campaign status
```

This prevents:

- long request timeouts
- partial browser failures
- excessive memory use
- poor retry control

## 41. Queue Vendor

A third-party queue vendor is not required.
AISLEY may use the queue technology already supported by the backend.
Exact queue technology is Open.

## 42. Redis/Celery

The older `Admin.md` listed:

```text
Redis/Celery
```

as examples.
They are not requirements.
Laravel's own queue-supported architecture or another project-selected mechanism may be used.

## 43. Background Batch Processing

Recommended:

```text
campaign
→ recipient snapshot/list
→ bounded batches
→ email jobs
```

## 44. Brevo Integration

The email job should use the existing shared Brevo email service.
Do not create a second Brevo implementation just for campaign notifications.

## 45. Brevo Responsibility

Brevo handles:

- email transport
- provider acceptance/error result
  AISLEY handles:
- campaign state
- audience
- recipient records
- retries
- history
- permissions

## 46. Provider Acceptance

If Brevo accepts a send:

```text
SENT
```

may be recorded according to provider semantics.
Do not claim:

```text
READ
```

unless the system later integrates reliable tracking and explicitly defines it.

## 47. Brevo Failure

A temporary provider failure should not delete the campaign.
Recommended:

```text
record failure
→ retry according to policy
```

## 48. Invalid Email

Invalid/unusable email:

```text
SKIPPED
or
FAILED
```

for that recipient according to implementation.
It must not fail the entire campaign.

## 49. Partial Failure

Successful recipient sends remain successful even if other recipients fail.

# Recipient Records

## 50. Recommended Recipient Record

Conceptual:

```text
campaign_id
user_id
role
email_reference
status
attempt_count
provider_message_id
last_error
timestamps
```

## 51. Recipient Status

Recommended:

```text
PENDING
SENT
FAILED
SKIPPED
```

Exact enum is Open.

## 52. Email Privacy

Campaign history should avoid exposing full recipient lists unnecessarily.
Use:

- aggregate totals by default
- masked email where recipient detail is needed
- pagination

## 53. Deduplication

Prevent duplicate email jobs for the same logical campaign recipient.
Recommended unique identity:

```text
campaign_id + user_id + role
```

## 54. Same Physical Email

Because same email may belong to multiple role-accounts, physical-email deduplication is a product decision.
Possible policies:

```text
send once per role-account
```

or:

```text
send once per email for identical campaign
```

Open Decision.

# Admin UI

## 55. Recommended Route

```text
/notification-management
```

or:

```text
/notifications/manage
```

## 56. Campaign List

Recommended columns:

```text
Campaign
Audience
Channel
Status
Created By
Created At
Processed At
```

Channel for MVP:

```text
EMAIL
```

## 57. Filters

Recommended:

```text
status
target role
creator
date
```

## 58. Pagination

Campaign history must be paginated/bounded.

## 59. New Campaign UI

Recommended sequence:

```text
Choose audience
→ optional segment
→ preview recipient count
→ compose email
→ preview
→ confirm
→ send
```

## 60. Audience Selector

Minimum role options:

```text
Buyers
Sellers
Logistics
Couriers
All Users
```

## 61. Behavioral Segment Selector

Optional:

```text
Inactive Buyers
Top-Performing Sellers
```

once their definitions are configured.

## 62. Confirmation

Sending to many users is a consequential operation.
Require explicit confirmation.
Recommended summary:

```text
Channel: Email
Audience
Recipient estimate
Subject
Message preview
```

## 63. Edit After Queue

Once:

```text
QUEUED
```

the send configuration should not be silently modified.
Recommended:

```text
queued campaign configuration = immutable
```

## 64. Campaign Detail

Recommended:

- campaign ID
- creator
- target role/segment
- subject/body
- state
- matched count
- sent count
- failed count
- skipped count
- created/queued/completed times

# API

## 65. Campaign List

Conceptual:

```http
GET /api/admin/notification-campaigns
```

## 66. Create Draft

Conceptual:

```http
POST /api/admin/notification-campaigns
```

## 67. Update Draft

Conceptual:

```http
PATCH /api/admin/notification-campaigns/{campaignId}
```

Only editable while draft.

## 68. Preview Audience

Conceptual:

```http
POST /api/admin/notification-campaigns/{campaignId}/preview
```

## 69. Send

Conceptual:

```http
POST /api/admin/notification-campaigns/{campaignId}/send
```

Responsibilities:

- authenticate Admin
- authorize send
- validate campaign
- resolve/freeze configuration
- transition to queued
- persist
- emit Audit event
- enqueue delivery work

## 70. Send Response

Recommended:

```text
campaign accepted / queued
```

Do not wait for all email sends.

## 71. Campaign Detail

Conceptual:

```http
GET /api/admin/notification-campaigns/{campaignId}
```

## 72. Recipient Results

Optional:

```http
GET /api/admin/notification-campaigns/{campaignId}/recipients
```

Must be paginated and PII-safe.

# Authentication / Authorization

## 73. Authentication

All management endpoints require:

```text
authenticated ADMIN
```

## 74. Permissions

Possible conceptual permissions:

```text
view notification campaigns
create notification campaigns
send notification campaigns
view delivery results
```

Exact permission keys are Open.

## 75. CSRF

Admin web campaign mutations require Sanctum CSRF protection.

## 76. High-Impact Send

The permission to send to all users may be separated from draft creation if desired.
Open Decision.

# Security

## 77. Target Authorization

An Admin must not be able to bypass role/segment restrictions by injecting arbitrary recipient IDs.

## 78. Recipient Query

Recipient resolution happens on the backend.
Do not trust a browser-submitted raw recipient list as authoritative.

## 79. Brevo Credentials

Brevo API credentials must remain in secure server configuration.
Do not expose them:

- to the browser
- in campaign records
- in Audit Logs

## 80. Email Address Safety

Do not expose unnecessary full email lists in the Admin interface.

## 81. Content Safety

Safely render campaign content in Admin preview/history.

## 82. Link Safety

Restrict campaign CTA/deep links to approved destinations if link fields are supported.

# Audit Logs

## 83. Audit Requirement

Campaign send actions should be auditable.
Recommended events:

```text
NOTIFICATION_CAMPAIGN_CREATED
NOTIFICATION_CAMPAIGN_UPDATED
NOTIFICATION_CAMPAIGN_QUEUED
NOTIFICATION_CAMPAIGN_COMPLETED
```

Exact taxonomy is Open.

## 84. Audit Data

Recommended:

```text
Admin actor
campaign ID
delivery channel
target role/segment
recipient count
state change
timestamp
```

Do not place full recipient lists or Brevo credentials into Audit Logs.

# Cross-Feature Integrations

## 85. Platform Settings

A published announcement may be used as the content basis for an email campaign.
Recommended:

```text
published announcement
→ Create Notification Campaign
→ copy/reference content
→ Admin confirms audience/send
```

No automatic broadcast.

## 86. Manage Account Registrations

Account Approval already sends individual:

```text
approval/rejection email
```

Those transactional emails remain owned by Manage Account Registrations.
They do not need to be manually created through Notification Management.

## 87. Seller Compliance

Formal Seller warnings are direct case-related communication.
They remain owned by:

```text
Seller Compliance + Admin Chat
```

Do not require mass Notification Management for individual compliance warnings.

## 88. Admin Notifications

Campaign completion/failure may optionally create an Admin Notification.
This is optional.

# Error Handling

## 89. Errors

Handle:

```text
campaign not found
permission denied
invalid audience
empty recipient audience
invalid subject/body
already queued
stale edit
queue failure
Brevo failure
session expired
```

## 90. Empty Audience

If the resolved audience has zero eligible recipients:

```text
do not dispatch
```

Require Admin to adjust or explicitly handle according to UX policy.

## 91. Queue Failure

If queue insertion fails:

```text
do not claim campaign is successfully processing
```

## 92. Brevo Failure

Brevo outage:

```text
campaign remains durable
→ failed recipient jobs retained
→ retries follow configured policy
```

## 93. Campaign State Accuracy

Do not show:

```text
COMPLETED
```

while required recipient jobs remain pending.

# Performance

## 94. Large Audience

The system must not load all user records into the browser.
Audience resolution belongs on the backend.

## 95. Batching

Large campaigns should use bounded recipient batches/jobs.

## 96. No N+1

Segment queries should avoid one query per user.

## 97. Aggregate Progress

Campaign UI should query aggregate counts rather than loading all recipient rows.

# UX / Accessibility

## 98. Campaign States

Support:

```text
loading
editing
saving
previewing
confirming
queued
processing
completed
partial
failed
```

## 99. Progress

For queued campaigns:

```text
show aggregate progress/status
```

rather than a blocking send spinner.

## 100. Accessibility

UI should:

- label target roles clearly
- expose campaign state textually
- support keyboard operation
- use accessible confirmation dialogs
- expose validation errors clearly
- not rely on color alone

## 101. Responsive Behavior

Campaign list/editor/detail should remain usable on smaller Admin screens.

# MVP Scope

## 102. Required

- authenticated Admin Notification Management page
- EMAIL delivery channel
- shared Brevo integration
- Buyer targeting
- Seller targeting
- Logistics targeting
- Courier targeting
- All Users targeting
- role-aware user identity
- campaign drafts
- subject/body composition
- audience preview/count
- explicit send confirmation
- asynchronous queue/background delivery
- recipient batching
- recipient sent/failed/skipped state
- campaign aggregate result
- duplicate-job protection
- campaign history
- pagination
- System Audit Log integration
- CSRF
- PII/credential protection
- loading/error/progress states

## 103. Recommended

- multiple-role targeting
- optional behavioral segments
- inactive Buyer segment once defined
- top-performing Seller segment once defined
- masked recipient email display
- bounded retry
- campaign completion/failure Admin Notification
- announcement-to-campaign handoff
- shared email templates/branding

## 104. Future / Not MVP

- mobile Push notifications
- SMS blasts
- Firebase Cloud Messaging
- Twilio
- AWS SNS
- device-token storage
- SMS phone normalization
- mobile Push delivery receipts
- scheduled campaigns
- recurring campaigns
- A/B tests
- AI message generation
- personalization variables
- click/open analytics
- budget/cost controls

# Acceptance Criteria

## 105. AC-01 — Admin Access

Guests/non-Admins cannot access Notification Management endpoints.

## 106. AC-02 — Permission

Campaign send requires configured Admin authorization.

## 107. AC-03 — Email MVP

The MVP delivery channel is Email.

## 108. AC-04 — Brevo Reuse

Notification Management uses AISLEY's shared Brevo email integration.

## 109. AC-05 — No Push Provider

MVP does not require Firebase, SNS, or another mobile Push provider.

## 110. AC-06 — No SMS Provider

MVP does not require Twilio or another SMS provider.

## 111. AC-07 — Buyer Targeting

Admin can target Buyer role-accounts.

## 112. AC-08 — Seller Targeting

Admin can target Seller role-accounts.

## 113. AC-09 — Logistics Targeting

Admin can target Logistics role-accounts.

## 114. AC-10 — Courier Targeting

Admin can target Courier role-accounts.

## 115. AC-11 — Role-Aware Identity

Audience resolution targets exact account IDs/roles, not email alone.

## 116. AC-12 — Draft

Admin can save a campaign without sending it.

## 117. AC-13 — Preview

Admin can preview target audience/count before sending.

## 118. AC-14 — Confirmation

Admin must explicitly confirm campaign delivery.

## 119. AC-15 — Async Delivery

Large email campaigns are queued/background processed rather than fully sent inside the Admin HTTP request.

## 120. AC-16 — Invalid Recipient Isolation

One invalid email does not fail the entire campaign.

## 121. AC-17 — Retry Safety

Retrying delivery does not create uncontrolled duplicate emails for the same logical recipient.

## 122. AC-18 — Partial Failure

Successful sends remain recorded when other recipients fail.

## 123. AC-19 — State Accuracy

Campaign state reflects actual background processing state.

## 124. AC-20 — Read Claim

AISLEY does not claim an email was read merely because Brevo accepted delivery.

## 125. AC-21 — Brevo Secret Safety

Brevo credentials never appear in browser payloads or Audit Logs.

## 126. AC-22 — PII Safety

Campaign list/detail does not expose unnecessary full recipient email lists.

## 127. AC-23 — Admin Notification Boundary

This feature does not replace the inbound Admin Notifications feed.

## 128. AC-24 — Platform Settings Boundary

Publishing an announcement does not automatically send an email campaign.

## 129. AC-25 — Registration Email Boundary

Approval/rejection emails remain owned by Manage Account Registrations.

## 130. AC-26 — Audit

Campaign send creates a safe Audit event.

## 131. AC-27 — Pagination

Campaign history/recipient details are bounded.

## 132. AC-28 — CSRF

Admin campaign mutations require configured Sanctum CSRF protection.

# Tests

## 133. Backend Tests

Test:

- guest denied
- non-Admin denied
- unauthorized send denied
- create email campaign draft
- Buyer target resolution
- Seller target resolution
- Logistics target resolution
- Courier target resolution
- all-user target resolution
- same-email role accounts resolved distinctly
- audience preview
- empty audience handling
- subject/body validation
- send confirmation endpoint validation
- campaign transitions to queued
- background jobs created
- Brevo shared service called
- invalid email isolated
- recipient status stored
- duplicate retry protection
- partial failure aggregation
- completed state waits for terminal jobs
- Brevo credentials absent from responses/logs
- campaign send audited
- pagination
- CSRF required

## 134. Frontend Tests

Test:

- campaign list loads
- create draft
- target-role selector
- Buyer/Seller/Logistics/Courier options
- All Users option
- optional segment selector
- audience preview
- subject/body validation
- email preview
- send confirmation
- queued/processing state
- completed/partial/failed states
- aggregate results
- recipient emails masked where shown
- responsive layout
- keyboard accessibility
- state not color-only

# Open Decisions

## 135. Open Decisions

Current requirements do not define:

1. exact campaign status enum
2. exact recipient status enum
3. duplicate physical-email handling across role-accounts
4. whether all roles may be combined arbitrarily
5. inactive Buyer definition
6. top-performing Seller definition
7. other behavioral segments
8. email marketing consent/preferences
9. unsubscribe behavior
10. globally banned-user campaign eligibility
11. suspended/deactivated-user eligibility
12. exact email subject limit
13. email body format
14. template system
15. personalization
16. queue technology
17. batch size
18. worker concurrency
19. retry count/backoff
20. Brevo rate-limit handling
21. provider message-ID storage
22. delivery/open/click tracking
23. campaign cancellation
24. campaign clone
25. scheduling
26. recurring campaigns
27. exact permission keys
28. campaign retention
29. recipient-record retention
30. exact Audit event names
31. campaign completion/failure Admin Notification
32. whether Push is added later
33. whether SMS is added later

# Final Definition

## 136. Final Definition

AISLEY Notification Management is:

```text
an Admin-controlled,
role-targeted outbound email communication feature.
```

MVP:

```text
Admin
→ choose Buyer / Seller / Logistics / Courier / All
→ optional behavioral segment
→ compose email
→ preview audience
→ confirm
→ queue
→ Brevo
→ recipient inbox
```

AISLEY owns:

```text
audience
business rules
campaign content
recipient resolution
campaign history
delivery state
```

Brevo owns:

```text
email transport
```

Future:

```text
PUSH
SMS
```

No Push/SMS provider is required for the MVP.
