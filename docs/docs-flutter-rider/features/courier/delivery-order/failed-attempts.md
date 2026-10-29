# Courier failed-attempt reporting (G29)

Contract checked against Laravel `4d8bfefa2a95007256e6616df415fa186d1b18eb` on 2026-10-11. The existing API, schema and dependencies are unchanged. Flutter submission, recovery and proof freshness are implemented locally; deployed API and installed-device acceptance remain separate gates.

**Direct final-mile delivery revision — 2026-10-23 (`courier-direct-delivery-v2`):** Courier accepts a parcel, then submits private photo POD and the linked **Delivered** intent directly to Logistics Delivery confirmations. Hub pickup validation and transit actions are optional compatibility steps, not prerequisites. Existing `delivery_accepted`, `picked_up_from_hub`, `in_transit`, and `out_for_delivery` tasks are eligible. Submission preserves task/Shipment/Order/payment state; only the existing Logistics approval policy commits delivered. Skipped pickup/transit timestamps and evidence are not fabricated. Flutter adopts this revision locally; deployed API and physical-device acceptance remain open.

## Request and authority

`POST /api/v1/courier/final-mile-tasks/{task}/failed-attempts` accepts JSON with a UUID `Idempotency-Key` header and `Authorization: Bearer <token>`. Sanctum, active Courier/approved affiliation and policy consent gates apply. Ownership, final-mile leg, organization and hub are server-derived.

```json
{"reason":"recipient_unavailable","note":null,"expected_revision":7}
```

- `reason` is required: `recipient_unavailable`, `address_unreachable`, `recipient_refused`, or `other`.
- `note` is nullable, at most 500 characters; Other requires a nonblank description. The API trims stored notes and represents an empty note as null.
- `expected_revision` is an integer at least 1 from the current authorized task.
- All other body fields are rejected; do not send actor, status, amount, location, or timestamp fields.
- New attempts require an accepted final-mile state (`delivery_accepted`, `picked_up_from_hub`, `in_transit`, or `out_for_delivery`) and no awaiting-validation completion intent. They do not change custody, revision, Order/payment state or assignment.
- The route has no dedicated numeric throttle override in inspected source. Honor any returned `429`/`Retry-After` rather than assuming a client quota.

## Acknowledgment and private reads

New attempts and matching replays return **201**, `Cache-Control: private, no-store`:

```json
{"data":{"id":"attempt-uuid","task_id":"task-uuid","reason":"recipient_unavailable","note":null,"attempted_at":"2026-10-11T09:00:00Z","retry_allowed":true}}
```

`attempted_at` is server time. `retry_allowed` permits a later delivery attempt, not a custody transition or a promise of completion eligibility.

`GET /api/v1/courier/tasks/{task}/delivery` and final-mile task projections include:

```json
{"data":{"task_id":"task-uuid","status":"out_for_delivery","revision":7,"failed_attempt_count":1,"failed_attempts":[{"id":"attempt-uuid","reason":"recipient_unavailable","note":null,"attempted_at":"2026-10-11T09:00:00Z"}]}}
```

The total count includes all recorded attempts; history contains at most ten rows ordered by descending `attempted_at`, without a paging cursor. Flutter shows server order and a latest-attempts label when the count exceeds returned rows. Unknown future read-only reasons use a safe generic label; submissions still use the four supported reasons. Notes remain plain text and private account-scoped memory.

`GET /api/v1/courier/tasks/{task}/completion` adds nullable `proof_failed_attempt_count`, the attempt count captured when its photo was submitted. Missing/null counts are unknown, not zero. POST completion acknowledgment does not provide this freshness field; refresh GET before relying on it.

## Flutter workflow and retries

- The authorized out-for-delivery task offers secondary **Report failed attempt**. A separate Material form has one primary **Submit report**, four familiar reason choices, a bounded note, and Cancel/Back with unsent-draft discard confirmation.
- Immediately before a new request, reread delivery context and completion. Require matching identity/revision, out-for-delivery state and no pending completion review.
- Freeze task, reason, normalized note, revision and UUID before POST. Disable duplicate taps and competing proof/movement/completion actions while reporting or uncertain.
- Offline, timeout, `5xx`, malformed acknowledgment and `429` keep the original attempt for explicit **Retry same report**. Reuse the same body and header even after the revision advances; never queue offline writes or silently create a new request for the visit.
- Retain uncertain attempts across screen navigation in authenticated memory. Returning to delivery does not cancel a pending report. Restart loses the retry key: reauthorize, inspect server history and confirm whether the visit is already recorded before starting another report. No cross-restart persistence or automatic replay is implemented.
- A confirmed 201 shows **Failed attempt recorded**, then refreshes task/history/completion. A failed follow-up read does not turn a confirmed write into an uncertain one or enable resubmission.
- A failed attempt invalidates earlier photo proof. Compare current count with the completion GET's matching-photo count; stale or unknown freshness blocks Delivered intent. A new visit needs a new photo. This check also applies after reopening the app.
- Successful fresh-photo upload rereads context/completion before enabling intent. Counts cannot authorize delivery; Logistics/server validation remains authoritative.
- Clear private report/history/photo state on logout, account denial, task removal or authorization loss. Policy consent hides the form and preserves an uncertain report for exact retry after consent and fresh reads. Discard obsolete replies after cleanup/disposal.

## Errors

| Result | Flutter recovery |
| --- | --- |
| `401` | End the session and clear private state. |
| `403` | Handle approval/affiliation/access denial; policy-required responses preserve the uncertain request behind consent recovery. |
| `404` | Stop exposing the unavailable task and clear its pending private report. |
| `409 TASK_STATE_CONFLICT` | Refresh and review changed task state before creating another attempt. |
| `409 COMPLETION_PENDING` | Refresh completion; reporting stays unavailable during review. |
| `409 IDEMPOTENCY_KEY_REUSED` | Preserve the frozen request, block further reporting and ask Logistics for help; never regenerate the key automatically. |
| `422` | Show safe field-adjacent reason/note feedback; permit correction of the rejected request. |
| `429` | Preserve request/key and wait for the server's delta-seconds or HTTP-date cooldown. |
| Offline/timeout/`5xx`/malformed success | Show unconfirmed state and explicit exact retry. |

## Verification boundaries

Repository/DTO, controller, form and accessibility tests use synthetic data. Existing Laravel failed-attempt/delivery tests establish local backend behavior. Full Flutter tests, analyzer/build results and browser evidence are recorded separately in the progress log; production deployment, real-account visits, installed APK and TalkBack are not established by these checks.

See [delivery](specs.md), [photo proof](../proof-of-delivery/specs.md), and [completion](../complete-delivery/specs.md).
