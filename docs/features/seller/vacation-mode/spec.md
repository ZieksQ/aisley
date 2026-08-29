---
feature: vacation-mode
title: Seller Vacation Mode
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Vacation Mode
## WHAT
- **Purpose:** Let a Seller temporarily pause new purchases while preserving the shop, catalog, Inventory, and existing fulfillment obligations.
- **Canonical role:** `SELLER`.
- `Seller.md` defines Vacation Mode as a master shop-availability control that temporarily removes Seller Products from active discovery and disables checkout for those items. fileciteturn96file0
- The dedicated Seller Vacation Mode flow additionally defines:
  - immediate enable
  - scheduled start/end
  - manual disable
  - automatic expiry/end
  - optional storefront message
  - configurable `hide` vs `unavailable` Buyer presentation
  - Cart/Checkout revalidation
  - existing paid/placed Orders remain fulfillable
  - reactivation restores only otherwise eligible listings
  - idempotent/audited manual and scheduled transitions
- **Core availability rule:**
```text
Vacation Mode
≠ Seller suspension
≠ Product archive
≠ Inventory zero
```
- Vacation Mode is a temporary eligibility overlay.
- **Recommended Seller route:**
```text
/seller/settings/vacation-mode
```
or a Vacation Mode section inside Seller Account/Shop settings.
- **Buyer-facing flow:**
```text
Seller becomes ON_VACATION
→ Laravel updates canonical Seller availability
→ after commit: Search/Shop projections refresh
→ Buyer discovery uses configured presentation
→ existing Cart lines revalidate as unavailable
→ Checkout blocks new Order placement
```
- **Existing Order flow:**
```text
Order already paid/placed
→ remains visible to Seller
→ fulfillment continues normally
→ Vacation Mode does not auto-cancel it
```
- **Reactivation flow:**
```text
Vacation ends / Seller disables
→ Laravel re-evaluates Seller eligibility
→ shop returns to active eligibility
→ only otherwise valid Products become buyer-visible/orderable
```
- **Architecture:**
  - Next.js/React owns settings form, schedule/message/presentation controls, effect summary, confirmation, and status display.
  - Laravel owns Seller authorization, schedule validation, effective state, transitions, audit history, Buyer-visible eligibility, Checkout guard, and events.
  - Search/Browse/Cart consume Laravel-derived availability; they do not invent separate Vacation Mode logic.
- **Feature boundaries:**
  - Admin Seller Compliance/Manage User Accounts owns suspension/deactivation.
  - Product Management owns Product publish/archive/compliance-visible state.
  - Inventory owns sellable quantity.
  - Buyer Search/Browse/Cart/Checkout consume Vacation Mode eligibility.
  - Prepare Orders and other fulfillment features remain available for existing obligations.
- **Non-goals:**
  - cancelling existing Orders
  - zeroing Inventory
  - archiving/unpublishing Products
  - bypassing Admin suspension/compliance
  - automatically changing Product prices
  - changing Logistics/Courier state
  - inventing a Seller-wide auto-reply system
## MUST
### Authentication and ownership
- Vacation Mode changes require authenticated `SELLER`.
- Seller can modify only their own shop availability.
- Never trust client-submitted:
  - `seller_id`
  - compliance state
  - suspension state
  - Product visibility
  - effective vacation state
- Laravel derives Seller/shop from authentication.
- Standard errors:
  - `401` unauthenticated
  - `403` forbidden
  - `404` Seller/shop missing
  - `422` invalid schedule/message/presentation
  - `409` stale/conflicting transition
### Canonical state
- `Seller.md` proposes an `is_on_vacation` boolean. fileciteturn96file0
- Dedicated flow uses conceptual shop state:
```text
ON_VACATION
```
- Implementation may use:
  - `is_on_vacation` plus schedule fields, or
  - equivalent normalized availability state
- Do not create a separate Vacation flag on every Product.
- Effective Seller availability remains the canonical source.
### Recommended persisted settings
```text
is_on_vacation
vacation_starts_at / vacation_ends_at nullable
vacation_message nullable
vacation_visibility_behavior
vacation_version / updated_at
```
- Exact schema follows repository conventions; store timestamps UTC and render in Seller locale.
### Immediate enable
- Seller may enable immediately.
- Laravel authorizes, validates, rechecks account/compliance, updates state/audit transactionally, then emits projection events after commit.
- Double submit reconciles to one logical enabled state.
### Immediate disable
- Seller may disable manually, but reactivation does not guarantee visibility.
- Seller/account/compliance/Product/variant/Inventory rules still apply.
- Never restore a Product merely because Vacation Mode ended.
### Scheduled start
- Seller may schedule a future start.
- Validate:
```text
starts_at > now
```
for a future-only schedule, unless the endpoint intentionally treats past/current start as immediate enable.
- Exact UX rule is Open.
- A scheduled-but-not-yet-effective shop remains normally eligible unless another restriction applies.
### Scheduled end
- Seller may define an end time.
- If both start/end exist:
```text
ends_at > starts_at
```
- An end may be optional if indefinite Vacation Mode is allowed.
- Dedicated source supports both scheduled disabling and expiry; whether `end_at` is mandatory is Open.
### Timezone
- Seller enters schedule in an explicit timezone.
- Laravel converts schedule to UTC for storage/comparison.
- API response includes timezone context needed by React.
- Shared AISLEY conventions require UTC storage and localized rendering. fileciteturn96file8
### Scheduling implementation
- Recommended approach:
  - persist due start/end times
  - run a recurring Laravel scheduler command/job that applies due transitions
- Avoid dynamically registering one framework schedule entry per Seller.
- Exact scheduler frequency is Open.
- Laravel's scheduler supports scheduled queued jobs and timezone-aware tasks. citeturn888148view0turn508715view2
### Scheduler concurrency
- Scheduled processing must tolerate retries/multiple servers.
- Laravel supports `withoutOverlapping()` and `onOneServer()` with shared supported cache. citeturn508715view0turn508715view1
- Database idempotency remains required.
### Due-transition idempotency
- Applying a scheduled start/end twice must not duplicate:
  - audit entries for one logical transition
  - Search/Shop invalidation events
  - Buyer notifications if later added
- Transition action rechecks current state and expected schedule/version.
- If already applied, return/reconcile without another effective-state change.
### Manual vs scheduled race
- Seller may manually disable/edit while a scheduled job is executing.
- Use transaction plus version/current-state recheck.
- Recommended optimistic version or row lock for transition settings.
- A stale scheduled job must not overwrite a newer Seller decision.
- Return/record a safe no-op when schedule no longer matches.
### Storefront message
- Validate bounded Seller-provided message as untrusted text/sanitized allow-listed markup.
- Never render arbitrary HTML/script; max length is Open.
### Visibility behavior
- Conceptual options:
```text
HIDE
UNAVAILABLE
```
- `HIDE`: exclude affected Products from normal discovery/search/shop results.
- `UNAVAILABLE`: may remain visible with vacation messaging, but purchasing remains blocked.
- Direct-URL behavior under `HIDE` is Open.
### Source compatibility
- `Seller.md` specifically describes hiding shop listings and removing Products from active search indices. fileciteturn96file0
- Therefore `HIDE` is the source-default behavior.
- `UNAVAILABLE` exists because the dedicated flow explicitly makes presentation configurable.
- If MVP wants one behavior only, use `HIDE` and keep configurability future-facing.
### Buyer-visible eligibility
- Centralize a server-side rule such as:
```text
isBuyerVisible(product, seller, now)
```
and/or:
```text
canReceiveNewOrders(seller, now)
```
- Vacation Mode is one input among:
  - Product publish/archive state
  - Seller compliance/account state
  - Vacation state
  - variant validity
  - any other source-defined availability rules
- Do not duplicate inconsistent predicates across Search, Browse Shop, Cart, and Checkout.
### Search integration
- `HIDE` removes affected Products from Search projections; ending Vacation reprojects only otherwise eligible Products.
- Search is a projection; stale results must never permit Checkout.
### Browse Shop integration
- Follow configured Vacation presentation and expose only safe public status/message/end estimate when permitted.
- Never expose private Seller schedule/settings.
### Product detail
- If reachable, expose authoritative non-orderable state and block Add/Buy; optional public Vacation message may show.
- `HIDE` direct-URL behavior is Open.
### Cart behavior
- Vacation Mode does not need to delete existing Cart lines.
- Recommended:
  - keep Cart Item
  - mark it unavailable
  - exclude it from Place Order until Seller returns
- Buyer Cart already requires Vacation Mode items to fail availability revalidation. fileciteturn96file1turn96file4
- Do not silently remove Buyer intent unless a separate retention policy says so.
### Add to Cart
- When Seller is currently on Vacation:
  - Add to Cart should be blocked for unavailable Seller Products where Buyer visibility policy requires.
- If a stale Product page sends an Add-to-Cart request, Laravel rechecks Seller availability.
- React hiding/disabling the button is not sufficient.
### Checkout hard guard
- Place Order must revalidate current Seller Vacation state immediately before Order creation.
- This is mandatory even when:
  - Search cache is stale
  - Product detail was loaded earlier
  - Cart Item was added before Vacation Mode
- Buyer Cart source explicitly requires Seller availability revalidation at Place Order. fileciteturn96file15
- If affected:
  - reject/exclude affected item according to checkout atomicity rules
  - return item-addressable unavailability/conflict information
- Exact `409` vs `422` convention follows Checkout spec; stale eligibility is commonly a `409` conflict.
### Mixed-Seller Cart
- Vacation applies only to affected Seller items; mixed-Seller checkout atomicity remains upstream/Open.
- One Seller's state must not expose/alter another Seller's data.
### Existing Orders
- Vacation Mode **must not cancel existing Orders automatically**.
- Existing paid/placed Seller obligations stay visible and actionable.
- Seller must continue to access:
  - Order Notifications
  - Prepare Orders
  - existing Chat/support
  - delivery/order status
  - other required fulfillment tools
- Dedicated flow explicitly requires continuing fulfillment.
### Order lifecycle
- Existing Orders continue normal canonical lifecycle:
```text
PLACED
→ SELLER_PROCESSING
→ READY_FOR_PICKUP
→ ...
```
- Vacation state does not inject a new Order status.
- Do not block fulfillment transitions solely because shop is on Vacation.
### Pending/unpaid Orders
- Exact behavior for an Order/payment already initiated before Vacation becomes effective is not source-defined.
- Checkout/payment domain must define when Seller availability is locked/revalidated.
- Do not invent automatic cancellation of pending payments.
- This remains Open.
### Inventory
- Vacation never changes `on_hand`, `reserved`, or `available`; do not zero stock.
- Existing Order/return/adjustment movements continue, and reactivation still respects actual Inventory.
### Product state
- Do not rewrite `published`, `archived`, or compliance state.
- Vacation is a Seller overlay; Product edits/archive remain independent and persist after reactivation.
### Admin suspension/compliance precedence
- Vacation Mode cannot override Admin restrictions.
- Precedence conceptually:
```text
Admin/account/compliance restriction
> Seller Vacation Mode
> normal Product eligibility
```
- A suspended Seller disabling Vacation Mode remains suspended.
- A noncompliant/archived Product remains hidden after Vacation ends.
- Admin source explicitly supports hiding Seller Products under suspension/compliance action. fileciteturn96file18
### Account deactivation
- Suspended/deactivated access to Vacation settings follows Admin/account policy.
- Vacation is never a substitute for suspension.
### Scheduled expiration
- At due `ends_at`, exit only if schedule is still current, audit it, and emit reactivation after commit.
- Product/shop projections then re-evaluate normal eligibility.
### Schedule edit/cancel
- Seller may edit/cancel future schedules.
- Current-state/version checks must invalidate stale scheduled jobs; API shape is implementation-specific.
### Audit trail
- Dedicated flow explicitly requires manual/scheduled transitions to be audited.
- Recommended audit data:
  - Seller ID
  - action: schedule/enable/disable/edit/expire
  - previous/new safe state
  - effective timestamps
  - actor: Seller/system
  - request/schedule reference
  - occurred_at
- Never store unrelated sensitive Seller data in audit payload.
### Domain events
- Recommended: `SellerVacationScheduled`, `SellerVacationStarted`, `SellerVacationEnded`, `SellerVacationScheduleChanged`.
- Buyer-facing projections mainly react to effective start/end; events carry safe IDs/timestamps.
### After-commit propagation
- Search/shop/cache/broadcast consumers run only after transition commits.
- AISLEY architecture requires follow-up work after source transaction commit. fileciteturn96file8turn96file10
- Laravel events can implement `ShouldDispatchAfterCommit`; failed transactions discard those events. citeturn508715view3
### Cache/projection invalidation
- Effective start/end refreshes shop/Search/Buyer-availability projections after commit.
- Database stays authoritative and Checkout revalidates even if projections lag.
### Abandoned Cart Promotions
- Campaign evaluator may suppress reminders while Seller is on Vacation; this feature only owns canonical Vacation state.
### Low Stock Alerts
- Vacation does not imply stock recovery and must not resolve low-stock alerts; reminder suppression belongs to that feature.
### Seller messaging
- Existing support threads are not automatically disabled; pre-sale initiation while away is Open.
- Vacation message is not an automatic chat reply.
### React effect summary
- Before confirmation, UI should explain:
  - new purchases will be blocked
  - current Product presentation behavior
  - existing Cart items may become unavailable
  - existing Orders must still be fulfilled
  - reactivation does not override compliance/archive/suspension
- This effect summary is explicitly required by dedicated flow.
### Frontend states
- Settings: loading, active, scheduled, on-vacation, saving, invalid, stale-conflict, error.
- Distinguish current `ON_VACATION` from a future schedule.
### Accessibility
- Label/keyboard-enable controls, use textual status, show timezone on schedule inputs, and describe impact before confirmation.
### Acceptance criteria
- [ ] Seller can enable/disable Vacation Mode only for their own shop.
- [ ] Seller can schedule start/end using validated timestamps.
- [ ] Effective Vacation Mode blocks new Checkout even if Search/Cart is stale.
- [ ] Buyer discovery follows the configured hide/unavailable presentation.
- [ ] Vacation Mode does not delete Products or zero Inventory.
- [ ] Existing paid/placed Orders remain accessible and fulfillable.
- [ ] Vacation Mode does not auto-cancel existing Orders.
- [ ] Reactivation restores only Products/Seller state otherwise eligible.
- [ ] Suspension/compliance/archive restrictions remain effective after Vacation ends.
- [ ] Manual and scheduled transitions are idempotent.
- [ ] Stale scheduled jobs cannot overwrite a newer Seller decision.
- [ ] Start/end transitions are audited.
- [ ] Search/Shop projections refresh only after committed transitions.
- [ ] Future schedule and currently-on-vacation state are distinguishable.
## HOW
### Project findings
- `Seller.md` defines Vacation Mode as a master Seller flag that hides listings from active search and disables checkout globally for that Seller's items. fileciteturn96file0
- Dedicated `feature-system-flows/seller/vacation-mode.md` expands this with schedule start/end, storefront message, hide-or-unavailable presentation, Cart effects, existing-order obligations, safe reactivation, idempotency, and audit.
- Buyer Cart already treats Vacation Mode as a canonical Buyer-visible/Checkout availability condition. fileciteturn96file1turn96file15
- Admin Seller Compliance can independently hide Seller Products through suspension/compliance; Vacation Mode cannot override it. fileciteturn96file18
- AISLEY architecture requires Laravel authorization, centralized business rules, transactions for multi-record/state mutations, after-commit events, UTC timestamps, and audit trails. fileciteturn96file8turn96file10
### Recommended Laravel API
```http
GET    /api/seller/vacation-mode
PUT    /api/seller/vacation-mode
POST   /api/seller/vacation-mode/enable
POST   /api/seller/vacation-mode/disable
DELETE /api/seller/vacation-mode/schedule
```
- Exact action/resource shape may be simplified.
- Use Seller Policy, Form Requests, API Resource, and domain action/service.
- Never expose a generic Seller status PATCH.
### Recommended actions
```text
GetSellerVacationSettings
UpdateSellerVacationSchedule
EnableSellerVacationMode
DisableSellerVacationMode
ApplyDueSellerVacationTransitions
```
- Centralize effective-state changes in one transition service so manual and scheduler paths share rules.
### Recommended model
```text
seller/shop
- is_on_vacation
- vacation_starts_at / vacation_ends_at nullable
- vacation_message nullable
- vacation_visibility_behavior
- vacation_version / updated_at
```
- Separate schedule history table is optional; recurring vacations are not source-required.
### Transition pattern
```text
request/scheduler
→ load Seller/shop
→ transaction
→ lock/version-check
→ verify expected schedule/current state
→ apply effective vacation state
→ persist audit/state event
→ commit
→ SellerVacationStarted/Ended after commit
→ Search/Shop/Cart projection refresh
```
### Scheduler recommendation
- Periodically scan only due scheduled transitions:
```text
starts_at <= now AND not yet active
OR
ends_at <= now AND currently active
```
- Process in bounded batches.
- Use database state/version as final correctness guard.
- Laravel supports `withoutOverlapping()` and `onOneServer()` for scheduler coordination when deployment needs it. citeturn508715view0turn508715view1
### Buyer eligibility helper
Recommended shared domain/query rule:
```text
sellerCanReceiveNewOrders(seller, now)
productIsBuyerVisible(product, seller, now)
```
- Search/Browse/Cart/Checkout reuse these rules.
- Checkout performs a final authoritative check regardless of caches.
### Next.js / React
```text
/seller/settings/vacation-mode
├── VacationStatus
├── VacationScheduleForm
├── VisibilityBehavior
├── StorefrontMessage
├── EffectSummary
└── EnableDisableAction
```
- Client validation improves UX only.
- API response is authoritative for effective/scheduled state.
### Tests
- **Laravel:** Seller isolation; immediate/scheduled start/end; invalid schedules; idempotency; manual/scheduler race; audit; after-commit events.
- **Buyer:** Search/Browse presentation; stale Product/Cart blocked at Add/Checkout; preserved Cart; safe reactivation.
- **Cross-feature:** existing fulfillment works; suspended/noncompliant/archived resources remain unavailable after Vacation.
- **Frontend:** current/scheduled/effect-summary/timezone/conflict/error/accessibility states.
### Research-backed recommendations
- Persist schedule timestamps and let Laravel's scheduler apply due transitions rather than creating one OS cron rule per Seller. Laravel's scheduler centralizes application scheduling. citeturn888148view0
- Use scheduler overlap/single-server protections as operational safeguards, with transaction/idempotency still providing business correctness. citeturn508715view0turn508715view1
- Dispatch Search/Shop projection events only after the Vacation transition commits. Laravel supports after-commit domain events. citeturn508715view3
### Risks
- **Unfulfillable Orders/cross-surface drift:** stale or duplicated eligibility can still accept purchases.
- **Accidental relisting:** reactivation can expose restricted Products if eligibility is not recomputed.
- **Schedule races:** scheduler may overwrite newer manual state.
- **Existing-order neglect:** blocking merchant tools can prevent prior-Order fulfillment.
### Open questions
- `HIDE`-only MVP vs `HIDE | UNAVAILABLE`; direct Product/Add-to-Cart behavior.
- Optional end time, timezone source, scheduler cadence/batch size.
- Pending-payment and pre-sale Chat behavior.
- Marketing/low-stock external notification suppression.
- Storefront message length, audit retention, and future recurring schedules.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Buyer source: `Buyer.md`
- Admin source: `Admin.md`
- Seller flow: `feature-system-flows/seller/vacation-mode.md`
- Laravel 12 Task Scheduling: https://laravel.com/docs/12.x/scheduling
- Laravel 12 Events: https://laravel.com/docs/12.x/events
