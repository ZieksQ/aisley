---
feature: order-modification-cancellation
title: Customer / Buyer Order Modification & Cancellation
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Order Modification & Cancellation
## WHAT
- **Purpose:** Give an authenticated Buyer a short grace period to correct an order mistake or cancel the order before the Seller begins physical fulfillment.
- **Canonical role:** `BUYER`.
- **Source-defined capabilities:**
  - cancel an order before Seller processing
  - change order details such as shipping address
  - rectify checkout mistakes such as an incorrect variant
  - strictly gate modification/cancellation by time and/or order status
- **Source intent:** once the Seller begins processing/preparation or incurs fulfillment/waybill work, Buyer self-service modification must stop.
- **Shared AISLEY order lifecycle:**
```text
PENDING_PAYMENT
→ PLACED
→ SELLER_PROCESSING
→ READY_FOR_PICKUP
→ ASSIGNED
→ PICKED_UP
→ IN_TRANSIT
→ OUT_FOR_DELIVERY
→ DELIVERED
```
- Terminal/exception states include `CANCELLED`.
- **Important source gap:** `Buyer.md` gives `order.status == PENDING` only as an example; AISLEY's normalized lifecycle does not define a literal `PENDING` state.
- Therefore exact eligible statuses must be mapped to the implemented lifecycle without inventing a new state.
- **Recommended semantic boundary:**
```text
buyer-modifiable
= order exists
+ belongs to Buyer
+ has not entered Seller processing
+ optional grace deadline has not expired
+ requested change remains valid
```
- **Architecture:**
  - Next.js/React sends modification/cancellation intent and renders current eligibility.
  - Laravel owns Buyer authorization, eligibility rules, state transitions, inventory/payment/address validation, transactions, concurrency control, and events.
  - Database order state is authoritative.
- **Recommended entry point:**
```text
/orders/{order}
```
- **Non-goals:**
  - editing orders after fulfillment has begun
  - arbitrary client-side status changes
  - returns after delivery
  - delivery-failure handling
  - Seller rejection workflow
  - dispute/refund adjudication
  - inventing a fixed grace-period duration
  - inventing payment-provider refund rules
## MUST
### Authentication and ownership
- Modification/cancellation requires authenticated `BUYER`.
- Every target Order must be scoped to the authenticated Buyer.
- Never trust client-submitted:
  - `buyer_id`
  - order owner
  - current status
  - `can_modify`
  - `can_cancel`
  - deadline/eligibility
- Another Buyer must not read or mutate the Order through these endpoints.
- Use:
  - `401` unauthenticated
  - `403` forbidden where appropriate
  - `404` Buyer-scoped Order not found
  - `422` invalid requested changes
  - `409` stale state / concurrent transition / expired eligibility
### Laravel-owned eligibility
- React may display whether modification/cancellation appears available, but Laravel decides at mutation time.
- Use one canonical domain rule, conceptually:
```text
canBuyerModify(order, now)
canBuyerCancel(order, now)
```
- The rule must evaluate the **current persisted state**, not state cached when the page loaded.
- Eligibility must account for:
  - Buyer ownership
  - current Order state
  - Seller-processing boundary
  - optional grace-period deadline
  - payment/inventory constraints where relevant
  - whether the requested field can still be changed
- Do not duplicate the eligibility formula independently in multiple controllers/components.
### Seller-processing boundary
- Source explicitly allows self-service changes only **before the Seller processes the order**. fileciteturn38file0
- AISLEY's shared lifecycle defines `SELLER_PROCESSING` after `PLACED`. fileciteturn38file1
- Recommended interpretation:
  - `SELLER_PROCESSING` and later normal fulfillment states are not Buyer-modifiable/cancellable through this self-service feature.
- Earlier eligible states depend on the final checkout/payment design.
- Do not assume `PENDING_PAYMENT` and `PLACED` have identical cancellation/payment behavior.
- Seller transition into processing and Buyer mutation must be concurrency-safe.
### Time window
- Source requires a "strict time window" but provides no duration.
- Do not hard-code 5/10/15/etc. minutes in this spec.
- If time-based gating is implemented:
  - persist or deterministically derive an authoritative deadline
  - use server time
  - store timestamps in UTC
  - return deadline/eligibility to React as informational data
  - recheck deadline inside the mutation transaction
- Browser countdown reaching zero is not authoritative.
- If final product design uses status-only gating, no artificial timer is required.
### Eligibility response
- Order detail may return safe capability flags computed by Laravel:
```json
{
  "canModify": true,
  "canCancel": true,
  "modifiableFields": ["shipping_address"],
  "modificationDeadline": null
}
```
- This is a presentation aid only.
- Mutation endpoints must recompute all rules.
- `modifiableFields` must be server-generated.
### Modifiable fields
- Source explicitly mentions shipping-address change and gives wrong variant as a correction example. fileciteturn38file0
- Exact final field allow-list is not fully defined.
- At minimum, implementation must not accept arbitrary Order-column patching.
- Use explicit domain actions for approved changes.
- Candidate source-backed actions:
  - change shipping address
  - change selected variant where commerce rules permit
- Quantity change is not explicitly source-defined and remains Open.
- Do not allow mutation of:
  - Buyer ownership
  - Seller ownership
  - Order ID
  - arbitrary price/totals
  - payment status
  - fulfillment status
  - commission
  - created timestamps
### Shipping-address modification
- Address changes must integrate with Buyer Address Book/order-address snapshot rules.
- Buyer selects:
  - a Buyer-owned saved Address, or
  - another address only if Checkout/Address Book explicitly allows one-time addresses.
- Laravel validates ownership and address requirements.
- Update the **Order's delivery-address snapshot**, not the saved Address Book row.
- Existing saved Address Book data must not be rewritten merely because one Order changes.
- Re-run any delivery/serviceability validation required by the shipping/logistics domain.
- Once Order leaves the allowed modification window, editing Address Book cannot reroute it.
### Address/logistics consistency
- A successful pre-processing address change must become the authoritative Order destination.
- Logistics/Courier must later consume that updated Order snapshot.
- No logistics/courier assignment, waybill, or routing artifact should retain an obsolete address when the change was accepted before their creation.
- If such downstream artifacts already exist, self-service modification should normally be denied unless the owning workflow explicitly supports regeneration.
- Exact waybill-generation boundary is coordinated with Seller Prepare Orders.
### Variant modification
- `Buyer.md` cites "wrong variant" as a mistake this grace-period feature is intended to rectify. fileciteturn38file0
- Variant changes require server validation of:
  - product relationship
  - variant existence
  - variant buyer-visibility
  - stock availability
  - Seller availability
  - price effects
- Do not simply update a variant ID.
- If changing variant changes price/discount/payment amount, the payment/order-total domain must reconcile the difference.
- Exact paid-order repricing behavior is not defined and is Open.
- If safe repricing/payment adjustment is not implemented, variant changes may be restricted to equivalent-price variants or deferred from MVP.
- Do not oversell inventory during a variant swap.
### Inventory implications
- Checkout owns the authoritative inventory reservation/decrement strategy.
- Cancellation/modification must reverse or adjust inventory only according to that actual strategy.
- If inventory was reserved/decremented when the Order was placed:
  - cancellation releases/restores the relevant quantity
  - variant change releases old allocation and reserves new allocation atomically
- If inventory is not reserved until later, do not invent restoration entries.
- Inventory adjustments must be transactional and concurrency-safe.
### Price/totals
- Buyer cannot submit authoritative replacement totals.
- Laravel recalculates any affected totals using the same pricing/promotions rules as Checkout.
- Use fixed-precision money.
- A modification that changes payable amount must not leave Order and payment records inconsistent.
- Exact voucher/discount re-evaluation policy after modification is Open.
- Shipping-address changes may require shipping-fee recalculation if the shipping domain prices by destination; this is not defined by current sources.
### Payment boundary
- `Buyer.md` does not define cancellation refund/reversal behavior.
- `View Cart` only establishes that Checkout integrates with payment gateways. fileciteturn39file3
- Do not assume cancellation always means:
  - automatic refund
  - void
  - no financial action
- Cancellation must inspect authoritative payment state.
- Payment consequence must be handled through the payment domain/provider integration.
- Recommended separation:
```text
ORDER STATE
CANCELLED

PAYMENT STATE
handled independently according to provider/domain rules
```
- A paid cancellation may require refund/reversal processing, but exact timing/statuses are Open.
- Never fake a successful refund by only changing `orders.status`.
### Cancellation
- Cancellation is an explicit domain transition, not a generic status patch.
- Conceptual transition:
```text
eligible pre-processing state
→ CANCELLED
```
- Laravel must:
  1. authenticate and scope Order
  2. lock/reload current Order state
  3. verify cancellation eligibility
  4. apply payment/inventory consequences required by actual domains
  5. transition Order to `CANCELLED`
  6. persist cancellation metadata if schema supports it
  7. commit
  8. emit notifications/events after commit
- Repeating cancellation for an already-cancelled Order must be idempotent or return a stable conflict response.
### Cancellation reason
- Source does not require one.
- If added, validate allow-listed reason codes, bound/sanitize free text, and keep Buyer text separate from internal reason metadata.
### State machine
- Never accept:
```json
{ "status": "CANCELLED" }
```
as arbitrary trusted status mutation.
- Use named transition actions/services.
- Shared AISLEY rule: a state transition is accepted only when the current state permits it. fileciteturn38file1
- Invalid late transitions return `409` where stale-state conflict semantics apply.
- Order-detail response should refresh after conflict.
### Concurrency
- Main race:
```text
Buyer clicks Cancel/Modify
at the same time
Seller starts processing
```
- Only one valid transition path may win.
- Wrap transition in a database transaction.
- Lock the current Order row or use an equivalent atomic compare-and-update strategy.
- Recheck state/deadline after acquiring the lock.
- Laravel's query builder exposes `lockForUpdate()` for pessimistic row locking. citeturn671361search0
- Never rely solely on disabling buttons in React.
### Idempotency
- Duplicate cancellation/modification requests must not:
  - cancel twice
  - restore stock twice
  - issue duplicate financial actions
  - duplicate notifications
- Use an idempotency key or equivalent stable-operation protection consistent with project conventions. fileciteturn39file0
- Provider-side idempotency, if available, supplements application-level protection.
### Modification history
- Source does not define a dedicated table, but preserving Order ID, change type, safe before/after summary, Buyer actor, and timestamp is recommended.
- Reuse an Order history/event trail when available; do not overwrite dispute-relevant history.
### Seller notification
- Seller-facing Order views must reflect accepted cancellation/modification.
- Exact notification channel is not source-defined; any notifications/broadcasts happen after commit and failure must not roll back the Order change. fileciteturn38file1
### Buyer order-status integration
- View Orders' Status must show accepted changes/cancellation; cancelled Orders remain in history.
- Real-time updates are optional; refetch remains authoritative.
### Seller Prepare Orders boundary
- Seller Prepare Orders generates waybill/shipping details for fulfillment. fileciteturn39file2
- Buyer source explicitly wants intervention before Seller commits to fulfillment or label generation. fileciteturn38file0
- Seller preparation must therefore use the same canonical Order state/eligibility boundary.
- Buyer self-service must not race successfully against a committed transition that has already started fulfillment.
- Exact point at which Seller action enters `SELLER_PROCESSING` must be defined by Seller Order/Prepare Order specs.
### Logistics boundary
- Once an Order has progressed to logistics-facing states such as `READY_FOR_PICKUP` or later, this Buyer self-service feature must not modify/cancel it.
- Post-processing exceptions belong to:
  - seller/logistics exception flows
  - delivery failure
  - return/refund
  - complaints/disputes
as appropriate.
- Do not reuse pre-processing cancellation to mutate in-transit Orders.
### Frontend behavior
- Order Detail should show controls only when Laravel reports them available.
- Modification UI should show only server-approved fields.
- Before cancellation:
  - show confirmation
  - explain that the action affects the current Order
  - show payment/refund wording only if authoritative backend/payment policy supplies it
- During mutation:
  - disable duplicate submission
  - display processing state
- On `409`:
  - refetch Order
  - explain that the Order changed/processing already began
  - remove invalid actions
### Countdown UI
- A countdown is optional; when used, its deadline comes from Laravel and remains presentation-only.
- Expiry disables the UI, but the mutation still revalidates server-side.
### Accessibility
- Provide labeled Modify/Cancel controls, identifiable cancellation confirmation, announced errors/conflicts, and non-color-only destructive-state cues.
- Countdown cannot be the only eligibility indicator.
### Acceptance criteria
- [ ] Guest cannot modify/cancel a Buyer Order.
- [ ] Buyer cannot modify/cancel another Buyer's Order.
- [ ] Laravel recomputes eligibility at mutation time.
- [ ] Seller-processing and later fulfillment states reject Buyer self-service changes.
- [ ] No fixed time window is invented unless product configuration defines one.
- [ ] Client cannot submit arbitrary Order status or totals.
- [ ] Shipping-address change updates Order snapshot, not saved Address Book data.
- [ ] Late Address Book edits do not reroute an ineligible Order.
- [ ] Variant change, when enabled, validates stock/price/payment impact.
- [ ] Inventory reversal/adjustment follows actual Checkout reservation semantics.
- [ ] Paid cancellation does not pretend a refund occurred by status change alone.
- [ ] Cancellation transitions explicitly to `CANCELLED`.
- [ ] Concurrent Seller-processing vs Buyer-cancel race has one valid winner.
- [ ] Duplicate requests do not duplicate inventory/payment/notification effects.
- [ ] Successful changes are visible in Buyer Order Status.
- [ ] Seller-facing Order detail receives authoritative updated state after commit.
- [ ] Notifications/events are emitted after commit.
- [ ] `409` stale-state response causes frontend refetch.
- [ ] Historical cancelled Orders remain available for tracking/history.
## HOW
### Project findings
- `Buyer.md` explicitly defines a grace-period feature for cancelling or correcting an Order before Seller processing and gives wrong variant/incorrect address as examples. fileciteturn38file0
- It requires strict time/status gating but only gives `order.status == PENDING` as an example, not a canonical status. fileciteturn38file0
- AISLEY's shared lifecycle instead defines `PENDING_PAYMENT → PLACED → SELLER_PROCESSING → ...` and includes `CANCELLED` as a terminal/exception state. fileciteturn38file1
- Seller Prepare Orders creates waybills/shipping details, matching the Buyer's source-defined cutoff before fulfillment/label work begins. fileciteturn39file2
- Address Book provides Buyer-owned saved addresses; the accepted modification should change the Order destination snapshot, not mutate Address Book history. fileciteturn39file1
- Current sources do not define the grace-period duration, exact eligible statuses, cancellation reason, refund behavior, quantity changes, repricing rules, or paid variant-change handling.
### Recommended domain actions
- Keep status-changing logic out of generic CRUD controllers.
- Suggested actions:
```text
CancelBuyerOrder
ChangeBuyerOrderAddress
ChangeBuyerOrderVariant    # only when supported
```
- Shared eligibility policy/service:
```text
BuyerOrderModificationPolicy
OrderTransitionService
```
- These should use the same Order state machine as Seller/Logistics/Courier transitions.
### Laravel API
Conceptual endpoints:
```http
GET  /api/buyer/orders/{order}/modification-options
POST /api/buyer/orders/{order}/cancel
POST /api/buyer/orders/{order}/change-address
POST /api/buyer/orders/{order}/change-variant   # optional
```
- Dedicated intent endpoints are preferable to a broad:
```http
PATCH /api/buyer/orders/{order}
```
that accepts arbitrary mutable Order fields.
- Use Form Requests, Buyer-scoped Policy/queries, API Resources, and transactions.
### Transaction / locking
Recommended cancellation pattern:
```text
DB transaction
→ load Buyer-owned Order FOR UPDATE
→ recompute state/deadline eligibility
→ reconcile inventory/payment domain effects
→ transition to CANCELLED
→ persist history
→ commit
→ dispatch events/notifications after commit
```
- Laravel exposes transactions and `lockForUpdate()` for pessimistic locking. citeturn671361search0turn671361search7
- A row lock/atomic transition is important because Seller processing can race the Buyer request.
### After-commit work
- Events/notifications to Buyer/Seller/other consumers must observe committed Order state.
- Laravel queues support `after_commit`/`afterCommit()`, and rolled-back transaction jobs are discarded when configured accordingly. citeturn671361search1turn674217search0
- Do not call slow notification/provider services inside the locked transaction unless the financial workflow specifically requires a synchronous provider decision.
### Address implementation
- `ChangeBuyerOrderAddress`:
  1. lock/reload Order
  2. verify Buyer eligibility
  3. resolve selected Buyer-owned Address
  4. run applicable address/serviceability validation
  5. copy normalized fields into Order address snapshot
  6. recalculate shipping fee only if authoritative shipping rules require it
  7. record change
- Never point historical fulfillment solely at a mutable Address Book row.
### Variant implementation
- If enabled:
  1. lock Order and affected inventory records in a consistent order
  2. verify modification eligibility
  3. validate target variant belongs to the ordered product/Seller
  4. validate availability
  5. release old/reserve new stock according to Checkout semantics
  6. recalculate authoritative prices/promotions
  7. reconcile payment difference if supported
  8. persist item change/history
- If the project cannot safely reconcile price/payment differences, limit or defer variant modification rather than producing inconsistent financial state.
### Next.js / React
- Integrate into Order Detail:
```text
OrderModificationPanel
├── ChangeAddressAction
├── ChangeVariantAction? 
├── CancelOrderAction
└── Eligibility/DeadlineDisplay
```
- Fetch server capability flags with Order detail or a dedicated options endpoint.
- Use dialogs/forms only as intent collection.
- On mutation success, replace/refetch Order DTO.
- On `409`, immediately refetch authoritative Order and hide stale actions.
### Tests
- **Laravel:** ownership; eligible cancellation; late-state rejection; deadline expiry; address ownership; order snapshot update; variant stock validation; inventory restoration; paid-order boundary; cancellation idempotency; Seller-processing race; row-lock/atomic behavior; after-commit notification; rollback; safe history.
- **Frontend:** controls from capability flags; confirmation; address/variant validation; countdown presentation; duplicate-submit prevention; cancellation success; `409` refetch; payment/refund wording only when returned by backend policy; accessibility.
### Research-backed recommendations
- Use explicit Laravel domain transitions rather than arbitrary status patching.
- Wrap competing Order transitions in a transaction and use row-level locking/atomic checks; Laravel exposes `lockForUpdate()`. citeturn671361search0
- Validate mutation input with dedicated Laravel Form Requests. citeturn671361search5
- Dispatch notification/event follow-up after commit so rolled-back changes are not announced. citeturn671361search1
- Keep payment cancellation/refund behavior provider/domain-specific because AISLEY sources do not define it.
### Risks
- **Race with Seller:** cancellation and Seller processing can both succeed without locking/atomic transition.
- **Inventory corruption:** cancellation/variant changes can release or reserve stock twice.
- **Payment inconsistency:** marking Order cancelled without reconciling captured payment can leave money/state mismatched.
- **Address drift:** storing only a live Address Book reference can reroute an existing Order after profile edits.
- **Price drift:** variant/address change may affect totals/discounts/shipping.
- **Duplicate side effects:** retries can duplicate refunds, stock restoration, or notifications.
- **Stale UI:** Buyer may click a control moments after Seller processing begins.
- **State mismatch:** source's example `PENDING` does not directly match AISLEY's normalized lifecycle.
### Open questions
- Exact grace-period duration, if any.
- Exact eligible lifecycle states (`PLACED` is the likely normalized pre-processing candidate, but must be confirmed).
- Whether `PENDING_PAYMENT` Orders use this same cancellation flow.
- Exact modifiable fields beyond shipping address and wrong-variant correction.
- Whether quantity changes are supported.
- Variant repricing policy and whether only same-price variant swaps are allowed.
- Voucher/promotion re-evaluation after modification.
- Shipping-fee recalculation after address change.
- Payment authorization/capture model.
- Refund/void/reversal behavior and provider.
- Cancellation reason requirement.
- Inventory reservation/decrement timing from Checkout.
- Waybill generation moment relative to `SELLER_PROCESSING`.
- Whether Seller receives real-time broadcast, notification, or both.
- Modification-history schema/retention.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Buyer feature model: `Buyer.md`
- Seller feature model: `Seller.md`
- Buyer Address Book spec/source
- Laravel Query Builder / locking API: https://api.laravel.com/docs/12.x/Illuminate/Database/Query/Builder.html
- Laravel database connection/transactions API: https://api.laravel.com/docs/12.x/Illuminate/Database/ConnectionInterface.html
- Laravel Queues / after-commit: https://laravel.com/docs/12.x/queues
- Laravel Form Requests API: https://api.laravel.com/docs/12.x/Illuminate/Foundation/Http/FormRequest.html
