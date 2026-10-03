# External Courier Flutter handoff — 2026-09-13

> Historical handoff record. Its commit IDs and verification state describe the 2026-09-13 import, not the current copied backend contract. For the current copied contract baseline and working-route index, use `docs/PROGRESS.md` and `docs/features/courier/README.md`; newer chat, COD, tracking-ID, and Courier vehicle rules are documented in their owning specs.

## Evidence and authority

- Reconciled the supplied `docs/cabigan/flutter-docs/` README, progress log, architecture, dashboard spec, and delivery-history spec with this repository.
- The bundle records backend baseline `d1abeee73d0141e1fd7dda4bea0ee3fead370378`. This reconciliation inspected current backend `4909cafa3395fabaf470a66f62dd3cf8337141b2`.
- No Flutter source, Flutter commit identifier, or runnable Flutter project was supplied. Client completion below is reported by that handoff, not independently verified here.
- Laravel remains authoritative for API fields, roles, custody, revisions, and transitions. Flutter architecture is client-specific and does not replace `docs/architecture.md`.
- This record summarizes the imported evidence; owning feature specs remain the implementation contracts. The temporary import directory is not an implementation prerequisite.

## Reported client implementation

| Area | Reported Flutter capability | Remaining boundary |
| --- | --- | --- |
| Auth/account/consent | Registration, bearer session, account/password/photo, Terms/Privacy viewing and consent recovery | Recovery completion remains unavailable; preserve server approval gates |
| Dashboard | Scaffold, account avatar, navigation to pickup/delivery/history | Operational aggregation, notifications and aggregate pagination remain unavailable |
| First mile | List/accept, QR payload by keyboard/paste or manual reference, explicit Seller pickup, ordered schedule manifest | Camera decoding and graphical map/navigation are not reported implemented |
| Final-mile pickup | Separate task list/detail/accept/reject and hub-handoff evidence | HTTP 202 awaits Logistics validation; it is not confirmed custody |
| Delivery | Accepted-task context, revision-checked movement, QR/reference proof and completion intent/status | Final delivery remains Logistics-authorized; route/ETA/telemetry and media proof are deferred |
| History | Delivered list/detail using bounded reads | Cursor/date filtering and persistent offline history are deferred |

## Reconciled contract details

- Movement uses `POST /api/v1/courier/final-mile-tasks/{task}/status`, a UUID `Idempotency-Key`, and JSON `target_state` plus `expected_revision` (integer at least 1).
- The current validator also accepts `status` and `revision` aliases. The handoff's `{status, expected_revision}` is compatible; canonical fields win if both forms are present. No backend change is needed for that payload.
- Allowed targets are `in_transit` and `out_for_delivery`, from their respective preceding states. A client cannot skip Logistics-confirmed hub pickup or locally mark delivered.
- Hub pickup returns `evidence_id`; delivery proof returns `proof_id`. Pass the latter as completion's `evidence_id`. These are distinct response contracts, not interchangeable field names.
- Existing first-mile route-manifest APIs do not imply Flutter map rendering is complete, or that final-mile routing is available. Camera QR decoding is a client capability, not a missing backend endpoint.
- Do not adopt the bundle's broad “all other routes are conceptual” statement literally: the Courier dashboard and map proxy routes also exist. Check each owning spec and current routes.
- Dashboard aggregation remains a scaffold even when its navigation opens working task screens. History's `has_more` does not provide a usable cursor when `next_cursor` is null.

## Verification still required

- [ ] Record the external Flutter commit/build identifier used for this handoff.
- [ ] Run the latest Flutter analyzer and tests in an environment with writable SDK caches; the supplied log reports direct Dart analysis passed but Flutter execution was blocked.
- [ ] Exercise the real API from Flutter for each leg, including accept/reject, uncertain retries, revision conflicts, consent recovery, and logout cleanup.
- [ ] Demonstrate Logistics validation between hub evidence and movement, and between delivery proof/intent and final delivered history.
- [ ] Complete the existing PostgreSQL release verification independently of client implementation.

No Laravel code, migrations, Flutter source, or shared business rules were changed by this reconciliation. Imported snapshots were preserved; completed UI reports do not automatically check test or deferred-feature acceptance criteria.
