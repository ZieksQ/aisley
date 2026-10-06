# Sort-plan versions, lane controls, and exception recovery

Implemented contract revision: 2026-10-06. This revision supersedes mutable active-plan, manual exception override, and exception-blocked session closure wording in the original Sorting and lane-aware dispatch specs. The shared [web design contract](../../../design.md) continues to govern Logistics presentation.

## Sort plan UI revision — 2026-10-07

- Sort plan shows the existing lane Activate/Deactivate action. Remove Open/Resume/Paused/Held controls from this web workspace. Historical operational metadata and API/dispatch compatibility remain preserved; this UI revision does not relax lane-in-use or protected-exception-lane checks.
- Keep destination-aware lane changes: postal mappings use the immutable recipient postal code; transfer mappings require the committed next hub and an active accepted connection. A lane change such as lane 2 → lane 5 applies through a new published selection to future scans. Existing assignments, waybills, postal destinations and committed hops retain their original evidence.
- Every plan row has a keyboard-accessible vertical three-dot actions menu with a copy icon and **Duplicate plan** text. Confirm copying in a centered modal before sending any mutation. There is no duplicate-name input.
- The plan-list copy action copies the latest published version, or the draft when none exists, into an independent inactive draft with new mapping identities and shared physical lanes. The API assigns `Name (1)`, `Name (2)`, etc., incrementing existing suffixes within the same hub, including archived names; copying a numbered copy increments the original base name. Names remain within 80 characters. Number allocation is serialized under the hub lock. A legacy explicit `name` remains accepted for API compatibility.
- **Published versions** opens a separate viewport-bounded browser with its own search by version number, snapshot name or publication date. Plan search belongs to the right-side plan list. Version selection uses a visible list, with activation, successor creation and one-time scheduling beside the selected snapshot.
- Preserved destinations and mapping differences are visible sections/tables. Do not use a dropdown, disclosure, accordion, `<details>` or `<summary>` to hide these sections. Contain table scrolling and keep the Logistics palette, light/dark themes and compact controls.
- Success messages include an accessible X control and dismiss after five seconds. Validation, activation failures and uncertain-request recovery stay visible where corrective action is required. Copy retries preserve the original payload and UUID; prevent closing or switching away from an uncertain copy.

## Plans and publication

- A named plan owns editable draft mapping rows and numbered immutable `sorting_plan_versions`. `revision` is only an optimistic concurrency counter; version numbers increase independently per plan.
- New plans are inactive drafts. Legacy `is_active` on creation no longer activates unpublished content. Published mapping/name snapshots never change; database triggers and the API model reject version updates/deletes.
- Draft edits mark unpublished changes, leaving the active version untouched. Explicit successor creation copies any selected published version into the editable draft, and requires no unfinished draft. Publishing preserves its name, mappings, actor/time and mapping differences.
- Duplicate a selected published version (or an unpublished draft) into an automatically numbered independent draft with new mapping identities and shared physical lane IDs. Editing the duplicate cannot change its source.
- Publish alone, publish and activate immediately, or publish and schedule one future activation. Existing published versions may also be activated or scheduled. One-time scheduling only; no recurring shifts.
- `scheduled_for` accepts an ISO timestamp with offset; an unqualified timestamp is interpreted in Asia/Manila. The web form sends `+08:00`. Stored times are UTC with second precision. Only one pending activation per hub/instant; different future times are allowed.
- Exactly one version is selected across the hub's named plans after successful activation. Empty mappings, inactive/non-standard lanes, unavailable accepted connections/participants, missing open fallback lane, or an archived plan prevent activation. Pause/Hold is a temporary physical lane block and does not invalidate publication.
- Activation records `scheduled`, `activated`, `failed`, or `cancelled`, requested actor, scheduled time, completion time, cancellation actor and failure reason. Invalid activation retains the previous active version.
- `sorting:activate-due` runs every minute through Laravel's existing scheduler. Authoritative sorting/configuration/quotation reads recover overdue activations under network then hub locks. Sorting capture and activation share that lock order; a scan sees one complete version.
- Published plans cannot be deleted. Archive inactive plans only after cancelling all scheduled versions. Archived versions/history remain readable. An active plan must be replaced before archival. Unpublished inactive drafts retain revision-checked deletion.

## Frozen physical assignments and dispatch

- At API processing time, local/destination sorting matches the waybill's immutable recipient postal code. Transfer sorting matches the committed next hop's hub and rechecks its accepted connection. Cached routing is advisory.
- Successful sorting stores `sorting_assignment` with version identity/number/name, lane ID/code/name/revision, assigned actor/time and immutable postal code or committed hop/connection/next-hub identity/name. Manual placement records the active version context where available.
- Activation and lane renaming affect future scans and live configuration only. A sorted parcel retains its original labels and next step. A reasoned physical move creates a new assignment and appends both previous and new snapshots to `hub_lane_move`; the committed destination remains unchanged. Reserved linehaul parcels must be unreserved before a move.
- Final-mile schedule membership and company-truck reservation membership preserve the sorting snapshot. Departure manifests, hop evidence and both dispatch interfaces expose stored labels/destinations rather than reading today's labels. Live lane revisions remain separate for concurrency checks.
- Checkout prices, provider selection, commercial route and committed route hops remain unchanged. New quotations use the current published selections; existing commercial contracts never reprice from lane edits.
- Courier final-mile task reads add nullable `sorting_assignment`, `hub_pickup_lane` (frozen labels plus live operational metadata), and `hub_pickup_blocked_reason`. Task confirmation submission remains unchanged; only successful Logistics validation commits physical pickup.

## Selected-lane controls

- `operational_state` is string-backed `open`, `paused`, or `held`, separate from administrative `is_active`. Pause/Hold requires a bounded plain-text `blocking_reason`, with actor/time and mutation history. Controls remain available with staged parcels.
- New scans targeting a paused/held lane go to the designated active/open exception lane, including manual lane selection. Other open lanes continue operating.
- Recheck the physical source lane transactionally for new final-mile schedules, new linehaul reservations, linehaul departures including existing reservations, direct dispatch compatibility transitions and validated final-mile hub pickup.
- Keep existing assignments, offered/accepted tasks, evidence and reservations while blocked. Resume allows the same work to continue using fresh live lane revisions. Departed/picked-up parcels are unaffected.
- The designated fallback is the first active/open exception lane in position/code order and cannot be deactivated, retyped, paused or held. Configure an open exception lane before publication/activation. There is no automatic relocation.

## Durable exceptions and recovery

- `sorting_exceptions` survives session closure, scoped to current organization/hub/Shipment, with physical exception lane, code/cause/reason, attempts, first actor/time, last attempt, revision, documented release and eventual resolving scan/actor/time. Scan results and inspection/release mutation results retain evidence of individual attempts.
- Exception placement never commits `sorted_at_hub`; the parcel remains `received_at_hub`. A new unresolved scan increments attempts. A successful automatic standard-lane rescan resolves the exception within the same transaction as sorting.
- Queue guidance identifies mapping/version, blocked lane, unavailable connection, or inspection correction. Repair configuration first, then physically rescan against current configuration. Manual standard placement and generic sort transitions cannot bypass an outstanding exception.
- Damage requires a recorded inspection/release reason before recovery. Receiving `condition_hold` remains authoritative and must be released through its original Receiving workflow first; a Sorting release never clears that hold. A new documented damage report requires another inspection.
- Ordinary sessions exclude outstanding exceptions. Operators select 1–100 outstanding received Shipments for a recovery session, preserving the one-open-session rule and optimistic custody checks.
- Close only when no item is pending and all device captures have reconciled. Closing with exceptions requires `carry_over_exceptions: true`; the UI confirms carry-over and checks its outbox. Each session item retains its assignment snapshot. Physical moves update an open session item; closed session snapshots remain intact when a later move or recovery session changes the Shipment. Operators must reconcile every participating device; the API cannot discover captures that have never left another device.

## Offline capture

- Dexie remains the durable account/hub/session capture outbox. Offline capture displays **Pending verification** and instructs operators to retain parcels in a pending area. Do not act on a cached lane prediction.
- Synchronize promptly online and on reconnect, with periodic/manual recovery. Read captures across sessions so uncertain results remain replayable after another device closes the original session.
- Matching `client_id` and payload replay the original committed result/snapshot before checking closure or rerouting. Keep request identities and exact payloads after timeout/uncertain results; disable local removal after an attempted uncertain submission. Only API-confirmed results remove entries. Definite rejected entries retain their reason.
- Publication, scheduling, cancellation, duplication, archival, lane controls, release and recovery-session UI preserve exact mutation identity on uncertain retry. On logout/auth-scope loss, existing private-cache cleanup remains authoritative.

## API additions

All routes below are under `/api/v1/logistics`, protected by Sanctum, active Logistics RBAC and policy consent, scoped to the actor's sole organization/hub, and private/no-store.

| Route | Contract |
| --- | --- |
| `GET sorting/plans/{plan}/versions` | Preserved version history |
| `GET sorting/plans/{plan}/versions/{version}` | Immutable version detail |
| `POST sorting/plans/{plan}/actions/{action}` | `draft`, `duplicate`, `publish`, `activate`, `schedule`, `cancel`, `archive`; UUID Idempotency-Key and expected plan revision |
| `PATCH sorting/lanes/{lane}` | Adds `operational_state`, `blocking_reason`; UUID Idempotency-Key required for state controls |
| `GET sorting/exceptions?page=1` | Ten-item paginated outstanding exception queue and next actions |
| `POST sorting/exceptions/{exception}/release` | UUID Idempotency-Key, exception revision, documented inspection/release reason |
| `POST sorting/sessions` | Adds optional `recovery_shipment_ids` (1–100); existing UUID Idempotency-Key |
| `POST sorting/sessions/{session}/close` | Adds explicit `carry_over_exceptions` acknowledgement |

Action bodies always include `expected_revision`; activation/scheduling require `version_id`; duplication optionally selects `version_id` (otherwise copies the draft) and optionally supplies a legacy explicit `name`; omitted names are allocated automatically; scheduling supplies `scheduled_for`; cancellation supplies `activation_id`; publication optionally supplies `activate` or `scheduled_for` (mutually exclusive).

## Migration and verification boundary

Apply only additive migration `2026_10_06_000004_add_sorting_versions_and_recovery.php`. Existing plans become version 1 with the existing active selection preserved. Legacy assignment/scan evidence is marked `legacy_reconstructed`; unknown historical labels remain null. Existing unresolved session exceptions become durable records. String-backed operational enums avoid native PostgreSQL enums.

The exception log and physical verification policy is informed by [Microsoft work exceptions](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/work-exceptions-log) and [outbound sorting](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/outbound-sorting). The rules above are AISLEY's chosen policy; automatic relocation, bulk resolution, containers and recurring shifts remain out of scope.

Verification evidence is recorded in the app-wide progress log and [verification notes](verification.md). Backend/web checks do not establish external Flutter adoption or physical scanner/device acceptance.
