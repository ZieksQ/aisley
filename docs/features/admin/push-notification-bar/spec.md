---
feature: push-notification-bar
title: Admin Push Notification Bar
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Push Notification Bar
## WHAT
- **Purpose:** Provide an Admin-facing outbound notification composer for sending targeted push notifications and, when enabled, SMS messages to selected AISLEY user segments.
- **Primary actor:** Authenticated `ADMIN`.
- **Source terminology:** `Admin.md` calls the underlying capability **Push Notification Management**.
- **Feature name in this project:** `push-notification-bar`.
- **Source-defined capabilities:**
  - compose customized notification messages
  - target specific user segments
  - send push notifications
  - optionally send SMS blasts
  - support announcements, promotions, re-engagement, and critical alerts
  - dispatch large recipient batches asynchronously
- **Example source segments:**
  - inactive buyers
  - top-performing sellers
- These are examples, not the complete segmentation model.
- **Architecture:**
  - Next.js/React owns the Admin composer/bar UI, audience controls, preview, confirmation, submission state, and campaign/result display.
  - Laravel owns authorization, audience resolution, validation, campaign persistence, dispatch jobs, provider integrations, consent/preferences, retries, and audit records.
  - Third-party providers deliver external push/SMS.
- **Outbound flow:**
```text
Admin composes message
→ selects channel(s)
→ selects approved audience segment
→ preview/recipient estimate
→ confirms send
→ Laravel validates + authorizes
→ persist campaign
→ queue fan-out
→ provider delivery
→ update campaign delivery status
```
- **Feature boundary:**
  - `admin-notification` is the Admin's inbound notification inbox.
  - `push-notification-bar` is an outbound Admin communication tool.
  - Manage Platform Settings owns persistent platform announcements/policies.
  - Publishing an announcement does not automatically send a push/SMS campaign.
  - Chat/Messaging owns direct conversation messages.
- **Recommended UI placement:** a dedicated Admin communication control/page, optionally exposed from a top/header bar.
- **Recommended route:**
```text
/push-notifications
```
or repository-equivalent.
- **MVP recommendation:** support push first; SMS only when a provider, consent model, and project requirement are configured.
- **Non-goals:**
  - Admin inbox/read receipts
  - ordinary chat messages
  - email marketing unless separately specified
  - arbitrary raw provider API access from the browser
  - sending without consent/preferences where required
  - client-side audience calculation
  - storing provider secrets in Next.js browser code
## MUST
### Access control
- Every push-notification-bar API requires:
  - authenticated session
  - persisted role = `ADMIN`
  - Push Notification Management permission where custom Admin permissions exist
- Laravel authorization is authoritative.
- Frontend visibility is not authorization.
- Direct API requests cannot bypass permission checks.
- Provider credentials must remain server-side.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `404` campaign/segment not found
  - `422` validation failure
  - `409` duplicate/conflicting dispatch state
### Campaign model
- Each outbound send must be represented as a server-side campaign/message record.
- Minimum conceptual fields:
  - immutable campaign ID
  - title
  - body
  - selected channel(s)
  - audience/segment definition or reference
  - status
  - creating Admin ID
  - created timestamp
- Recommended optional fields:
  - scheduled/send timestamp
  - destination/deep link
  - recipient estimate
  - sent count
  - failed count
  - completed timestamp
- Exact campaign-status names are not source-defined.
- Recommended lifecycle:
```text
DRAFT
→ QUEUED
→ SENDING
→ COMPLETED

or
→ FAILED / PARTIALLY_FAILED
```
- The client must not assign arbitrary campaign status values.
- A campaign must not become `COMPLETED` merely because it was accepted into the queue.
### Composer
- Admin must be able to provide:
  - notification title
  - notification body
  - delivery channel(s)
  - approved audience segment
- Optional fields when supported:
  - internal destination/deep link
  - image/icon
  - scheduled send time
- Title/body must be validated server-side.
- Define maximum lengths compatible with selected providers/clients.
- Do not allow raw HTML/script execution in notification content.
- Do not trust client-provided recipient IDs generated from arbitrary frontend filtering.
### Audience segmentation
- Audience resolution must happen in Laravel.
- Admin chooses only approved segment definitions/filters.
- Segment filters must be allow-listed.
- Source examples include:
  - inactive buyers
  - top-performing sellers
- Exact definitions of "inactive" and "top-performing" are Open Questions.
- Segment membership must be calculated from authoritative backend data.
- Admin must not receive unrestricted raw user exports solely to build a campaign.
- Respect role boundaries and account status.
- Exclude accounts that cannot legally/technically receive the selected channel.
### Segment snapshot
- Audience membership can change between preview and dispatch.
- Decide whether campaigns use:
  - audience resolved at send time, or
  - a persisted recipient snapshot
- MVP recommendation: resolve and persist recipient targets when campaign dispatch begins so retries use the same intended audience.
- Do not silently expand the audience during retry.
- Exact recipient-snapshot retention is an Open Question.
### Push recipient eligibility
- Push delivery requires a valid registered device/app/browser token or subscription.
- Store push subscription/device registration records server-side.
- A user/account may have multiple devices.
- Invalid/expired device tokens must eventually be disabled/removed.
- Never expose all device tokens to Admin UI.
- Admin selects users/segments, not raw FCM tokens.
- Provider token lifecycle is handled by integration/services.
### Web push permission
- For browser push:
  - browser permission must be granted by the user
  - permission requests must originate from an appropriate user interaction
  - HTTPS/service-worker requirements must be satisfied
- The Admin campaign feature cannot override a user's browser notification permission.
- A user with denied/no permission is excluded from Web Push delivery.
- Do not repeatedly nag users for browser permission after denial.
### Mobile push
- If AISLEY's Flutter/mobile client receives push:
  - register its provider/device token through the authenticated mobile client
  - associate the token with the correct account/device
  - refresh/remove stale tokens according to provider guidance
- Exact Flutter push setup belongs to the client notification-registration implementation.
- Campaign logic should not depend on raw client implementation details.
### Push provider
- `Admin.md` names Firebase Cloud Messaging, Twilio, or AWS SNS as examples.
- Do not treat all of them as simultaneously required.
- The repository/project must select the actual provider.
- **Recommended for AISLEY if no provider is already selected:** Firebase Cloud Messaging for cross-platform push because it supports Web, Android, and Flutter/mobile clients.
- Provider integration must live in a trusted Laravel/server environment.
- Never send FCM/provider server credentials to the browser.
### Push targeting
- Provider-level topic targeting may be used when segment semantics fit provider topics.
- Do not expose arbitrary topic names to the Admin unless those topics are managed/allow-listed by AISLEY.
- For sensitive/small audiences, direct device-token targeting may be preferable to public topic semantics.
- FCM topic messaging is optimized for throughput and is suitable for broad opted-in audiences.
- Exact mapping from AISLEY segments to FCM topics vs direct token fan-out is an implementation decision.
### SMS channel
- SMS is optional until a provider and consent requirements are implemented.
- If SMS is enabled:
  - only users with an eligible verified phone number may receive it
  - respect message consent/communication preferences
  - honor opt-out state
  - use the configured provider from Laravel
  - do not expose provider credentials/client secrets
- SMS campaign behavior must comply with provider and applicable legal requirements.
- Twilio requires recipient consent and supports standard opt-out behavior such as STOP.
- Users who opted out must not receive subsequent promotional SMS.
- Critical transactional/legal exceptions, if any, require separate policy definition.
### User consent/preferences
- Push/SMS marketing communication must respect applicable user consent/preferences.
- Do not assume registration automatically grants unrestricted promotional consent.
- Maintain channel eligibility/preferences in authoritative backend data.
- A segment preview and final dispatch must apply preference/opt-out filtering.
- Preference changes between campaign creation and send must be respected according to the selected audience-resolution policy.
- Exact consent UI belongs to user Account Management/onboarding features.
### Internal destination/deep link
- Push notification may link to an AISLEY page/resource.
- Destination must be allow-listed/internal.
- Laravel must validate destination syntax/type.
- Do not allow arbitrary phishing/external URLs through the Admin composer.
- Opening a push destination must still pass the destination feature's authentication/authorization.
- FCM Web supports HTTPS click links; use the provider/client mechanism appropriate to the target platform.
### Preview
- Before dispatch, show a preview containing:
  - title/body
  - selected channel(s)
  - selected segment
  - estimated eligible recipient count
  - destination when used
- Recipient count is advisory if the audience is resolved at dispatch time.
- Preview must not expose unnecessary user PII or device tokens.
- High-volume sends require a confirmation action.
### Dispatch
- Sending must be asynchronous.
- HTTP request should enqueue work rather than loop through thousands of external provider calls.
- Recommended flow:
```text
POST campaign send
→ validate + authorize
→ lock/check campaign state
→ persist QUEUED
→ commit
→ dispatch fan-out jobs
→ provider batches/messages
→ record aggregate outcomes
```
- Provider/API failures must not block the original HTTP request indefinitely.
- Queue retries must not cause accidental duplicate campaign creation.
- A campaign may be partially successful.
- Do not represent partial failures as total success.
### Queueing and batching
- Use Laravel queues/jobs.
- Dispatch only after campaign transaction commits.
- Split large audiences into bounded batches/chunks.
- Respect provider quotas/rate limits.
- Configure retry/backoff for transient failures.
- Permanent provider failures should be recorded without infinite retry.
- Exact batch size/concurrency depends on provider limits and infrastructure.
- Do not hard-code FCM/Twilio quotas unless verified for the selected account/provider.
### Delivery tracking
- Track at least campaign-level operational state.
- Recommended aggregate counters:
  - intended/eligible recipients
  - queued
  - sent/provider-accepted
  - failed
- Provider acceptance is not always proof that a human saw the notification.
- Do not label provider acceptance as "read".
- Open/read/conversion analytics are not required unless supported and explicitly added.
- Per-device delivery logs may be stored only if operationally necessary and retention is defined.
### Duplicate prevention
- A double-click/retried HTTP request must not enqueue the same campaign twice.
- Use the project's idempotency mechanism or a campaign state transition lock.
- Queue retries may retry delivery tasks without recreating the campaign.
- Provider-specific idempotency/collapse behavior may supplement, not replace, application-level duplicate protection.
### Scheduling
- Source does not require scheduled future sends.
- MVP may support immediate dispatch only.
- If scheduling is added:
  - store UTC scheduled time
  - validate it is in the future
  - let Laravel scheduler/queue trigger dispatch
  - allow cancellation only before dispatch begins
- Exact scheduled-send behavior is an Open Question.
### Campaign history
- Admin should be able to review campaign history for operational accountability.
- History must be paginated.
- Safe fields:
  - campaign ID
  - title
  - channels
  - audience label
  - status
  - counts
  - created/sent timestamps
  - creating Admin
- Do not expose raw device tokens or recipient phone lists.
- Failed campaign details may show safe provider error categories, not credentials/secrets.
### Audit trail
- Creating/sending/cancelling a campaign is an administrative action.
- Record:
  - Admin ID
  - campaign ID
  - action
  - channel(s)
  - audience/segment reference
  - timestamp
- Do not duplicate provider credentials or full recipient lists into immutable audit logs.
- Campaign records preserve detailed operational history.
### Feature integration boundaries
- `admin-notification` is inbound; `push-notification-bar` is outbound.
- Campaign completion becomes an Admin Notification only if separately configured.
- Platform announcements remain persistent in-app content; they may be referenced by a campaign, but publishing one does not automatically send push/SMS.
### Frontend states
- Composer:
  - idle
  - validating
  - preview
  - confirming
  - submitting/queueing
  - success
  - failure
- Audience:
  - loading
  - estimated
  - empty/no eligible recipients
  - error
- Campaign:
  - draft
  - queued
  - sending
  - completed
  - partial failure
  - failed
- Disable duplicate send while the campaign is being queued.
- Do not optimistically report delivery success before backend/provider results exist.
### Accessibility
- Composer fields and segment/channel controls require semantic labels.
- Delivery status must not rely on color alone.
- Confirmation must state audience, channels, and recipient estimate.
- Errors/status changes must be announced accessibly.
- Browser notification permission prompts must result from user interaction on recipient apps, not hidden automatic requests.
### Acceptance criteria
- [ ] Guest cannot access Push Notification Bar.
- [ ] Non-Admin cannot create/send campaigns.
- [ ] Custom Admin permission is enforced.
- [ ] Admin can compose valid title/body.
- [ ] Admin selects only allow-listed audience segments.
- [ ] Audience is resolved server-side.
- [ ] Raw device tokens/recipient phone lists are not exposed in Admin UI.
- [ ] Push uses only eligible registered endpoints.
- [ ] Browser push respects user permission.
- [ ] SMS, when enabled, respects consent/opt-out state.
- [ ] Provider credentials never reach browser code.
- [ ] Send action is queued/asynchronous.
- [ ] Campaign is persisted before fan-out.
- [ ] Queue jobs start after commit.
- [ ] Large audiences are processed in bounded jobs/batches.
- [ ] Duplicate send request cannot enqueue the same campaign twice.
- [ ] Campaign distinguishes complete, failed, and partial-failure states.
- [ ] Provider acceptance is not mislabeled as user read.
- [ ] Destination links are validated/internal and re-authorized on open.
- [ ] Campaign history is paginated and omits raw secrets/recipient tokens.
- [ ] Send/cancel actions are auditable.
- [ ] Push Notification Bar remains distinct from Admin Notifications and Platform Announcements.
## HOW
### Project findings
- `Admin.md` defines **Push Notification Management** as customized push notifications or SMS blasts to user segments such as inactive buyers and top-performing sellers for announcements/promotions. fileciteturn15file9
- It calls for third-party notification integration and asynchronous queueing for large fan-out. fileciteturn15file9
- `admin-notification` is already defined separately as the Admin's inbound notification center. fileciteturn15file1
- `README.md` assigns integrations, queues, jobs, events, listeners, and notifications to Laravel and keeps Next.js as the presentation layer. fileciteturn15file13
- Exact provider, user communication-consent schema, segment definitions, device-token schema, and SMS requirement are not defined by project sources.
### Laravel data model
Recommended conceptual records:
```text
notification_campaigns
- id
- title
- body
- channels
- segment_type/reference
- destination nullable
- status
- created_by_admin_id
- scheduled_at nullable
- started_at nullable
- completed_at nullable
- recipient_count
- sent_count
- failed_count
- created_at

push_endpoints
- id
- user_id
- platform
- provider
- token/subscription reference
- enabled
- last_seen_at
```
- Add a recipient snapshot/join table only if the selected dispatch strategy needs durable per-recipient retry/audit.
- SMS eligibility should reuse the user contact/preferences model rather than copy phone data into campaign records.
- Store provider references/tokens securely and never expose them through Admin Resources.
### Laravel API
Conceptual endpoints:
```http
GET  /api/admin/push-campaigns
POST /api/admin/push-campaigns
POST /api/admin/push-campaigns/{campaign}/preview
POST /api/admin/push-campaigns/{campaign}/send
GET  /api/admin/push-campaigns/{campaign}
```
- Add schedule/cancel endpoints only if scheduling is approved.
- Use Form Requests, Policy/Gate checks, API Resources, and domain actions.
- Suggested services:
  - `ResolveNotificationAudience`
  - `CreateNotificationCampaign`
  - `DispatchNotificationCampaign`
  - `PushDeliveryService`
  - optional `SmsDeliveryService`
- Keep provider-specific DTOs behind integration adapters.
### Audience implementation
- Define named segment strategies rather than raw arbitrary SQL/filter JSON.
- Example interfaces:
```text
InactiveBuyersSegment
TopPerformingSellersSegment
```
- The exact business definition belongs in one server-side segment class/query.
- Preview and dispatch must use the same resolver/versioned criteria.
- Apply communication eligibility/opt-out filters before producing final recipients.
### Push implementation
- If Firebase Cloud Messaging is selected:
  - send from Laravel/trusted server using FCM HTTP v1 or an appropriate maintained server SDK/library
  - store device registration tokens/subscriptions server-side
  - use direct tokens for specific recipients
  - consider topics only for suitable broad opt-in segments
- FCM supports Web, Android, Flutter, and other clients and can target tokens/topics/conditions. citeturn597884search4turn597884search0
- FCM topic messaging is optimized for throughput and intended for subscribed groups. citeturn597884search1turn597884search9
- For Web Push, FCM requires HTTPS/service-worker-compatible clients. citeturn597884search2
- Web notification click links should be HTTPS and point to approved AISLEY destinations. citeturn597884search11
### SMS implementation
- Add an SMS provider adapter only if SMS is in MVP.
- If Twilio is selected:
  - send through Laravel/server integration
  - model consent/opt-out state
  - respect STOP/standard opt-out handling
  - do not send promotional messages after opt-out
- Twilio's messaging policy requires prior express consent and an accessible opt-out mechanism. citeturn514507search3turn514507search6
### Laravel queues
- Campaign dispatch must be queued.
- Chunk recipients into jobs.
- Configure provider-specific retry/backoff/rate limiting.
- Laravel notifications/jobs support asynchronous delivery; transaction-dependent work should dispatch only after commit. citeturn514507search0
- Avoid keeping one huge job containing thousands of serialized user models.
- Jobs should re-load minimal required recipient/provider data by IDs/references.
### Next.js / React
- Build:
  - compact notification composer/bar or dedicated page
  - channel selector
  - segment selector
  - message preview
  - recipient estimate
  - send confirmation
  - campaign history/status
- Keep API calls in shared request client.
- Do not send directly from browser to FCM/Twilio.
- Poll or subscribe to backend campaign-status updates if live progress is desired.
- Handle stale campaign status by refetching.
### Tests
- **Laravel:** guest/non-Admin/permission denial; segment validation/resolution; recipient opt-out filtering; campaign create/preview/send; duplicate send; after-commit queueing; batching; partial provider failure; safe history DTO; provider-secret/token non-exposure; destination validation.
- **Frontend:** composer validation; segment/channel controls; preview; empty audience; confirmation; duplicate-submit prevention; queued/sending/completed/partial-failure states; forbidden/error states; accessibility.
### Research-backed recommendations
- Use FCM as a strong default candidate for cross-platform push if AISLEY has no provider selected. citeturn597884search4
- Send from a trusted server environment, never directly from Admin browser code. citeturn597884search6
- Ask browser users for notification permission from a user gesture and respect denial. citeturn514507search1turn514507search2
- Queue large fan-out and keep provider calls outside the interactive request.
- For SMS, require consent and preserve easy opt-out behavior. citeturn514507search3
### Risks
- **Feature confusion:** outbound campaigns can be mistaken for the Admin's inbound notification center.
- **Spam/consent:** promotional messaging without opt-in can violate user expectations/provider rules.
- **Audience mistakes:** bad segment definitions can send a message to the wrong users.
- **Credential leakage:** provider keys in browser code expose the messaging account.
- **Large fan-out:** synchronous delivery can time out and overwhelm Laravel/provider quotas.
- **Duplicate sends:** request/job retries can resend campaigns.
- **Token churn:** stale device tokens increase failures and queue load.
- **Misleading metrics:** provider acceptance is not proof a notification was read.
- **Channel mismatch:** SMS and push have different consent/delivery semantics and should not be treated identically.
### Open questions
- Provider choice; whether SMS is MVP or future.
- Allowed audience segments and whether filters may be combined dynamically.
- Push/SMS consent/preferences and device-token/subscription lifecycle.
- Scheduling, images, and message-size limits.
- Recipient snapshot vs resolve-at-send behavior.
- Provider batch/concurrency limits and retry/permanent-failure policy.
- Whether campaign completion creates an Admin Notification.
- Campaign/recipient-log retention and analytics beyond sent/failed.
- Whether published announcements can be reused as campaign content.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Admin model: `Admin.md`
- Existing Admin Notifications spec
- Laravel Notifications: https://laravel.com/docs/12.x/notifications
- Firebase Cloud Messaging overview: https://firebase.google.com/docs/cloud-messaging
- FCM HTTP v1 API: https://firebase.google.com/docs/cloud-messaging/send/v1-api
- FCM Topic Messaging: https://firebase.google.com/docs/cloud-messaging/send-topic-messages
- FCM Web setup: https://firebase.google.com/docs/cloud-messaging/web/get-started
- MDN Web Push best practices: https://developer.mozilla.org/en-US/docs/Web/API/Push_API/Best_Practices
- MDN Notifications API: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
- Twilio Messaging Policy: https://www.twilio.com/en-us/legal/messaging-policy
