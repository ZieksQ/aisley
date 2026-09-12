---
feature: courier-delivery-history
title: Delivery History
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented read-only final-mile history API; advanced filters deferred
implementation_status: Courier-scoped delivered task list/detail APIs are implemented; Flutter screen and cursor/date filters remain external/deferred
canonical: true
role: Courier
scope: Laravel API and external Flutter application
backend_contract_commit: 4774f35
backend_contract_version: courier-delivery-history-v1
---

# Delivery History

## WHAT

- Give a Courier a read-only archive of final-mile deliveries completed under its own assignment.
- Display historical references, delivery dates, operational summaries, and safe proof status.
- The current backend has first-mile pickup confirmations and route manifests.
- The shared delivered task/completion records prove the committed final-mile delivery; legacy first-mile pickup confirmations remain excluded.
- Complete Delivery creates the delivered event after Logistics validates proof.
- This feature reads that event; opening history never creates or repairs it.
- The history endpoints below are implemented against the shared operational schema.
- Preserve one Logistics organization/sole hub and independent first-mile/final-mile assignment.
- Exclude earnings calculation, disputes, refunds, returns, exports, live tracking, and status mutation.
- Production history screens belong in the external Flutter project.

```text
Courier intent + Logistics-validated proof
→ atomic final-mile delivered event
→ authorized history list
→ read-only delivery detail
```

## MUST

### Authentication and ownership

- Require Sanctum bearer authentication and courier.active on every route.
- Recheck active account, approved affiliation, active Logistics organization, and its sole hub.
- Scope by the Courier recorded on the successful final-mile assignment.
- Also enforce the task's organization/hub relationship against the currently authorized affiliation.
- A same-email Customer/Seller/Admin/Logistics account cannot inherit Courier history.
- Never accept courier_id, organization_id, hub_id, role, or ownership overrides from the query.
- A first-mile Courier cannot view another Courier's final-mile delivery as its own completed task.
- Rejected and superseded offers confer no successful-delivery ownership.
- Reassignment preserves historical offers without changing who completed the successful delivery.
- A deactivated/suspended Courier retains records in storage but cannot access protected history.
- Historical affiliation portability requires a separate policy; do not silently expose another organization's records.
- Guessing an Order, task, proof, or assignment UUID cannot bypass scoping.

### Authoritative query

- Read tasks with leg final_mile and task status delivered.
- Require the linked committed completion event, Shipment delivered state, and Order delivered projection.
- Use delivered as the canonical persisted status; “Completed” is a display label.
- Do not create a separate completed enum or equate pickup success with final delivery.
- Use delivered_at from the authoritative server completion event in UTC.
- The completion transaction supplies task/Shipment/Order consistency; history must not repair mismatches.
- Inconsistent or missing completion relationships produce an operational error for investigation.
- Do not fabricate delivered_at from updated_at, notification time, or the current date.
- Exactly one history row represents one delivered final-mile task.
- Joins to proof, offers, and notification events must not duplicate history rows.
- No arbitrary status filter can broaden the query to active work or another Courier.
- Active tasks remain owned by Dashboard and Deliver Order.

### Immutable snapshots

- Use Order/Parcel/waybill snapshots captured by the owning fulfillment contracts.
- Current Customer address-book edits cannot rewrite past delivery addresses.
- Current Product title/price changes cannot rewrite delivered item snapshots.
- Current Courier profile/vehicle changes cannot rewrite historical assignment actors.
- Retain opaque task, Shipment, Parcel, Order, and completion-event identifiers for traceability.
- Keep subsequent correction events separate from the original delivered timestamp.
- History offers no edit, delete, reassign, reopen, or mark-delivered control.
- Deleting a notification never deletes a delivery event.
- Return/refund/dispute events are deferred; do not create fictional timeline steps for them.

### Privacy and related features

- List rows show Order reference, delivered time, pickup/destination area, and safe item-count summary.
- Historical detail may show item names/quantities and immutable operational references.
- Default historical address projection is area-level; omit street/house address and contact phone.
- Broader historical PII access requires a separately approved retention/visibility contract.
- Never expose passwords, tokens, payment credentials, registration evidence, or raw storage paths.
- Show proof status and an opaque proof reference where authorized.
- Raw proof bytes/URLs are excluded from history; Proof of Delivery owns any authorized preview.
- Reauthorize related proof access independently; a history link never grants additional permission.
- Incident, chat, earnings, tips, ratings, exports, and settlement links remain deferred.
- Do not calculate a Courier payout from Order totals or COD amount.
- Sensitive proof reads may use the proof owner's access audit without duplicating delivery history.

### Route and time display

- Display stored provider-neutral distance/duration only when available and authorized.
- Missing distance or duration is null, not zero.
- Do not recompute a historical route with today's address, traffic, provider, or Courier.
- A route map, full GPS trail, and route reconstruction are deferred.
- A textual pickup-area → destination-area summary is sufficient for the MVP.
- No new map SDK, routing provider, email provider, or push service is required.
- Return ISO-8601 UTC timestamps; Flutter renders in the user's locale/timezone.
- Date filters are inclusive from and exclusive to using explicit UTC instants.
- Invalid or reversed time ranges return field validation errors.
- Destination arrival and map route completion never create history entries.

### Pagination and caching

- Proposed pagination uses an opaque cursor, default limit 20, maximum 50.
- Order by delivered_at descending, then task UUID descending.
- The cursor binds the last sort values and normalized filters; it conveys no ownership authority.
- Reapply authorization on every page even when the cursor was issued before an account change.
- Filter by optional from/to UTC timestamp and exact Order reference.
- Reject unsupported filters and limits instead of running unbounded scans.
- Empty successful data is distinct from timeout, database failure, and unavailable routes.
- Responses use Cache-Control: private, no-store.
- Keep only bounded in-memory screen state; persistent offline history is deferred.
- Clear state on logout, account switch, or failed authorization.
- Refresh after successful completion or explicit pull-to-refresh.

### Flutter behavior

- Send Authorization: Bearer from OS secure token storage; never use browser cookies.
- Treat task and related UUIDs as opaque Dart strings.
- Parse nullable distance, duration, and proof reference without inventing defaults.
- Render loading, empty, ready, loading-more, retry, unauthorized, and unavailable states.
- Preserve already loaded rows during a recoverable page failure and identify the failure.
- Clear cached rows when authorization is lost; a stale list cannot grant detail access.
- A 404 detail response shows unavailable without revealing another Courier's task.
- Distinguish unsupported backend feature from an empty successful history.
- Disable pagination while one page is loading and deduplicate rows by task_id.
- Reset cursor and rows whenever a filter changes.
- Use accessible filter labels, touch targets, textual statuses, and readable dates.
- Support screen readers and text scaling without relying on maps or color.
- No camera, microphone, GPS, or photo-storage permission is required for history.
- Offline mode shows unavailable/retry; it cannot create a local delivered entry.
- Preserve original server timestamps in models and localize only for display.

## HOW

### Implemented API contract (bounded MVP)

| Method and path                             | Request                              | Response                              |
| ------------------------------------------- | ------------------------------------ | ------------------------------------- |
| GET /api/v1/courier/delivery-history        | optional `reference`, `limit` (1–50) | Bounded own delivered final-mile rows |
| GET /api/v1/courier/delivery-history/{task} | UUID path; no body                   | Authorized read-only detail           |

- Both routes require active approved Courier bearer access and server-derived organization/hub scope.
- GET is retryable and has no business mutation or idempotency key.
- Query example: `limit=20&reference=ORDER-EXAMPLE`. Cursor/date filters are deferred until the history query contract is expanded.
- reference is an exact Order reference; free-text address/phone search is deferred.
- A cursor with mismatched filters or invalid encoding returns 422.
- Success returns 200; a missing route before implementation is not a successful empty page.

```json
{
  "data": [
    {
      "task_id": "00000000-0000-4000-8000-000000000001",
      "leg": "final_mile",
      "order_reference": "ORDER-EXAMPLE",
      "status": "delivered",
      "delivered_at": "2026-09-11T08:00:00Z",
      "pickup_area": "Makati City",
      "destination_area": "Pasig City",
      "item_count": 2,
      "distance_km": null,
      "estimated_duration_minutes": null,
      "proof_status": "validated"
    }
  ],
  "meta": { "next_cursor": null, "has_more": false }
}
```

- Detail uses data as one object and includes the same fields plus immutable item summaries and safe milestone timestamps.
- Detail may include a nullable evidence_id; it never embeds proof bytes or storage URLs.
- Task/Shipment/Parcel internal references are returned only where needed for authorized navigation.
- The implementation returns the shared task projection; Flutter should treat nullable route metrics and proof references as unavailable unless supplied.

### Errors

| HTTP | Proposed code              | Meaning                                   |
| ---- | -------------------------- | ----------------------------------------- |
| 401  | UNAUTHENTICATED            | Missing/expired bearer token              |
| 403  | COURIER_ACCESS_DENIED      | Account or affiliation no longer eligible |
| 404  | DELIVERY_HISTORY_NOT_FOUND | Missing, foreign, or non-delivered task   |
| 422  | VALIDATION_FAILED          | Invalid cursor, date, reference, or limit |
| 429  | TOO_MANY_REQUESTS          | Respect Retry-After                       |
| 503  | FULFILLMENT_UNAVAILABLE    | Feature/schema unavailable                |

- Use message, code, and optional field errors without private entity details.
- Network/database failure shows retry and never a false “no deliveries” state.
- Published rate limits and supported cursor format must be verified at implementation.

### Records and rollout

- Reuse the shared delivered task/completion records; no duplicate courier_history table.
- Add an index supporting Courier/organization/leg/status/delivered_at/UUID filtering after query review.
- Keep proof/media lookup out of the list query.
- Do not backfill Customer-delivered history from legacy first-mile pickup confirmations.
- Retention deletion/export and former-affiliation access remain deferred; preserve records by default.
- Deploy only after shared migrations, completion ownership, and schema-health checks pass.
- Synchronize Courier Dashboard and Complete Delivery navigation with the implemented route contract.

### Acceptance and tests

- [x] Courier access is scoped by completed assignment and authorized organization/hub.
- [x] Only committed final-mile delivered records appear; first-mile pickup is excluded.
- [x] Stable pagination and filters cannot broaden ownership or duplicate rows.
- [x] Dates, item snapshots, and references survive profile/catalog edits.
- [x] DTOs exclude contact/street details, secrets, raw media paths, and unrelated evidence.
- [x] History has no status or deletion mutation path.
- [x] Errors remain distinguishable from an authoritative empty response.
- [x] SQLite/PostgreSQL schema/query/IDOR tests and Flutter parsing/state tests pass.

- Test non-Courier and same-email-role tokens, suspended users, revoked affiliation, and foreign UUIDs.
- Test identical delivered timestamps, cursor reuse, filter changes, and duplicate proof joins.
- Test missing completion events, legacy pickup rows, null route metrics, and changed address-book data.
- Test completion notification failure does not hide the committed delivery from history.
- Record actual backend commit and test results before copying the implemented contract to Flutter.

### References

- Shared: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/features/shared/shipment-fulfillment/spec.md.
- Roles: docs/domains/Courier.md and docs/domains/Logistics.md.
- Owners: docs/features/courier/complete-delivery/specs.md and docs/features/courier/proof-of-delivery/specs.md.
- Client rules: docs/features/courier/rules.md.
