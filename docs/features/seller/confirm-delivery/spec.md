---
feature: confirm-delivery
title: Seller Confirm Delivery
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Confirm Delivery
## WHAT
- **Purpose:** Notify the Seller when a trusted delivery-completion source confirms that the Buyer received an Order, and let the Seller view the authoritative delivered milestone/timeline.
- **Canonical role:** `SELLER`.
- `Seller.md` defines Confirm Delivery as a post-fulfillment tracking/notification feature that closes the Seller loop when delivery reaches `DELIVERED`. fileciteturn73file0turn73file2
- **Critical ownership rule:** Seller does **not** manually declare Buyer receipt.
- The dedicated Seller flow explicitly says the delivery-completion transaction marks the Order `DELIVERED`; Seller receives/views the confirmation afterward.
- The Courier source independently defines `Complete Delivery` as the operation that advances the Order to `DELIVERED` and cascades Buyer/Seller notifications. fileciteturn73file1turn73file7
- **Current AISLEY internal flow:**
```text
Courier Complete Delivery
→ validate assignment/state/proof
→ transaction records delivery completion
→ Order becomes DELIVERED exactly once
→ commit
→ Seller delivery-confirmation notification
→ Seller opens completed Order timeline
```
- **Alternative external integration:** if AISLEY later uses a real carrier/3PL, a verified carrier callback/webhook may feed the same delivery-completion domain action.
- External carrier callbacks must not create a parallel status model.
- **Recommended Seller routes:**
```text
/seller/notifications
/seller/orders/{order}
```
- A dedicated `/seller/confirm-delivery` page is not required unless UI design explicitly wants one.
- **Architecture:**
  - Next.js/React owns Seller notification/inbox presentation, completed-order detail, timeline, loading/error/read states.
  - Laravel owns Seller scoping, authoritative Order state, delivery event/proof references, notification creation, idempotency, and safe proof/status DTOs.
  - Courier/Delivery domain owns the `DELIVERED` transition.
- **Feature boundaries:**
  - Courier `Complete Delivery` owns normal successful delivery completion.
  - Courier e-POD owns required proof capture.
  - Buyer Order Status reads the same `DELIVERED` milestone.
  - Seller Confirm Delivery only receives/displays the result.
  - settlement eligibility is a separate financial rule.
  - Product/Courier review eligibility is a separate post-delivery rule.
  - dispute/return workflows append later lifecycle events without rewriting delivery confirmation.
- **Non-goals:**
  - Seller manually marking an Order `DELIVERED`
  - Seller uploading delivery proof
  - Seller editing Courier proof
  - changing Courier assignment
  - handling failed-delivery incidents
  - implementing settlement/payout rules
  - implementing Buyer review submission
  - inventing an external carrier requirement for the current internal Courier flow
## MUST
### Seller authentication and ownership
- Seller views delivery confirmation only for Orders belonging to that Seller/shop.
- Every Seller Order/notification query must be Seller-scoped before serialization.
- Never trust client-submitted:
  - `seller_id`
  - delivery status
  - delivered timestamp
  - Courier ID
  - proof ownership
  - Buyer receipt confirmation
- Another Seller cannot read delivery confirmation, proof summary, or timeline for this Order.
- Standard responses:
  - `401` unauthenticated
  - `403` forbidden where appropriate
  - `404` Seller-scoped Order/notification missing
### Authoritative DELIVERED transition
- Shared AISLEY lifecycle includes:
```text
... → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
```
fileciteturn73file5turn73file11
- Seller Confirm Delivery must not expose an arbitrary status mutation endpoint.
- Do not implement:
```http
PATCH /api/seller/orders/{order}
{ "status": "DELIVERED" }
```
- `DELIVERED` is accepted only through the authorized delivery-completion domain action.
- Current internal source assigns this authority to Courier `Complete Delivery`.
### Courier completion source
- Normal internal source flow:
```text
assigned Courier
+ valid delivery state
+ required proof policy
→ Complete Delivery
```
- Courier flow validates assignment, lifecycle state, destination context, and required proof before completion.
- Missing required proof blocks ordinary successful delivery.
- Failed-delivery incidents must not be converted to `DELIVERED`.
- Seller does not override those checks.
### Delivery completion transaction
- Delivery completion must transactionally record:
  - delivery completion
  - proof references
  - safe recipient/handoff metadata
  - authoritative delivered timestamp
  - Order/Delivery state change
- Order reaches `DELIVERED` exactly once.
- Seller notification is downstream from the committed delivery transition.
- Notification failure must not roll back a valid delivery completion.
### Idempotent completion
- Duplicate Courier submissions/callbacks must not create duplicate:
  - `DELIVERED` milestones
  - Seller notifications
  - Buyer notifications
  - Courier earnings eligibility
  - settlement triggers
- Use idempotency key/source event identity or equivalent protection.
- Existing `DELIVERED` Order should return/reconcile to the committed result rather than transition again.
### Seller notification trigger
- Trigger Seller confirmation only after authoritative delivery completion commits.
- Recommended domain event:
```text
OrderDelivered
```
or:
```text
DeliveryCompleted
```
- Event/listener determines affected Seller(s) from authoritative Order Items/shop relationships.
- Seller recipient identity must not be taken from the Courier/browser request.
### After-commit notification
- Shared AISLEY conventions require notifications after the source transaction commits. fileciteturn73file5turn73file11
- Laravel queued notifications support `afterCommit()`, and queue `after_commit` can defer queued notifications/events/broadcasts until successful commit. citeturn592104search0turn592104search1
- A rolled-back completion must produce no normal Seller-delivered notification.
### Notification channel
- Source requires Seller notification but does not mandate a specific channel.
- Recommended minimum:
  - database/in-app Seller notification
- Optional configured channels:
  - broadcast/realtime
  - email
  - push
- Do not hard-code SMTP, FCM, SMS, or another provider.
- Laravel Notifications supports database and multiple queued delivery channels. citeturn592104search0
### Notification payload
- Recommended safe Seller notification fields:
```text
notification_id
type = ORDER_DELIVERED
order_id / seller_order_reference
delivered_at
safe status summary
safe proof summary / proof_available
created_at
read_at
```
- Do not include:
  - full Buyer address
  - Buyer payment details
  - raw signature image in the notification payload
  - private Courier documents
  - unrelated Seller data
- Notification should link to the Seller's authorized Order detail.
### Notification uniqueness
- One logical delivered notification per Seller-facing Order/delivery milestone.
- Recommended dedupe identity:
```text
seller_id
+ order_id
+ delivered_event_id
+ notification_type
```
- Queue retries must not create duplicate logical notifications.
- Multi-Seller Order architecture, if allowed, must determine whether each Seller receives a Seller-scoped delivery notification for their own parcel/suborder.
### Seller notification list
- Delivery confirmation can appear in the Seller's normal notification/inbox system.
- List should support:
  - unread/read state
  - newest-first ordering
  - pagination
  - safe Order reference
- Do not create a completely separate notification database solely for delivery confirmation.
### Read state
- Seller may mark their notification read.
- Read state is Seller-specific and does not mutate:
  - Order status
  - Buyer notification state
  - Courier delivery state
- Mark-read action should be idempotent.
- A read/unread UI flag is not delivery acknowledgment.
### Seller Order detail
- Opening confirmation should show an authorized completed Order timeline.
- Recommended fields:
  - Seller Order reference
  - delivered status
  - delivered timestamp
  - relevant Seller-owned Order Items
  - safe delivery/courier summary
  - safe proof-status summary
  - preceding lifecycle milestones when persisted
- Do not expose unrelated Seller items in a mixed-Seller parent Order.
### Timeline authority
- Timeline should derive from persisted Order/Delivery state history/events.
- Do not fabricate milestone timestamps from the current status.
- If AISLEY does not persist state history yet, add/reuse an Order status event/history mechanism instead of inventing timestamps.
- Seller view and Buyer Order Status must agree on the authoritative `DELIVERED` milestone.
### Delivery proof summary
- Seller flow says Seller notification includes a safe proof/status summary.
- Courier e-POD source supports proof such as:
  - delivery photo
  - signature
  - QR/OTP
  - recipient name
  - approved combinations
- Seller does not automatically receive unrestricted raw proof access.
- Exact proof visibility is policy-controlled.
### Raw proof authorization
- Raw proof access must require:
  - authenticated authorized role
  - Order/Delivery relationship
  - proof-access policy
- Seller may receive:
  - `proof_available = true`
  - proof type summary
  - authorized preview/link when policy permits
- Never expose storage paths or unrestricted public URLs.
- Shared file rules require authorized/signed access to sensitive stored assets. fileciteturn73file5turn73file11
### Proof immutability
- Seller cannot edit/delete Courier delivery proof.
- Later dispute evidence is appended separately.
- Any correction to delivery proof metadata must follow the owning Delivery/Admin dispute policy rather than Seller Account/Order mutations.
### Delivered timestamp
- `delivered_at` comes from the authoritative server-side delivery completion.
- Store UTC and render Seller locale.
- Do not trust Courier device/browser timestamp as the final authoritative timestamp without server validation.
- Notification timestamp should correspond to the committed delivery event, not merely when Seller opened the notification.
### Financial settlement eligibility
- Seller flow says financial settlement eligibility may begin after delivery.
- Confirm Delivery must not implement settlement calculations itself.
- Emit/allow a separate Settlement domain consumer to evaluate:
```text
Order delivered
→ settlement eligibility rules
```
- Exact hold period, fees, commission, payout timing, refund/dispute impact are Open.
- Duplicate delivery events cannot duplicate settlement eligibility/effects.
### Buyer review eligibility
- Buyer Product Reviews require a verified delivered purchase. fileciteturn73file3
- `DELIVERED` may make review actions eligible.
- Confirm Delivery does not create a Review.
- Product Reviews domain rechecks Buyer/Order Item eligibility independently.
### Courier review eligibility
- If Buyer can review Courier performance, that separate review target may also become eligible after delivery.
- Product and Courier review targets must remain structurally distinct.
- This Seller feature does not own either review mutation.
### Disputes / returns after delivery
- `DELIVERED` is a historical fact/milestone once validly committed.
- Later:
```text
RETURN_REQUESTED
RETURNED
dispute/complaint events
```
must append/transition according to their own rules.
- Do not rewrite the original delivered timestamp/proof simply because a return/dispute later occurs.
- Seller timeline may display subsequent events after `DELIVERED`.
### Failed delivery
- `DELIVERY_FAILED` is not equivalent to `DELIVERED`.
- Failed attempt/incident follows Courier/Logistics exception flow.
- Seller may receive a separate failure notification if another feature defines it.
- Confirm Delivery must not transform a failure into delivery confirmation.
### External carrier / webhook integration
- `Seller.md` describes webhooks/API callbacks from integrated courier services as one implementation context. fileciteturn73file0turn73file2
- Current AISLEY also has an internal Courier role whose `Complete Delivery` owns the state transition. fileciteturn73file1turn73file7
- Therefore external carrier integration is optional/alternate.
- If added:
  - authenticate/verify webhook source
  - map only allow-listed carrier status to internal transition
  - deduplicate provider event IDs
  - validate current lifecycle
  - persist raw/provider reference safely
  - invoke the same `CompleteDelivery`/delivery transition action
- Never let carrier-specific statuses become arbitrary internal Order values.
### Callback/webhook failure
- Invalid signature/source → reject without state mutation.
- Unknown Order/tracking reference → safe failure/logging; do not leak tenant data.
- Out-of-order callback → reject/ignore according to lifecycle rules.
- Duplicate callback → return stable success/idempotent result without duplicate effects.
- Provider temporary retry should be safe.
### Realtime Seller update
- Optional broadcast can update:
  - Seller notification bell
  - Order detail status
  - completed-order list
- Broadcasting is supplementary; database remains authoritative.
- Missed broadcast is recovered via normal API refetch.
- Do not force a specific Laravel broadcast driver.
### Notification preferences
- Exact Seller notification preference for delivery confirmation is not defined.
- If preferences are supported:
  - in-app record may remain mandatory for operational history
  - optional email/push can follow Seller preferences
- Critical operational delivery status should not disappear entirely because an optional external channel is disabled unless policy explicitly allows that.
### Archival / retention
- Delivery confirmation/order timeline is historical fulfillment data.
- Seller can read authorized historical completion through Order history according to retention policy.
- Do not delete the underlying delivery milestone when the notification is dismissed/read.
- Exact retention period is Open.
### Frontend states
- Notification: unread, read, loading, error.
- Order detail: loading, delivered, later-return/dispute state, forbidden/not-found, error.
- Optional proof: unavailable, summary-only, authorized-loading, authorized-loaded, forbidden.
- Realtime: connected, reconnecting, refetching.
- No Seller control should present "Mark delivered."
### Accessibility
- Delivery status must use text, not color alone.
- Notification and Order links require meaningful accessible names.
- Timeline milestones/timestamps must be screen-reader understandable.
- Proof preview controls, if permitted, need accessible labels.
- Realtime confirmation announcement should not steal focus.
### Acceptance criteria
- [ ] Seller receives delivery confirmation only for Seller-owned Order scope.
- [ ] Seller cannot manually set an Order to `DELIVERED`.
- [ ] Courier/authorized delivery completion owns the `DELIVERED` transition.
- [ ] Required proof/lifecycle checks occur before ordinary successful completion.
- [ ] `DELIVERED` transition happens exactly once.
- [ ] Seller notification is created only after completion commits.
- [ ] Duplicate Courier/callback events do not duplicate delivered milestone, notification, settlement trigger, or review eligibility event.
- [ ] Notification timestamp/status matches the authoritative delivery event.
- [ ] Seller Order timeline and Buyer Order Status agree on `DELIVERED`.
- [ ] Raw proof access is policy-scoped and never automatically public.
- [ ] Seller cannot edit Courier proof.
- [ ] Later disputes/returns append lifecycle events without rewriting delivery confirmation.
- [ ] External carrier callback, if added, invokes the same internal delivery transition rather than a parallel state model.
- [ ] Notification read/dismiss state never changes Order delivery state.
## HOW
### Project findings
- `Seller.md` defines Confirm Delivery as receiving a final Seller notification after successful Buyer handoff; its implementation context mentions courier-service callbacks feeding the Order state machine. fileciteturn73file0turn73file2
- Dedicated Seller system flow clarifies that this is primarily a **receive/view-notification feature**, not a Seller status mutation.
- Courier source defines `Complete Delivery` as the actual delivery-finalization action that advances the Order to `DELIVERED` and notifies Buyer/Seller. fileciteturn73file1turn73file7
- Shared AISLEY architecture defines one normalized Order lifecycle and requires validated transitions, tenant scope, idempotency, transactions, and after-commit notifications. fileciteturn73file5turn73file11
- Current sources do not define Seller raw-proof visibility, settlement hold rules, notification channel, retention period, or external carrier provider.
### Recommended domain actions/events
```text
Courier domain:
CompleteDelivery

Order/Delivery events:
DeliveryCompleted
OrderDelivered

Seller notification:
NotifySellerOrderDelivered
```
- Do not create `SellerConfirmDelivery` as an Order-status mutation action.
- Seller-side action is effectively:
```text
GetSellerDeliveryConfirmation
MarkSellerNotificationRead
```
### Recommended delivery transaction
```text
CompleteDelivery
→ authenticate/authorize Courier or trusted integration
→ validate current delivery/order state
→ validate required proof
→ check idempotency
→ transaction
   → persist proof references/handoff metadata
   → transition Delivery
   → transition Order to DELIVERED
   → persist status-history event
→ commit
→ dispatch OrderDelivered
→ queue Seller/Buyer/Logistics notifications
→ settlement/review consumers evaluate independently
```
### Recommended Seller API
```http
GET  /api/seller/notifications
POST /api/seller/notifications/{notification}/read

GET  /api/seller/orders/{order}
GET  /api/seller/orders/{order}/timeline
GET  /api/seller/orders/{order}/delivery-proof-summary
```
- Raw proof endpoint exists only if policy permits.
- No Seller `mark-delivered` endpoint.
### Notification implementation
- Recommended notification class:
```text
SellerOrderDeliveredNotification
```
- Minimum channels:
```text
database
```
- Optional:
```text
broadcast
mail
push
```
- Implement `ShouldQueue` for slow/external channels and dispatch after commit.
- Laravel Notifications supports queued delivery and `afterCommit()`. citeturn592104search0
### Realtime
- If Seller notifications are broadcast:
```text
OrderDelivered committed
→ database notification
→ private Seller notification channel
→ React updates bell/order detail
```
- Reconnect refetches notification/order state.
- Private channel authorization must scope the current Seller.
- Laravel/Sanctum can protect authenticated private broadcast authorization when that is the configured Seller web auth model. citeturn592104search2
### External callback adapter
If a future carrier exists:
```text
Carrier webhook
→ verify signature/source
→ dedupe provider event
→ resolve tracking/order
→ map carrier state
→ call CompleteDelivery
→ internal OrderDelivered event
```
- Carrier adapter only translates trusted external facts into the existing domain action.
- It does not directly execute an unrestricted `orders.status = payload.status`.
### Recommended data
Reuse existing:
```text
orders
deliveries / delivery_tasks
order_status_events
delivery_proofs / assets
notifications
```
- Add new tables only if the current repository lacks a required history/proof/delivery entity.
- Delivery confirmation itself can be represented by the canonical Order event + Seller notification rather than a redundant `seller_delivery_confirmations` table.
### Tests
- **Laravel:** Seller isolation; no Seller DELIVERED mutation; Courier completion authorization/state/proof; idempotent duplicate completion; after-commit Seller notification; safe payload; read state; proof authorization; later return/dispute history; optional callback verification/dedupe.
- **Cross-role:** Courier, Seller, Buyer views agree on `DELIVERED`; duplicate completion does not duplicate notifications/earnings/settlement hooks.
- **Frontend:** unread/read notification; delivered timeline; forbidden Order; proof summary/access; realtime/refetch; accessibility.
### Research-backed recommendations
- Use queued Laravel Notifications for delivery confirmation when external channels are used. citeturn592104search0
- Dispatch queued notifications/events after the delivery transaction commits to avoid notifications about rolled-back state. citeturn592104search0turn592104search1
- Keep the internal Order state machine canonical even if a carrier webhook is later introduced.
### Risks
- **False delivery:** allowing Seller/manual/external unverified status mutation can falsely close Orders.
- **Duplicate effects:** repeated Courier/callback completion can duplicate alerts, earnings, settlement, or review eligibility.
- **Proof leakage:** raw e-POD may expose recipient/signature/location data beyond Seller need.
- **State divergence:** Seller, Buyer, Courier, and external carrier statuses can disagree if separate state models exist.
- **Premature notification:** sending before commit can show a delivery that later rolls back.
- **Historical corruption:** later return/dispute can incorrectly overwrite the original delivered milestone.
### Open questions
- Exact Seller notification channel(s).
- Seller access to raw e-POD vs summary only.
- Which proof types are mandatory for normal completion.
- Exact Courier Order state required immediately before `DELIVERED`.
- Settlement eligibility/hold rules after delivery.
- Product/Courier review trigger details.
- Delivery confirmation/history retention.
- Whether external carriers/3PL callbacks will actually be supported.
- If external carrier exists: provider, webhook signature/event-ID scheme, status mapping.
- Multi-Seller Order notification/suborder behavior.
- Whether delivery confirmation notifications can be muted externally while remaining in-app.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Courier source: `Courier.md`
- Buyer source: `Buyer.md`
- Seller flow: `feature-system-flows/seller/confirm-delivery.md`
- Courier flow: `feature-system-flows/courier/complete-delivery.md`
- Laravel 12 Notifications: https://laravel.com/docs/12.x/notifications
- Laravel 12 Queues: https://laravel.com/docs/12.x/queues
- Laravel 12 Sanctum: https://laravel.com/docs/12.x/sanctum
