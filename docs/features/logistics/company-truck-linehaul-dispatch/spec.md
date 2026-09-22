---
role: Logistics and Courier
feature: Company Truck Linehaul Dispatch
system: AISLEY
type: Feature Specification
version: 1.1
status: Implemented
canonical: true
source_issue: https://github.com/ZieksQ/aisley/issues/97
related_issue: https://github.com/ZieksQ/aisley/issues/98
---

# Company Truck Linehaul Dispatch

## WHAT

Implement [GitHub issue #97](https://github.com/ZieksQ/aisley/issues/97): Logistics-owned company trucks, qualified truck drivers, destination approval, capacity-based linehaul reservations, physical departure/receipt, and a scheduled return to the owning hub. [Issue #98](https://github.com/ZieksQ/aisley/issues/98) is context only: this feature uses `company_trucks.max_parcels`; it does not add personal-Courier-vehicle capacity or replace the existing 15-parcel final-mile bound.

The owner and home hub never change. Confirmed operational events, not GPS, determine whether a truck is available, reserved, in transit, or visiting another hub. Company trucks are separate from the Courier's one personal `vehicles` row. An eligible driver keeps the original affiliation and does not need a personally owned truck.

## MUST

- Outbound A → B scheduling selects one active A-owned company truck, one active approved A-affiliated Courier with `can_drive_company_truck`, a future departure, and a server-owned deterministic subset of sorted parcels whose immediate next hub is B.
- Accepted active routing connections must exist in both directions. Connection consent and transfer-request acceptance are separate checks.
- B must accept the outbound request before A may confirm physical departure. Rejection or pre-departure cancellation retains custody at A and releases the truck, driver, and parcel reservations.
- The selected truck's positive integer `max_parcels` is the limit. Count Shipment/Parcel records, select oldest receipt then stable Shipment ID, allow different physical lanes when the immediate destination hub is identical, and leave overflow ready.
- Reservation, revalidation, manifest creation, and custody writes use transactions and row locks. Membership is frozen at commit, and the manifest stores the truck-trip audit relationship through `linehaul_trips.linehaul_manifest_id`.
- B confirms the whole manifest receipt. The truck becomes a visiting A-owned asset at B; B sees only the visitor fields needed to return it.
- Only B may schedule the received visitor B → A. The return is immediately `scheduled`, requires no second approval by A, B, or the Courier, and notifies A and the driver. B cannot choose C or local/final-mile work.
- A return may reserve same-next-hub cargo up to the capacity snapshot or be explicitly empty. Empty returns create no parcel manifest.
- B confirms physical return departure and A confirms receipt. Receipt closes the visit and restores the truck to available at its confirmed home hub.
- Legacy immediate manifest and standalone transfer-departure entry points reject new departures with `LINEHAUL_TRIP_REQUIRED`; already-departed historical manifests remain receivable.
- Pickup/final-mile work and active linehaul work block conflicting driver assignment. Active linehaul work also blocks reuse of the truck and removal of driver capability.
- Fleet APIs and UI allow the owning Logistics tenant to register, edit, activate/deactivate, view, and monitor trucks, capacities, confirmed locations, active driver/trip/load, remaining capacity, and trip history.
- Courier API exposes only that Courier's linehaul trips. Courier production UI remains external/mobile-only.

## API and pages

- Fleet: `GET /api/v1/logistics/fleet`, `POST /fleet/trucks`, `PATCH /fleet/trucks/{truck}`, and `PATCH /fleet/drivers/{courier}`; protected Logistics page `/fleet`.
- Trips: `GET/POST /api/v1/logistics/linehaul/trips`, plus scoped `decision`, `cancel`, `depart`, `receive`, and `return` actions with revision checks. Dispatch embeds the outbound scheduler at `/dispatch`.
- Inbound: protected `/inbound-linehaul` page for request decisions, physical receipts, and visiting-truck return scheduling.
- Courier: `GET /api/v1/courier/linehaul-trips` and `courier-linehaul.trip-scheduled` return notification.
- The personal Courier vehicle registry accepts `truck` as a supported type but remains a separate asset model and is never eligible as a company linehaul truck.

## Acceptance criteria

- [x] A cannot depart until B accepts A's outbound request.
- [x] After B confirms arrival, B can schedule B → A with no further acceptance step.
- [x] B → C, local last-mile assignment, and scheduling an absent visitor are rejected by server-derived return endpoints and resource/work checks.
- [x] Logistics can manage and monitor its own company trucks; ownership never transfers to B.
- [x] Non-company trucks and unqualified drivers cannot perform transfers through any API path.
- [x] Exact-capacity loads succeed; overflow remains ready; transactional hub/resource locks prevent overfill and double-booking.
- [x] Rejection, cancellation, empty returns, and matching retries preserve custody and release resources correctly.
- [x] A/B/C tenant isolation, historical manifest receipt compatibility, and unchanged 15-parcel last-mile behavior are covered by scoped APIs and regressions.

## Verification evidence

- `CompanyTruckLinehaulTest` covers exact capacity, overflow, destination approval, physical departure/receipt, ownership at a visiting hub, empty return, tenant isolation, unqualified-driver rejection, and reservation release.
- `LinehaulTest` covers new trip-backed manifests plus historical receipt behavior and rejects legacy departure bypasses.
- The company-truck migration applies successfully on PostgreSQL with its self-referencing return-trip foreign key added only after the trip table's primary key exists.
- Development seeders qualify the configured lead Courier and the first generic Courier, plus one deterministic Courier in each Luzon Logistics organization, without repeatedly advancing capability revisions.
- Logistics type-check, lint, and production build verify the three protected operational surfaces. Browser/device checks and PostgreSQL worker-level concurrency remain release gates when not recorded in `docs/PROGRESS.md`.
