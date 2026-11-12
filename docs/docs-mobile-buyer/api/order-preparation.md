# Seller preparation — order-preparation-v1 (2026-11-12)

Laravel owns this policy for Customer web sessions and Buyer scoped bearer tokens. The Buyer client adopts it locally; deployed API and installed Android acceptance remain open. This extends cancellation eligibility, never address modification or operational authority.

## Rules and projection

Seller acceptance (`placed → seller_processing`, source `seller_order_acceptance`) starts 72 elapsed hours. `ready_for_pickup` completes preparation; Logistics waiting time is excluded. At `now >= deadline`, the owner can cancel or approve one extra 72-hour window beginning at approval. During that extension cancellation is unavailable. On its expiry only cancellation remains. Nothing cancels automatically. Late readiness may succeed until cancellation commits.

Existing Orders use original acceptance history independently of the paginated timeline. Missing acceptance evidence disables deadline actions. Pending-COD, intact item/address snapshots and no pickup/waybill/parcel/first-mile-task remain prerequisites. Server inventory validation is authoritative.

Order detail/list and mutation results add `preparation`:

| Field | Type | Meaning |
| --- | --- | --- |
| `acceptedAt` | timestamp or null | Original Seller acceptance |
| `initialDeadlineAt` | timestamp or null | Acceptance plus 72 hours |
| `deadlineAt` | timestamp or null | Current initial/extended deadline |
| `extendedAt` | timestamp or null | Buyer extension approval |
| `extensionUsed` | bool | One extension already committed |
| `active` | bool | Still preparing with known acceptance |
| `overdue` | bool | Active and current deadline reached |
| `serverTime` | timestamp | Server projection time |

`actions.canExtendPreparation` is a server boolean. `actions.canCancel` includes eligible overdue processing Orders. `canModify` and `modifiableFields` retain placed-only behavior. Older responses may omit preparation and extension capability; hide extension safely. Present wrong types fail decoding. UTC timestamps display in local time; clients refetch at expiry and resume rather than granting permissions from device time.

## Approve extension

`POST /api/v1/customer/orders/{order}/preparation-extension`

- Active approved Customer + current consent, `auth:sanctum`, owned UUID Order. Web uses cookies/CSRF; mobile uses its Customer bearer.
- UUID `Idempotency-Key`, JSON `{}` only; no submitted duration, deadline, owner or status.
- `200 {data:Order}`, `Cache-Control: no-store, private`.
- `401` unauthenticated; `403` role/account/consent denial; `404` unknown/foreign Order; `422` invalid/missing key or unexpected field; `409 ORDER_PREPARATION_NOT_EXTENDABLE` for unavailable/already-used extension; `409 IDEMPOTENCY_KEY_REUSED` for another Order using this Customer's key.
- Persist one extension, approval/deadline and immutable `preparation_extended` timeline event. Status/payment/stock do not change. Do not send another Seller-acceptance notification.
- Exact key replay returns the current Order, including later readiness/cancellation, without resetting the deadline. Freeze key and empty payload across uncertainty/navigation. No blind new-key retries or offline writes. Clear private state after identity loss; retain consent-gated unresolved requests for the same verified session.

## Cancellation and races

The existing `POST /customer/orders/{order}/cancel` (under `/api/v1`) accepts eligible placed Orders or overdue processing Orders. Its optional reason and replay rules are unchanged. Cancellation/extension/readiness recheck state under the same Order lock; incompatible transactions cannot both win. Cancellation releases only reserved quantities once. A cancelled Order invalidates a whole bulk pickup request with no partial readiness/waybill effects.

## Clients and rollout

Order detail presents the local deadline and explanatory state, **Extend preparation by 3 days**, cancellation when allowed, and explicit one-time-extension confirmation. Refresh stale reads; block competing actions during unresolved writes and support exact retry. Missing/used capabilities hide extension. One extension does not promise physical shipment/delivery timing.

Deploy the new extension-table migration before clients. No automatic expiry worker, status enum, dependency or Courier contract is introduced. Local tests/builds do not certify deployed commerce or installed-device accessibility.

[Local verification](../references/order-preparation-verification.md) records server races, Customer browser checks and 59 Buyer tests; deployed/device acceptance remains open.
