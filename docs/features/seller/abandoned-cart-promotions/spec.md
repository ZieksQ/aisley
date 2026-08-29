---
feature: abandoned-cart-promotions
title: Seller Abandoned Cart Promotions
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Abandoned Cart Promotions
## WHAT
- **Purpose:** Let Sellers configure automated reminders or discounts for Buyers who leave eligible Seller-owned items in inactive carts.
- **Canonical role:** `SELLER`.
- **Source-defined behavior:**
  - detect carts/items inactive beyond a configured duration
  - target only eligible Seller-owned Products
  - optionally issue percentage discounts, free-shipping vouchers, or other valid configured incentives
  - cross-reference Buyer communication preferences/consent
  - send through configured email/push or other approved channels
  - avoid repeated inappropriate reminders
- `Seller.md` defines this as an automated conversion-recovery feature that scans `Carts` after inactivity and cross-references Buyer communication preferences before dispatch. fileciteturn64file5
- **System-flow requirements additionally define:**
  - Seller-configured inactivity threshold
  - eligible Products/audience
  - message/channel
  - discount/voucher rules
  - budget/usage limits
  - campaign dates
  - consent/frequency/quiet-hour checks
  - deduplicated queued delivery
  - delivery-result recording
  - suppression after purchase, expiry, opt-out, Vacation Mode, or item removal
- **Recommended flow:**
```text
Seller creates campaign
→ Laravel validates Seller/Product/promotion/message/schedule rules
→ campaign becomes ACTIVE

Laravel scheduled evaluator
→ finds inactive Cart lines for that Seller
→ excludes purchased/removed/unavailable/ineligible lines
→ rechecks consent/frequency/prior contact
→ optionally issues scoped Buyer-bound voucher
→ queues one deduplicated message
→ delivery result recorded
```
- **Architecture:**
  - Next.js/React owns Seller campaign forms, campaign list/detail, summary metrics, validation/error states.
  - Laravel owns Seller scope, campaign validation, Cart evaluation, consent checks, voucher issuance, deduplication, scheduling, jobs, notifications, and results.
  - Cart/Product/Promotion/notification records remain authoritative.
- **Recommended routes:**
```text
/seller/abandoned-cart-promotions
/seller/abandoned-cart-promotions/new
/seller/abandoned-cart-promotions/{campaign}
```
- **Feature boundaries:**
  - Buyer Cart owns cart persistence and timestamps.
  - Promotions/Vouchers owns discount math, stacking, expiry, usage limits, and redemption.
  - Account Management/notification preferences owns Buyer communication consent/preferences.
  - Vacation Mode/Product visibility/Inventory determine whether Seller items remain eligible.
  - Checkout revalidates every voucher/discount and Product state.
- **Non-goals:**
  - Seller browsing named Buyers' unrelated activity
  - creating Orders automatically
  - reserving stock
  - guaranteeing price/stock from the reminder message
  - bypassing Buyer opt-out/consent
  - inventing a specific email/push vendor
  - unrestricted mass marketing unrelated to the Seller's abandoned Cart items
## MUST
### Authentication and Seller scope
- Campaign management requires authenticated `SELLER`.
- Every campaign is scoped to the authenticated Seller/shop.
- Seller may target only Products owned by that Seller.
- Never trust client-submitted:
  - `seller_id`
  - Buyer recipient IDs
  - Product ownership
  - discount totals
  - communication eligibility
- Standard errors:
  - `401` unauthenticated
  - `403` forbidden
  - `404` scoped campaign/Product missing
  - `422` invalid campaign
  - `409` stale/state conflict
### Campaign states
- Recommended lifecycle:
```text
DRAFT
ACTIVE
PAUSED
ENDED
```
- Exact names are implementation choices.
- Only `ACTIVE` campaigns are evaluated for new recipients.
- Ended/expired campaigns must not enqueue new reminders.
- Seller cannot reactivate a campaign whose date/promotion configuration is invalid.
### Campaign configuration
- Seller configures:
  - campaign name
  - inactivity threshold
  - eligible Product scope
  - message
  - delivery channel(s)
  - optional incentive/voucher rules
  - campaign start/end
  - budget/usage limits where supported
- Source flow explicitly supports all of these.
- Exact required fields depend on final Promotion/notification models.
- Laravel validates every field server-side.
### Inactivity threshold
- A Cart/Cart Item qualifies only after no relevant Buyer activity for at least the configured duration.
- Source does not define a minimum/default duration.
- Exact duration units/range are Open.
- Use authoritative server timestamps in UTC.
- Do not trust browser timestamps.
- Define exactly which timestamp represents activity:
  - Cart `updated_at`
  - Cart Item `updated_at`
  - dedicated last-activity timestamp
- Recommended: evaluate Seller-owned Cart Item activity so one Seller's item does not become stale merely because unrelated Seller items changed.
### Eligible Seller items
- Evaluation must identify Cart lines containing Products owned by the campaign Seller.
- Do not expose other Sellers' Cart lines to the Seller campaign.
- Product must still be valid for recovery:
  - exists
  - buyer-visible/checkout-eligible
  - valid variant
  - Seller active
  - Seller not in Vacation Mode
  - sufficient/current stock according to Inventory policy
- Seller Vacation Mode disables checkout for Seller Products. fileciteturn64file5
### Purchase suppression
- Do not send a reminder if the Buyer already purchased the relevant item/order intent after the abandonment candidate was detected.
- Recheck purchase state at job execution time.
- Exact matching between Cart line and later Order Item should use stable Product/variant/order references, not product title.
- If the Cart was converted to Order and cleaned up, it must not be contacted as abandoned.
### Removal suppression
- If Buyer removes the relevant Seller item from Cart before send, suppress the reminder.
- If quantity becomes zero or Cart is cleared, suppress.
- Queued messages must recheck current Cart state immediately before delivery.
### Product/stock suppression
- Suppress hidden, archived, noncompliant, out-of-stock, or otherwise unavailable Products.
- Reminder never guarantees stock; Inventory remains authoritative.
### Consent / communication preferences
- Source explicitly requires communication-consent rules and preference checks.
- Promotional communication must respect the Buyer's current communication preferences/consent.
- Recheck consent when the queued notification is actually sent.
- Do not rely only on consent captured when campaign was created or candidate was first selected.
- Exact legal/consent fields and channel-specific requirements are Open and must follow the project's deployed jurisdiction/policy.
### Quiet hours
- Respect configured quiet hours; exact window/timezone is Open.
- Use Buyer-local timezone when available, otherwise platform policy.
### Frequency caps
- Do not contact the same Buyer/abandonment beyond the configured cap.
- Cap may be Buyer-, campaign-, abandonment-, or channel-scoped; exact window is Open.
### Prior-contact deduplication
- Before send, check whether the same logical abandonment was already contacted.
- Recommended logical key:
```text
campaign_id
+ buyer_id
+ seller_id
+ cart/cart-item abandonment reference
+ reminder_step
```
- Persist a campaign-contact record or equivalent.
- Queue retries must not create duplicate logical messages.
- Do not rely only on scheduler `withoutOverlapping()` for recipient deduplication.
### Seller privacy boundary
- Sellers get aggregate campaign performance, not unrestricted Buyer browsing profiles.
- Never expose unrelated Cart contents, Buyer search/history, other Sellers' items, private preferences, or sensitive profile data.
- Recommended MVP: aggregate results only; any recipient-level identity requires explicit approval.
### Candidate evaluator
- Use a Laravel scheduled command/job to find eligible inactive Cart lines.
- Do not evaluate the entire Cart table synchronously from Seller page requests.
- Process candidates in bounded chunks/batches.
- Query should be indexed on relevant inactivity/Seller/Product keys.
- Exact schedule frequency is Open.
### Scheduler overlap
- Prevent duplicate concurrent evaluator runs.
- Laravel scheduling supports `withoutOverlapping()` and `onOneServer()` for scheduled events when appropriate. citeturn479964search0
- Multi-server deployments should use one-server scheduling or equivalent distributed locking.
- Recipient-level dedupe remains necessary even when the evaluator does not overlap.
### Candidate revalidation
- A scheduled scan creates only a candidate.
- Before issuing a voucher or notification, recheck:
  - campaign still active
  - Seller still eligible
  - Cart item still exists/inactive
  - Product/variant still eligible
  - Buyer has not purchased/removed it
  - Buyer still consents to channel
  - quiet hours
  - frequency cap
  - prior contact
- This is required because queued work may execute after state changes.
### Promotion / voucher integration
- If campaign includes an incentive, use the authoritative Promotions/Vouchers domain.
- Validate:
  - Seller/Product scope
  - start/end dates
  - amount/percentage
  - thresholds
  - usage limits
  - budget limits where implemented
  - stacking/combinability
- Do not calculate arbitrary discounts inside notification code.
- Buyer Cart/Checkout must revalidate the incentive at redemption.
### Buyer-bound voucher
- System flow supports a Buyer-bound/scope-limited voucher.
- Recommended voucher constraints when this mode is used:
  - specific Buyer
  - Seller/Product scope
  - expiry
  - usage count
  - campaign reference
- Exact code format and discount type are Open.
- Do not create a reusable public voucher unless Seller configured one intentionally.
### Free-shipping voucher
- `Seller.md` gives free-shipping vouchers as an example incentive. fileciteturn64file5
- This is only valid if AISLEY's Promotions/Shipping domains support it.
- Do not fake free shipping with frontend text if shipping calculation has no compatible promotion rule.
### Voucher idempotency
- Retry of campaign evaluation must not issue multiple equivalent Buyer vouchers.
- Recommended uniqueness:
```text
campaign_id + buyer_id + abandonment_reference + incentive_step
```
- If voucher issuance and contact record are multi-record operations, persist them transactionally where appropriate.
### Voucher expiry
- Campaign-generated voucher must have authoritative expiry if configured.
- Expired voucher cannot be redeemed.
- Notification may display expiry, but Checkout decides validity using server time.
- Timestamps are UTC/ISO 8601 and rendered in locale. fileciteturn64file8
### Checkout revalidation
- Message/voucher does not guarantee:
  - Product still exists
  - stock
  - price
  - shipping
  - discount eligibility
- Buyer Cart/Checkout revalidates Product/variant/stock/price/promotion before Order placement. fileciteturn64file0
- If incentive is no longer valid, Checkout returns authoritative current totals/errors.
### Notification channels
- Seller source mentions email or push notifications. fileciteturn64file5
- System flow allows configured channel(s).
- Use AISLEY's configured notification infrastructure.
- Do not hard-code FCM, Brevo, SMTP, etc. unless repository configuration selects them.
- Laravel Notifications can choose channels per recipient and queue external delivery. citeturn665688search1
### Queued delivery
- Campaign delivery must be asynchronous.
- Laravel queued notifications avoid blocking request/scheduler execution on external delivery calls. citeturn665688search1
- Queue retries must preserve logical deduplication.
- Failed delivery may retry according to channel policy.
### Final send check
- A queued notification must make a final eligibility decision before actual send.
- Laravel Notifications supports `shouldSend()` for queued notifications, allowing final state checks at processing time. citeturn665688search1
- Use equivalent domain guard if notification implementation differs.
- Suppress when purchase, opt-out, removal, expiry, Vacation Mode, or ineligibility occurred after enqueue.
### After-commit behavior
- Voucher/contact/result records and queued work must not observe rolled-back campaign mutations.
- Shared AISLEY rules require queued notifications after source transaction commit. fileciteturn64file4turn64file8
- Laravel queued notifications support `afterCommit()`. citeturn665688search1
- Notification failure must not roll back an already valid Promotion/domain transaction.
### Delivery results
- Record campaign contact/delivery state, e.g.:
```text
QUEUED
SENT
FAILED
SUPPRESSED
```
- Exact states are implementation choices.
- Record safe provider/channel result references where available.
- Do not persist unnecessary raw provider payloads containing Buyer data.
- Delivery success is not the same as purchase conversion.
### Conversion attribution
- System flow says Sellers receive aggregate campaign results.
- Recommended metrics:
  - eligible candidates
  - queued/sent
  - suppressed
  - delivery failures
  - voucher issued
  - voucher redeemed
  - recovered Orders/revenue when safely attributable
- Exact attribution window/rule is Open.
- Do not claim a campaign caused a purchase unless attribution rule is defined.
### Budget / usage limits
- Source flow supports budget/usage limits.
- Campaign evaluator must stop issuing incentives once authoritative limit is reached.
- Concurrent issuance must not exceed a hard limit when the limit is strict.
- Use transactional/atomic counters where necessary.
- Exact budget currency/meaning is Open.
### Campaign dates
- Evaluate only ACTIVE campaigns within authoritative start/end dates.
- Render dates in Seller locale while server comparisons use authoritative timestamps.
- Ended campaigns retain history/metrics.
### Pause
- Seller may pause an active campaign.
- Paused campaign cannot create new contacts/vouchers.
- Already queued messages must recheck campaign state and suppress before send.
- Resume rules use remaining valid dates/budget.
### Delete / archive campaign
- Destructive deletion is not source-defined; recommended to retain/archive campaign/contact history.
- Retention policy is Open.
### Message content
- Seller may configure message content.
- Validate length/content server-side.
- Treat content as untrusted Seller-authored text.
- Do not permit arbitrary executable HTML.
- If templates/variables are supported, allow-list variables such as:
```text
buyer_display_name
product_name
voucher_code
voucher_expiry
shop_name
```
- Never expose sensitive Buyer data through template variables.
### Campaign list
- Seller campaign list must be paginated.
- Recommended fields:
  - campaign name
  - state
  - dates
  - inactivity threshold
  - Product scope summary
  - channel
  - incentive summary
  - aggregate sent/recovered metrics
- Allow-list filters/sorts.
### Frontend states
- Campaign list: loading, empty, loaded, filtered-empty, error.
- Form: draft, validating, saving, saved, validation error.
- Campaign: active, paused, ended, budget/usage exhausted.
- Metrics: loading, loaded, no contacts, error.
- Seller UI must not expose private Buyer recipient-selection internals.
### Accessibility
- Use labeled fields, field-addressable errors, textual state, accessible campaign actions, and screen-reader-friendly metrics/validation updates.
### Acceptance criteria
- [ ] Seller can configure campaigns only for their own Products/shop.
- [ ] Candidate selection uses inactive Cart lines, not unrelated Buyer behavior.
- [ ] Purchased/removed/unavailable/Vacation Mode items are suppressed.
- [ ] Buyer communication consent/preferences are checked before delivery.
- [ ] Frequency caps/quiet-hour rules are enforced according to configuration.
- [ ] Same logical abandonment is not contacted repeatedly beyond limits.
- [ ] Campaign-generated vouchers are scoped, expiring, usage-limited, and retry-safe.
- [ ] Checkout revalidates voucher/stock/price; reminder never guarantees them.
- [ ] Scheduled evaluation is chunked and protected from overlapping runs.
- [ ] Queue workers recheck campaign/cart/consent/product state before send.
- [ ] Notification delivery is asynchronous and after commit.
- [ ] Delivery results are recorded.
- [ ] Seller receives aggregate campaign results without unrelated Buyer-behavior exposure.
- [ ] Purchase/expiry/opt-out/removal/pause suppress future inappropriate reminders.
## HOW
### Project findings
- `Seller.md` defines Abandoned Cart Promotions as automatic notifications/discounts after Cart inactivity, with scheduled scanning and Buyer communication-preference checks. fileciteturn64file5
- The dedicated Seller system flow further requires campaign dates, Product/audience scope, message/channel, discount/voucher rules, budget/usage limits, consent, quiet hours, frequency caps, deduplicated queued messaging, suppression, and aggregate Seller results.
- Buyer Cart persistence already needs timestamps so abandoned-cart tooling can identify stale intent; Cart itself does not own abandonment timing or campaign rules. fileciteturn64file3
- Shared AISLEY architecture makes Laravel authoritative, queues notifications after commit, scopes tenant data, paginates lists, and uses fixed-precision money. fileciteturn64file4turn64file8
### Recommended data model
```text
abandoned_cart_campaigns
- id
- seller_id
- name
- status
- inactivity_minutes/hours
- starts_at
- ends_at
- channel configuration
- message/template
- incentive/promotion reference nullable
- budget/usage limits nullable
- created_at
- updated_at

abandoned_cart_contacts
- id
- campaign_id
- buyer_id
- cart/cart_item reference
- product/variant reference
- voucher_id nullable
- status
- contacted_at nullable
- suppression_reason nullable
- provider_reference nullable
- dedupe_key unique
```
- Product scope may use a join table when multiple Products are selected.
- Exact schema should reuse existing Promotions/Notifications models where possible.
### Laravel API
```http
GET    /api/seller/abandoned-cart-campaigns
POST   /api/seller/abandoned-cart-campaigns
GET    /api/seller/abandoned-cart-campaigns/{campaign}
PATCH  /api/seller/abandoned-cart-campaigns/{campaign}
POST   /api/seller/abandoned-cart-campaigns/{campaign}/activate
POST   /api/seller/abandoned-cart-campaigns/{campaign}/pause
GET    /api/seller/abandoned-cart-campaigns/{campaign}/metrics
```
- Use Form Requests, Seller-scoped Policies, API Resources, and thin controllers.
### Domain actions
Recommended:
```text
CreateAbandonedCartCampaign
UpdateAbandonedCartCampaign
ActivateAbandonedCartCampaign
PauseAbandonedCartCampaign
EvaluateAbandonedCartCampaigns
EvaluateAbandonedCartCandidate
IssueCampaignVoucher
QueueAbandonedCartReminder
RecordCampaignDelivery
```
- Keep Promotions, Cart, Inventory, and Notification logic in their owning domains.
### Scheduler
- Schedule one evaluator command/job at the selected cadence.
- Laravel's scheduler supports overlap prevention and single-server execution when needed. citeturn479964search0
- Evaluator should:
```text
load ACTIVE campaigns in window
→ find stale Seller-owned Cart lines in chunks
→ dispatch candidate-evaluation jobs
```
- Do not send channel messages directly from the scheduler loop.
### Queue / notification pattern
```text
scheduled evaluator
→ candidate job
→ revalidate eligibility
→ transaction: contact/voucher/dedupe record
→ commit
→ queued Notification
→ shouldSend/final guard
→ channel
→ record SENT/FAILED/SUPPRESSED
```
- Laravel supports queued notifications, channel selection, `afterCommit()`, and final `shouldSend()` checks. citeturn665688search1
### Next.js / React
```text
/seller/abandoned-cart-promotions
├── CampaignTable
├── CampaignFilters
└── AggregateMetrics

/new or /[campaign]
├── ScheduleFields
├── ProductScopeSelector
├── MessageEditor
├── ChannelSelector
├── IncentiveFields
├── BudgetUsageFields
└── CampaignActions
```
- Next.js submits intent to Laravel; it never performs Cart eligibility or discount math itself.
### Tests
- **Laravel:** Seller isolation; validation; inactivity/Product scope; purchase/removal/stock/Vacation suppression; consent/quiet-hour/frequency; dedupe; voucher rules; pause/end; scheduler overlap; after-commit/final-send checks; aggregate privacy.
- **Queue:** retries do not duplicate contacts/vouchers; stale sends suppress.
- **Frontend:** list/form/state/metrics/errors/accessibility.
### Research-backed recommendations
- Use Laravel's scheduler instead of a bespoke cron script for the application-level evaluation command; overlap/single-server controls are available. citeturn479964search0
- Queue notification delivery because external channels can be slow; Laravel supports queued per-recipient/channel jobs. citeturn665688search1
- Re-evaluate eligibility immediately before queued send with `shouldSend()` or equivalent so stale reminders can be suppressed. citeturn665688search1
### Risks
- **Spam/privacy:** weak consent/frequency/privacy boundaries can over-message Buyers or expose behavior.
- **Duplicates/staleness:** overlapping scans/retries can resend or reference purchased/removed/unavailable items.
- **Promotion/budget abuse:** weak scope or atomic limits can create unintended discounts or overspend.
- **Attribution/scale:** undefined attribution can overstate results; unindexed full-table scans can become expensive.
### Open questions
- Inactivity threshold and exact Cart activity timestamp.
- Supported channels, consent fields, quiet hours, frequency cap/cooldown, and reminder sequence.
- Product scope selection and supported incentive types.
- Voucher generation/expiry/stacking/usage/Buyer-binding.
- Budget enforcement and recovered-Order attribution window.
- Aggregate-only vs recipient-level Seller reporting.
- Campaign retention and evaluator cadence.
- Whether identifiable guest carts can qualify.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller feature source: `Seller.md`
- Seller flow: `feature-system-flows/seller/abandoned-cart-promotions.md`
- Laravel Notifications: https://laravel.com/docs/12.x/notifications
- Laravel Queues: https://laravel.com/docs/12.x/queues
- Laravel Scheduler API: https://api.laravel.com/docs/12.x/Illuminate/Console/Scheduling/ManagesAttributes.html
