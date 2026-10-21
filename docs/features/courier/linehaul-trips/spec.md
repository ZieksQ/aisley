# Courier linehaul trip operations

Contract v1 — 2026-10-22. Laravel owns these actions; the development Courier mockup consumes them. Production Flutter adoption remains open.

## Workflow and authority

The scheduled time is a plan, never an automatic departure gate or status transition. Destination Logistics approves the transfer. Origin Logistics explicitly releases the loaded truck to its assigned driver. The driver confirms actual departure, then reports arrival. Receiving Logistics independently starts receiving, scans/reconciles parcels and closes unloading. Return cargo and empty returns use the same release/depart/arrival sequence; an empty truck is freed only by receiving Logistics.

- Origin `POST /api/v1/logistics/linehaul/trips/{trip}/release`: confirm the approved load is ready. This does not move custody, create a manifest, start transit or free reservations. The same revalidation used by departure checks the feature, connections, qualified driver, truck capacity, frozen memberships and open lanes. Source-only, revision checked; returns the current source trip projection.
- Courier `POST /api/v1/courier/linehaul-trips/{trip}/depart`: only the assigned authenticated driver, after release. Recheck source release authority, active source organization, destination approval, feature/connections, driver/truck/member/lane state under the existing network → source hub → trip/resource locks. Atomically commit the existing manifest and custody departure using the recorded source release authorization, and record the actual initiating Courier in `departed_by`. Source-authorized parcel events retain their Logistics authorizer. No client-supplied actor or hub is trusted.
- Courier `POST /api/v1/courier/linehaul-trips/{trip}/arrival`: record `courier_arrived_at`/`courier_arrived_by` once, only after departure. This is a driver report: status remains `in_transfer` until receiving Logistics acts. Do not write Logistics `arrived_at`, receive parcels, complete route hops, move custody, release reservations or change/free the truck. Reports remain possible after the feature or connection is disabled.
- Existing Logistics departure remains an authorized operational fallback and records `departed_by`; it does not require a separate release. It cannot race a Courier into creating a duplicate manifest. Logistics approval, cancellation, return scheduling and receiving retain their roles.

## Requests and response

All three POSTs require `{expected_revision: positive integer, confirmation: true}` as JSON, without an Idempotency-Key. Other fields are rejected with 422. Courier routes require Sanctum bearer authentication, active Courier/approved affiliation/active organization and current policy consent. Logistics release uses the existing stateful Sanctum/active Logistics/consent middleware. Each new route is limited to 30/minute. Responses are `200 {data: trip}` and private/no-store.

Courier foreign/unknown trips are scoped `404 LINEHAUL_TRIP_NOT_FOUND`. Stale revisions/invalid transitions are `409 LINEHAUL_TRIP_CHANGED`; missing source release is `409 LINEHAUL_RELEASE_REQUIRED`; unavailable release authority is `409 LINEHAUL_RELEASE_INVALID`. Existing lane/capacity/driver/feature/connection errors retain their codes. 401/403/429 use normal authentication, role/approval/consent and Retry-After behavior.

Actions are state-idempotent: release repeats while still scheduled, departure repeats once actual departure exists (including after receiving/closure), and arrival repeats after that driver's report. Replays return the latest authoritative projection without rewriting timestamps or producing duplicate side effects. Before first commit, expected_revision must match; after an uncertain network response retry the same action/body, or refresh before making another decision. A fresh arrival report after receiving has already started is rejected; the existing receiving timestamps remain authoritative. Authorization is rechecked on every retry.

Trip reads and mutation responses add nullable `released_for_departure_at`, `released_for_departure_by`, `departed_by`, `courier_arrived_at`, `courier_arrived_by`, plus `can_release` for source Logistics. Courier-owned projections additionally provide `courier_can_depart` and `courier_can_report_arrival`. These booleans are display hints; mutation checks are authoritative. No new trip status value is introduced. Legacy nullable evidence remains null; no historical actor/time is fabricated.

## Mockup and operational UI

The source Logistics outbound/return trip controls expose **Release to driver** with explicit physical-load confirmation; keep the existing departure fallback. Show **Released to driver**, actual departure and Courier arrival report timestamps in context. Destination Logistics can see the arrival report while receipt is pending.

The Courier job shows **Depart** only for the server-authorized released/scheduled job and **Arrived at hub** only while in transfer before a driver arrival report. Require an explicit physical-event confirmation for each. Disable duplicate submissions and job switching while saving, replace the selected trip with the mutation response, and show success/error feedback. Conflict/auth failures require refresh before another mutation. An uncertain network response retains the same action/revision for an explicit retry. Map or provider failures must not disable operational actions. Keep the route map and its existing privacy/fallback contract.

## Verification

Verify origin/destination/driver isolation; active-role/affiliation/consent gates; missing release; pre-approval and stale revision rejection; open/held lanes and changed capacity/memberships; early/late departure relative to the plan; exact retries and no duplicate manifests; source-authorizer versus actual-driver evidence; return/empty-return trips; driver arrival without custody/truck release; and the unchanged Logistics receipt lifecycle. Check mockup confirmation, retry/conflict recovery, duplicate-submit prevention, status-driven controls, responsive layouts and maps with synthetic browser transport. Report SQLite/browser, live PostgreSQL/concurrency, provider and physical-device evidence separately.
