---
feature: admin-notification
title: Admin Notifications
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Notifications

## WHAT

- **Purpose:** Provide authenticated Admins with a persistent notification inbox/center for important platform events and pending Admin attention.
- **Primary actor:** Authenticated `ADMIN`.
- **Source support:**
  - Admin Dashboard must display important notifications requiring attention.
  - Admin Authentication lists Admin Notifications as a protected Admin feature.
  - AISLEY's architecture supports Laravel notifications, queues, and broadcasting for real-time UI updates.
- **Source limitation:** `Admin.md` does not define a standalone Admin Notifications feature with a fixed event catalog.
  - This spec defines the notification infrastructure and user-facing behavior.
  - Exact notification-producing events remain owned by their source features.
- **Examples of plausible producers from existing Admin features:**
  - new pending registration
  - new complaint/dispute
  - seller-compliance item requiring review
  - new Admin chat/message
  - other future Admin-action-required events
- These examples are integrations with existing features, not a mandatory exhaustive event list.
- **Architecture:**
  - Next.js/React owns notification list/bell UI, unread badges, navigation, loading/error states, and real-time subscriptions.
  - Laravel owns notification creation, recipient selection, persistence, read state, authorization, queuing, broadcasting, and safe destination metadata.
  - Database notification state is authoritative.
- **Recommended surfaces:**

```text
/dashboard       → recent/high-priority notifications
/notifications   → full paginated notification center
header/navbar    → unread badge + recent preview
```

- **Recommended lifecycle:**

```text
domain event commits
→ create Admin notification
→ persist database notification
→ broadcast after commit
→ Admin UI receives/refetches
→ Admin opens/marks read
```

- **Feature boundary:**
  - Admin Notifications **receives** platform-generated notifications.
  - Push Notification Management **sends** targeted push/SMS campaigns to user segments.
  - Chat/Messaging owns conversations/messages; a message notification may link to chat but does not duplicate the message.
  - Dashboard may display notification summaries but does not own notification persistence.
- **Non-goals:**
  - marketing campaign creation
  - SMS/push audience segmentation
  - email campaign management
  - storing full domain records inside notification payloads
  - arbitrary client-generated notifications
  - suspicious-login alerts unless separately specified
  - turning every system event into a notification

## MUST

### Access control
- Every Admin notification endpoint requires:
  - authenticated session
  - persisted role = `ADMIN`
  - Admin Notifications permission if custom permissions are configured
- Laravel authorization is authoritative.
- Admin can access only notifications addressed to that Admin or an explicitly authorized Admin audience.
- Guessing another notification ID must not expose it.
- Frontend filtering is not authorization.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `404` notification not found/scoped out
  - `422` invalid request

### Persistence
- Important Admin notifications must be persisted so they survive:
  - page reload
  - browser restart
  - temporary WebSocket disconnection
- Prefer Laravel's database notification channel when compatible with the existing `User` model.
- Laravel database notifications provide:
  - notification ID
  - notifiable identity
  - type
  - JSON data
  - `read_at`
  - timestamps
- Do not introduce a second custom notification table unless the repository's domain requirements cannot be represented safely by Laravel's notification model.
- Database state is authoritative over frontend memory.

### Recipient model
- Notifications must target specific authorized Admin accounts or an explicitly resolved Admin recipient set.
- Never trust a client-submitted recipient list for domain-generated notifications.
- Source feature/business logic determines recipients.
- Custom Admin permissions should influence notification recipients where applicable.
- Example:
  - an Admin lacking Seller Compliance permission should not receive sensitive Seller Compliance notifications merely because they have the `ADMIN` role.
- Exact recipient-routing rules per domain event are Open Questions.

### Notification payload
- Keep persisted payloads compact.
- Recommended safe fields:

```text
type
title
message/summary
resource_type
resource_id
destination
severity/priority optional
metadata optional
```

- Do not serialize whole Eloquent models into notification data.
- Do not include:
  - passwords/auth secrets
  - private document URLs
  - payment credentials
  - complaint evidence
  - full private message bodies
  - unrestricted PII
- Prefer resource IDs and safe summaries.
- Fetch authoritative detail from the owning feature after navigation.

### Notification type
- Use stable application-level notification type names.
- Do not require frontend logic to depend on PHP class names.
- Laravel allows custom database notification types; use them when useful.
- Recommended style:

```text
account-registration.pending
complaint.created
seller-compliance.review-required
chat.message-received
```

- Exact event/type catalog must be defined by each producing feature.
- Unknown types must still render safely with generic fallback behavior.

### Read/unread state
- Read state must be persisted in Laravel.
- New notifications default to unread unless the specific notification semantics say otherwise.
- Admin must be able to mark:
  - one notification read
  - optionally all currently authorized unread notifications read
- Do not mark all notifications read merely because Dashboard loaded.
- A read mutation must target only the authenticated Admin's notification.
- Marking an already-read notification read again must be safe/idempotent.
- Whether "mark unread" is supported is an Open Question.
- Unread badge/count must come from backend state or be reconciled against it.

### Listing
- Notification center must be paginated.
- Default ordering: newest first.
- Recommended filters:
  - unread/read
  - notification type/category
  - date
- Only allow-listed filters/sorts are accepted.
- Dashboard may request only a small recent subset plus unread count.
- Full notification center owns browsing older history.
- Exact page size and retention period are Open Questions.

### Navigation/destination
- A notification may include an internal destination to the owning Admin feature.
- Examples:

```text
pending registration → /account-registrations/{id}
complaint → /complaints-disputes/{id}
compliance review → /seller-compliance/{id}
message → /messages/{conversationId}
```

- Destination must be generated/validated server-side.
- Never trust arbitrary external URLs from notification payloads.
- Navigation does not bypass destination-feature authorization.
- If the referenced resource no longer exists or is no longer authorized:
  - the notification remains readable
  - destination access may return `404`/`403`
  - UI must handle the stale destination gracefully.

### Creation boundary
- Notification creation belongs to the source domain event/action.
- The browser must not directly create arbitrary Admin notifications.
- Example:

```text
complaint successfully created
→ complaint transaction commits
→ domain event/listener determines Admin recipients
→ Admin notification queued/persisted/broadcast
```

- A notification is not the source of truth for the underlying event.
- Failure to send/broadcast a notification must not undo the source domain transaction.

### After-commit behavior
- Notifications caused by database mutations must be dispatched only after the source transaction commits.
- This prevents workers/UI from observing records that later roll back.
- Use Laravel queue/notification after-commit behavior according to repository configuration.
- Retrying notification delivery must not repeat the underlying domain mutation.

### Real-time delivery
- AISLEY architecture supports Laravel broadcasting consumed by React.
- Use broadcast notifications or equivalent domain broadcast events for live updates.
- Broadcast to a private authenticated Admin/notifiable channel.
- Do not broadcast private Admin notification data over public channels.
- Broadcast payload should be minimal and safe.
- The UI must still work without real-time delivery by fetching persisted notifications.
- Reconnect must refetch/reconcile authoritative state.
- Duplicate broadcast events must not duplicate notification rows/UI items.

### Notification channels
- **Database** is recommended for the Admin inbox/read-state source of truth.
- **Broadcast** is recommended for real-time web delivery when the broadcasting driver is configured.
- **Mail/SMS/push** are not automatically required for Admin Notifications.
- If a future high-priority event uses multiple channels, each producing feature defines those channels.
- Do not conflate this inbox with Push Notification Management.

### Dashboard integration
- Dashboard may show:
  - unread count
  - recent notifications
  - high-priority notifications
- Dashboard must use the same notification records/API/domain rather than a duplicate table.
- Dashboard rendering must not automatically mark notifications read.
- Notification center remains the canonical browsing/read-management surface.
- Real-time updates may update Dashboard badge/list after persistence.

### Notification deletion/retention
- Current sources require display/read behavior but do not define deletion.
- MVP should not require hard delete.
- Retain notifications according to a defined retention policy.
- Optional user-facing archive/delete behavior is an Open Question.
- Deleting an old notification must never delete the source domain record.
- Important security/compliance history belongs to the owning feature/audit trail, not solely to notifications.

### Priority/severity
- Source says Dashboard should alert Admins to critical notifications.
- A priority/severity field is therefore reasonable, but exact levels are not defined.
- Recommended optional levels:

```text
INFO
ACTION_REQUIRED
CRITICAL
```

- Do not invent severity mappings until source features define them.
- Priority affects presentation/sorting only; it must not replace feature authorization/business state.

### Idempotency and duplicates
- One source event should not generate duplicate persisted notifications for the same intended Admin/channel because a listener/job retries.
- Use a stable source-event/reference key when the project's event architecture supports it.
- Frontend should deduplicate by persisted notification ID.
- Replayed broadcast delivery must not create a second database notification.

### Security/privacy
- Minimize payload data.
- Notification previews must not leak sensitive complaint, identity, payment, or message contents.
- Private details are loaded only from the authorized destination feature.
- Avoid logging notification payloads when they contain user-sensitive summaries.
- Channel authorization must prevent one Admin/user from subscribing to another account's private notification channel.
- Session expiration/logout must stop continued authorized access according to the configured broadcasting stack.

### Frontend states
- Bell/recent preview:
  - loading
  - unread count
  - empty
  - error
- Notification center:
  - loading
  - empty
  - loaded
  - loading more/page change
  - error
  - forbidden
- Read mutation:
  - pending
  - success
  - failure
- Real-time:
  - connected
  - disconnected/reconnecting
- Temporary real-time loss must not erase persisted notifications.
- Do not optimistically remove unread state permanently unless backend mutation succeeds.

### Accessibility
- Notification bell must have an accessible name and unread count/status.
- Notification items must be keyboard navigable.
- Read/unread/priority must not rely on color alone.
- New real-time notifications should use restrained live-region announcements and must not steal focus.
- Time labels must be rendered accessibly in the user's locale.

### Acceptance criteria
- [ ] Guest cannot access Admin Notifications.
- [ ] Non-Admin cannot access Admin notification APIs.
- [ ] Custom Admin notification permission is enforced when configured.
- [ ] Admin sees only notifications addressed/authorized to them.
- [ ] Notifications persist across reloads.
- [ ] New persisted notifications default to unread where applicable.
- [ ] Admin can mark their notification read.
- [ ] Admin cannot mark another account's notification read.
- [ ] Mark-read is idempotent.
- [ ] Unread count is backend-backed/reconciled.
- [ ] Notification list is paginated and newest-first.
- [ ] Payload contains safe summary/reference data only.
- [ ] Destination URLs are internal/server-controlled.
- [ ] Destination feature re-authorizes access.
- [ ] Source transaction commits before dependent notification dispatch.
- [ ] Notification failure does not roll back source-domain success.
- [ ] Private real-time channel authorization prevents cross-account access.
- [ ] Reconnect/refetch recovers missed notifications.
- [ ] Replayed broadcasts do not duplicate UI entries.
- [ ] Dashboard and notification center share the same notification domain.
- [ ] Admin Notifications remains separate from Push Notification Management.
- [ ] Normal login errors do not create Admin Notifications.
- [ ] UI handles empty, error, forbidden, read-mutation, and disconnected states.

## HOW

### Project findings
- `Admin.md` requires the Dashboard to display critical notifications and support real-time or polling updates. fileciteturn14file3
- `Admin.md` separately defines **Push Notification Management** as Admin-created push/SMS campaigns, so it is not this feature. fileciteturn14file0
- Admin Authentication explicitly lists **Admin Notifications** as a protected Admin feature and states normal login errors do not generate Admin Notifications. fileciteturn14file1turn14file4
- `README.md` defines Laravel queues/notifications for asynchronous work and Laravel broadcasting consumed by React for notifications/live dashboard changes. fileciteturn14file9
- It also requires notifications to be queued after the source transaction commits. fileciteturn14file6
- Current sources do not define a complete Admin notification event catalog, severity taxonomy, retention period, or per-event recipient rules.

### Laravel notification model
- Prefer Laravel's built-in database notification system if compatible with the shared `User` model.
- Ensure the notifiable Admin model uses `Notifiable`.
- Create Laravel's notification table if the repository does not already have one.
- Use `toDatabase()` for persisted inbox data.
- Use `toBroadcast()` separately when the real-time payload should be smaller/different.
- Define a stable `databaseType()`/application type when frontend behavior should not depend on the PHP class name.
- Keep notification classes thin; recipient/business decision logic belongs to source-domain services/listeners.

### Laravel API
Conceptual endpoints:

```http
GET  /api/admin/notifications
GET  /api/admin/notifications/unread-count
POST /api/admin/notifications/{notification}/read
POST /api/admin/notifications/read-all
```

- Exact URLs follow repository conventions.
- Query through the authenticated Admin's notification relationship.
- Never query by notification ID globally and authorize afterward when scoped lookup can be used.
- Paginate notification collections.
- Return a dedicated safe Resource/DTO.

### Read-state implementation
- Laravel database notifications provide `read_at` and `markAsRead()`.
- Single-read:
  - scope notification to authenticated Admin
  - mark read
  - return current state
- Mark-all-read:
  - update only authenticated Admin's unread notification relation
- Read mutations do not require a domain transaction unless additional related state changes atomically.
- Avoid one SQL update per notification when marking all read; use relation-level mass update where appropriate.

### Producing notifications
- Source features decide when an Admin notification exists.
- Recommended pattern:

```text
domain transaction
→ commit
→ event/listener
→ resolve authorized Admin recipients
→ notify()
```

- Where the notification implements `ShouldQueue`, use Laravel queue infrastructure.
- Use `afterCommit()` or configured queue `after_commit` behavior for transaction-dependent notifications.
- Keep a source resource/event ID for navigation and duplicate protection.

### Broadcasting
- Add the `broadcast` channel when real-time Admin delivery is required.
- Laravel broadcast notifications use private notifiable channels by default.
- Subscribe from React/Echo using the authenticated Admin's authorized private channel.
- If the repository uses custom broadcast channel naming, authorize it explicitly.
- Real-time payload should contain only the information needed to update the badge/list.
- Refetch the persisted notification when full detail is needed.

### Next.js / React
- Build:
  - notification bell/badge
  - recent-notification popover
  - full notification center
  - read/unread presentation
- Keep API calls in the shared request client.
- Use a client component for Echo/live subscription.
- Initial load:
  1. fetch unread count/recent notifications
  2. render server-backed state
  3. subscribe to private notification channel
- On live notification:
  - deduplicate by notification ID
  - update preview/unread count
  - optionally refetch when payload is insufficient
- On reconnect:
  - refetch unread count/recent list
- On navigation:
  - validate/use only the server-provided internal destination
  - destination page performs its own authorization.

### Tests
- **Laravel:** guest/non-Admin/permission denial; scoped/paginated list; unread count; single/all mark-read; cross-account isolation; safe DTO; after-commit creation; retry/duplicate protection; private-channel authorization; database/broadcast payloads.
- **Frontend:** badge/count; empty/list/error states; pagination; mark-read; live updates; duplicate-event handling; reconnect/refetch; stale destinations; forbidden state; accessibility.

### Research-backed recommendations
- Use Laravel database notifications for persistent inbox state and built-in unread/read handling. citeturn703667search0
- Separate `toDatabase()` and `toBroadcast()` when persisted/live payloads differ. citeturn703667search0
- Queue slow delivery and dispatch transaction-dependent notifications after commit. citeturn703667search0turn703667search1
- Use private broadcast notification channels/Echo for real-time updates. citeturn703667search0turn703667search3
- Protect API/private-channel access with configured Sanctum authentication. citeturn703667search2

### Risks
- **Feature confusion:** inbox notifications may be confused with outbound Push Notification Management.
- **Information leakage:** previews may expose sensitive complaint/compliance/user data.
- **Permission leakage:** role-only recipient routing may notify Admins lacking feature permission.
- **Duplicates:** retries can duplicate notifications without stable source identity.
- **Broadcast-only design:** unpersisted events disappear on reload.
- **Stale links:** referenced resources may later disappear or become unauthorized.
- **Notification overload:** low-value events can bury critical alerts.
- **Transaction race:** delivery may reference uncommitted data without after-commit handling.

### Open questions
- Event catalog and per-event recipient/permission rules.
- Whether all Admins receive platform-wide operational notifications.
- Priority/severity taxonomy and retention duration.
- Mark-unread, delete/archive, search/filter behavior.
- Dashboard recent-notification limit and default page size.
- Behavior when source items are resolved/removed.
- Selected broadcast driver.
- Whether any Admin notifications also use email/push/browser notifications.

### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Admin feature model: `Admin.md`
- Admin Authentication source/spec
- Admin Dashboard spec
- Laravel Notifications: https://laravel.com/docs/12.x/notifications
- Laravel Queues: https://laravel.com/docs/12.x/queues
- Laravel Sanctum: https://laravel.com/docs/12.x/sanctum
- Laravel Broadcasting: https://laravel.com/docs/11.x/broadcasting
