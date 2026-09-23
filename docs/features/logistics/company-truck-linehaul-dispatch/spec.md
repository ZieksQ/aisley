---
role: Logistics and Courier
feature: Company Truck Linehaul Dispatch
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented
canonical: true
source_issue: https://github.com/ZieksQ/aisley/issues/97
related_issue: https://github.com/ZieksQ/aisley/issues/98
---

# Company Truck Linehaul Dispatch

## Implemented receiving contract

All receiving routes require the existing active Logistics/Sanctum/policy middleware and derive the sole receiving hub from the account. Requests for another hub return scoped 404. Receipt and discrepancy actions remain available after the Linehaul feature or connection is disabled.

| Relative path under `trips/{trip}/receiving` | Body / behavior |
| --- | --- |
| `GET /` | Trip/manifest IDs, arrival/closure metadata, historical flag, expected references with original receipt results, discrepancies and authoritative counts. |
| `POST /start` | `{client_id: UUID}`; record physical arrival and `receiving`/`unloading`, without receiving cargo. Empty returns close immediately. |
| `POST /batches` | `{captures: [...]}` with 1–100 entries: `client_id`, `reference`, `condition: good\|damaged`, `source: barcode\|manual`, ISO `captured_at`, optional `reason` (required for damage; at most 1,000 characters). |
| `POST /finish` | `{client_id, acknowledge_shortages?: boolean, reason?: string}`; missing parcels require acknowledgement and a nonblank reason. All local queued scans must synchronize first. Server locks/recounts before closing. |
| `POST /discrepancies/{id}/resolve` | `{client_id, reason}`; receiving Logistics releases damaged holds or closes unexpected investigations. Missing records require an actual receipt. |

Responses use `{data: ...}` and `private, no-store`. Batch `data.results` contains a result per `client_id` (`received`, `unexpected`, or `failed` with safe code/message), plus `data.receiving` with current counts. Counts are `expected`, `received`, `outstanding`, `damaged` (all damaged receipts, including released ones), and `open_discrepancies`. Receipt results include an immutable receipt ID, original condition/commit time and original custody result; retries must not be interpreted as current onward Shipment state. A duplicate tracking ID returns the first receipt; a different condition on a later duplicate does not overwrite its evidence. Request IDs are unique per actor and fingerprints include trip, operation and payload; changed reuse returns `IDEMPOTENCY_KEY_REUSED` per scan or HTTP 409 for lifecycle actions.

The trip's legacy `received` status/`received_at` now mean unloading closed, while its manifest remains `in_transfer` until every expected parcel has a receipt. `unloading_outcome` is an immutable closure snapshot (`clean` or `discrepancies`); late receipts can resolve shortages without rewriting that snapshot, updating the truck again, or reopening the visit. Damaged and unexpected records resolved before closure still remain in its discrepancy history.

The Logistics production build includes a native service worker caching only public hashed JS/CSS and the SPA shell for trip-specific receiving/reconciliation reloads. It never caches API responses. IndexedDB holds private scoped manifests/captures. A previously authenticated and consent-checked tab may restore minimal session context offline for local capture; all synchronization and lifecycle decisions reauthenticate server-side. Offline reload requires one successful online production load over HTTPS/localhost. Logout clears receipt caches/outboxes and offline identity. Local pending rows remain visible on failure; reconnect, capture, manual sync, and a 15-second retry/refresh synchronize promptly. Physical camera use retains Code 128/waybill QR and manual fallback.

## Parcel receiving and reconciliation — 2026-09-23

This revision supersedes whole-manifest atomic receipt for company-truck cargo. Departure membership remains immutable and atomic. Arrival, individual parcel custody, and unloading closure are separate events.

- Inbound linehaul starts receiving online: record arrival/actor and mark trip `receiving`, truck `unloading`. The truck and driver remain reserved until unloading closes.
- Receive at hub selects the trip/manifest, caches expected references, and queues scans isolated by account, organization, hub, and trip. Local capture never implies server receipt. Synchronize promptly on capture/reconnect; starting and closing require connectivity.
- Each expected tracking ID commits independently under hub/trip/Shipment/hop locks: custody moves to the receiving hub, hop arrives, reservation releases, and Shipment becomes `received_at_hub`. Only a final destination with all hops arrived completes its route. Matching request retries and duplicate scans return original receipts even after onward movement; changed payload reuse conflicts.
- Received parcels can enter the existing 100-item Sorting snapshot while unloading continues. Later receipts wait for the next session. Damaged receipts have a condition hold; no sorting or dispatch until receiving Logistics explicitly records inspection/release reason.
- Unexpected scans create investigation records without changing custody or membership or revealing foreign parcel details. Missing parcels stay unreceived. Closing with shortages requires explicit acknowledgement and reason against authoritative outstanding counts.
- Closure records clean/discrepancy outcome, actor/time and audit history, notifies the sender of discrepancies, and frees the truck for its normal cargo/empty return. Valid late receipts resolve shortages without reopening the truck visit. Unexpected records require a documented disposition; shortages resolve only by receipt.
- Trip-scoped API: `GET receiving`, `POST receiving/start`, `POST receiving/batches`, `POST receiving/finish`, `POST receiving/discrepancies/{discrepancy}/resolve` below `/api/v1/logistics/linehaul/trips/{trip}`. Batches return individual results and server counts. Mutation identities and original results persist.
- Old cargo trip/manifest receipt endpoints cannot bypass scans. Historical completed receipts retain their original evidence, standalone historical manifests remain receivable, shutdown does not block receipt, and empty returns need only arrival confirmation.
- V1 uses Logistics account decisions and text reasons. Photos, claims/refunds, loss declarations, containers, and combined receiving/sorting are deferred.

Verification requires complete/partial/damaged/unexpected loads, wrong hubs, retries, account isolation, offline reload/reconnect, independent concurrent scanners and closure on PostgreSQL, late receipt after return, session snapshots, cargo/empty returns, and historical compatibility. Browser and physical-device verification must be reported separately from automated checks.

## WHAT

Implement [GitHub issue #97](https://github.com/ZieksQ/aisley/issues/97): Logistics-owned company trucks, qualified truck drivers, destination approval, capacity-based linehaul reservations, physical departure/receipt, and a scheduled return to the owning hub. [Issue #98](https://github.com/ZieksQ/aisley/issues/98) is context only: this feature uses `company_trucks.max_parcels`; it does not add personal-Courier-vehicle capacity or replace the existing 15-parcel final-mile bound.

The owner and home hub never change. Confirmed operational events, not GPS, determine whether a truck is available, reserved, in transit, or visiting another hub. Company trucks are separate from the Courier's one personal `vehicles` row. An eligible driver keeps the original affiliation and does not need a personally owned truck.

## MUST

- Outbound A → B scheduling selects one active A-owned company truck, one active approved A-affiliated Courier with `can_drive_company_truck`, a future departure, and one or more operator-selected eligible sorted parcels whose immediate next hub is B.
- Accepted active routing connections must exist in both directions. Connection consent and transfer-request acceptance are separate checks.
- B must accept the outbound request before A may confirm physical departure. Rejection or pre-departure cancellation retains custody at A and releases the truck, driver, and parcel reservations.
- The selected truck's positive integer `max_parcels` is the limit. Count Shipment/Parcel records, allow explicit selection across different active standard lane groups only when the immediate destination hub is identical, and leave unselected parcels ready. The route owns the destination; a parcel staged under an earlier still-active standard lane remains eligible after a plan revision.
- The outbound page lists eligible parcels by lane, supports an all-lanes or one-lane-group dropdown, per-lane and visible-list select-all actions, and individual parcel selection. Selecting the first parcel locks compatibility to its immediate destination until that selection is cleared.
- Reservation, revalidation, manifest creation, and custody writes use transactions and row locks. Membership is frozen at commit, and the manifest stores the truck-trip audit relationship through `linehaul_trips.linehaul_manifest_id`.
- B closes unloading after individual receipt and discrepancy reconciliation. The truck becomes a visiting A-owned asset at B; B sees only the visitor fields needed to return it.
- Only B may schedule the received visitor B → A. The return is immediately `scheduled`, requires no second approval by A, B, or the Courier, and notifies A and the driver. B cannot choose C or local/final-mile work.
- A return may reserve same-next-hub cargo up to the capacity snapshot or be explicitly empty. Empty returns create no parcel manifest.
- B confirms physical return departure and A confirms receipt. Receipt closes the visit and restores the truck to available at its confirmed home hub.
- Legacy immediate manifest and standalone transfer-departure entry points reject new departures with `LINEHAUL_TRIP_REQUIRED`; already-departed historical manifests remain receivable.
- Pickup/final-mile work and active linehaul work block conflicting driver assignment. Active linehaul work also blocks reuse of the truck and removal of driver capability.
- Fleet APIs and UI allow the owning Logistics tenant to register, edit, activate/deactivate, view, and monitor trucks, capacities, confirmed locations, active driver/trip/load, remaining capacity, and trip history.
- Courier API exposes only that Courier's linehaul trips. Courier production UI remains external/mobile-only.

## API and pages

- Fleet: `GET /api/v1/logistics/fleet`, `POST /fleet/trucks`, `PATCH /fleet/trucks/{truck}`, and `PATCH /fleet/drivers/{courier}`; protected Logistics page `/fleet`.
- Trips: `GET/POST /api/v1/logistics/linehaul/trips`, plus scoped `decision`, `cancel`, `depart`, `receive`, and `return` actions with revision checks. `POST` requires the exact selected `shipment_ids`; the API revalidates their tenant, custody, route destination, lane, reservation, and truck capacity under locks.
- Outbound company-truck work has a separate protected `/linehaul-dispatch` page. `/dispatch` is last-mile only, and `/inbound-linehaul` remains dedicated to approvals, receipts, and visiting-truck returns. Linehaul dispatch and Inbound linehaul carry Beta sidebar tags.
- Inbound: protected `/inbound-linehaul` page for request decisions, physical receipts, and visiting-truck return scheduling.
- Courier: `GET /api/v1/courier/linehaul-trips` and `courier-linehaul.trip-scheduled` return notification.
- The personal Courier vehicle registry accepts `truck` as a supported type but remains a separate asset model and is never eligible as a company linehaul truck.

## Acceptance criteria

- [x] A cannot depart until B accepts A's outbound request.
- [x] After B closes unloading, B can schedule B → A with no further acceptance step.
- [x] B → C, local last-mile assignment, and scheduling an absent visitor are rejected by server-derived return endpoints and resource/work checks.
- [x] Logistics can manage and monitor its own company trucks; ownership never transfers to B.
- [x] Non-company trucks and unqualified drivers cannot perform transfers through any API path.
- [x] Exact-capacity loads succeed; overflow remains ready; transactional hub/resource locks prevent overfill and double-booking.
- [x] Operators can select individual parcels or whole lane groups across multiple lanes for one immediate destination; mixed-destination and over-capacity requests are blocked server-side.
- [x] Rejection, cancellation, empty returns, and matching retries preserve custody and release resources correctly.
- [x] A/B/C tenant isolation, historical manifest receipt compatibility, and unchanged 15-parcel last-mile behavior are covered by scoped APIs and regressions.

## Verification evidence

- `CompanyTruckLinehaulTest` covers exact capacity, overflow, cross-lane explicit selection, destination approval, physical departure/receipt, ownership at a visiting hub, empty return, tenant isolation, unqualified-driver rejection, and reservation release.
- `LinehaulTest` covers new trip-backed manifests plus historical receipt behavior and rejects legacy departure bypasses.
- The company-truck migration applies successfully on PostgreSQL with its self-referencing return-trip foreign key added only after the trip table's primary key exists.
- Development seeders qualify the configured lead Courier and the first generic Courier, plus one deterministic Courier in each Luzon Logistics organization, without repeatedly advancing capability revisions.
- Logistics type-check, lint, and production build verify the three protected operational surfaces. Browser/device checks and PostgreSQL worker-level concurrency remain release gates when not recorded in `docs/PROGRESS.md`.
