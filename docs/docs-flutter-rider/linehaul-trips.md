# Courier linehaul operations — API contract v1

Added 2026-10-22 in Laravel and its development-only React harness. This document supplies the external Flutter contract; Flutter linehaul screens, hub-route presentation, and driver confirmations are implemented locally against platform `1858785e`; deployed API and installed-device acceptance remain unverified.

## Sequence and authority

Destination Logistics approves the outbound transfer. Origin Logistics confirms the load is ready with a source-only **Release to driver** action. The assigned Courier confirms actual departure, then reports arrival at the destination. Logistics independently starts receiving, scans/reconciles parcels and closes unloading. Return cargo and empty returns follow the same sequence; only receiving Logistics frees the truck. The scheduled departure is a plan, not an automatic event or a restriction on early/late departure.

## Courier endpoints

| Method/path under `/api/v1/courier` | Behavior |
| --- | --- |
| `GET /linehaul-trips` | Up to 50 newest assigned trips in `{data: [...]}` |
| `GET /linehaul-trips/{trip}/route` | Advisory saved-hub road route; see [map DTO](courier-route-maps.md#additive-linehaul-route-contract--2026-10-21) |
| `POST /linehaul-trips/{trip}/depart` | Commit source-authorized cargo/truck departure; record actual `departed_by` Courier |
| `POST /linehaul-trips/{trip}/arrival` | Record the driver's arrival report; keep trip `in_transfer` and all parcel/truck custody unchanged |

All require Sanctum bearer authentication, active Courier/approved affiliation/active organization and current policy consent. Resolve driver/ownership from authentication; never send Courier, organization, hub, owner or target-status fields. Unknown/foreign trips return `404 LINEHAUL_TRIP_NOT_FOUND` even on retries. Never call Logistics endpoints from the Courier client.

Both POSTs accept exactly `{"expected_revision": 3, "confirmation": true}` and reject extra fields with 422. Require explicit physical-event confirmation; do not infer departure/arrival from GPS, time, map navigation or button visibility. Each POST is limited to 30/minute. No Idempotency-Key is required. Responses are `200 {data: trip}` with private/no-store headers. Replace local state with the authoritative returned trip.

## Additive trip fields

- `revision`: positive integer used for the next action.
- `released_for_departure_at`, `released_for_departure_by`: nullable source release time/Logistics User UUID.
- `departed_by`: nullable actual initiating User UUID (Courier for driver departure; Logistics for the operational fallback).
- `courier_arrived_at`, `courier_arrived_by`: nullable server-recorded driver report time/Courier UUID.
- `courier_can_depart`, `courier_can_report_arrival`: booleans for presentation. Server checks remain authoritative.

Timestamps are ISO-8601 strings or null. Old nullable evidence remains null; do not invent historical actors/events. Existing statuses stay `pending_acceptance`, `scheduled`, `rejected`, `cancelled`, `in_transfer`, `receiving`, `received`. Show **Arrival reported** from `courier_arrived_at` without inventing a new API status. Existing `arrived_at` remains receiving Logistics' independently confirmed arrival, not the driver report. `received` means unloading closed; parcel reconciliation still follows the receiving contract.

Show **Depart** for a released scheduled trip with `courier_can_depart`. Show **Arrived at hub** only for `courier_can_report_arrival`. Disable double submits and unrelated job switches while saving. After driver arrival, show the report timestamp and wait for Logistics. Route/provider failures must not block these buttons. No Courier transfer-acceptance, parcel-receipt, delivered or unloading-close action is introduced.

## Conflicts, replay and failure recovery

- First commits require matching `expected_revision`. Stale revisions/invalid transitions return `409 LINEHAUL_TRIP_CHANGED`; refresh before a new decision.
- Unreleased departure returns `409 LINEHAUL_RELEASE_REQUIRED`; unavailable source release authority returns `409 LINEHAUL_RELEASE_INVALID`. Origin Logistics must resolve these conditions.
- Departure rechecks the feature, accepted connections, qualified driver, truck capacity, reserved memberships and open sorting lanes under network/source-hub/trip/resource locks. Existing lane/capacity/driver/connection error codes remain valid. Courier arrival reporting remains available after feature/connection shutdown.
- Once departure exists, repeating departure returns the latest projection without another manifest or timestamp write, including after receiving/closure. Arrival repeats after that driver's report also preserve the original timestamp. A first arrival report after Logistics already started receiving is rejected; Logistics evidence remains authoritative.
- Preserve the same action/body after an uncertain timeout/5xx; explicitly retry or refresh to reconcile. Replays are state-idempotent current projections, not byte-identical historical receipts. Never queue mutations offline or automatically advance to the next action after an uncertain result.
- `401` clears the mobile session; `403` follows role/approval/consent denial. `429` honors Retry-After. Network/5xx failures are recoverable, not empty jobs or proof that a write failed. Clear private snapshots on logout/account switch.

Source authorization and the actual driver are separate audit facts: cargo events use the stored releasing Logistics authorizer, while the trip records the Courier who confirmed physical departure. Driver arrival never receives parcels, completes route hops, releases reservations, changes the confirmed truck location or makes the truck available.

## Verification boundary

Laravel and mockup checks belong to the platform progress log. Flutter must implement its own repository/DTO/controller/screens and verify confirmation, conflict/uncertain-response recovery, ownership/privacy, returned state, map fallback and installed-device accessibility. Documentation delivery does not establish Flutter adoption or live/deployed/PostgreSQL acceptance.
