# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

`
## YYYY-MM-DD
- Feature/change short summary
`

---

## 2026-09-15

- Revised the Logistics-owned Courier vehicle registry and related registration, approval, dispatch, domain, schema, and workflow documentation for exactly one vehicle per Courier with required type/plate and private OR/CR. Deferred maintenance, vehicle history, and capacity values/units/matching; documented existing one-image upload and missing database uniqueness without claiming implementation. No runtime, migration, seed, or Flutter changes.

- Defined approved Courier vehicle edits for type/plate/optional make/model and separate, independently replaceable OR/CR uploads without Logistics reapproval. Added planned private Courier/Logistics API contracts, revision/idempotency and migration boundaries, preserved original approval evidence, and specified durable associated-Logistics change notifications. Synchronized related auth/account/approval/notification and canonical docs; new acceptance remains unchecked. Documentation only; no backend, migration, database, or Flutter changes.

- Implemented Courier Vehicle Fleet Management Phase 1 in Laravel: additive one-vehicle-per-Courier uniqueness with duplicate preflight, optimistic revision/idempotent type/plate/make/model edits, independently replaceable private OR/CR document metadata and streams, strict shared image validation, scoped Logistics registry reads, cleanup of unreferenced replaced files, and deterministic after-commit `logistics-courier.vehicle-updated` notifications. Added focused API coverage (10 tests/125 assertions including Courier approval), synchronized canonical docs, and kept Courier mobile UI/registration-field rollout separate. PostgreSQL migration verification remains pending while the local Docker daemon is unavailable.

## 2026-09-16

- Archived the previous 148-line progress log at `docs/logs/PROGRESS-2026-09-16.md` and added thin Code 128 tracking-ID waybills, tenant-scoped postal-code sort plans, server-authoritative automatic sorting with exception fallback, responsive Sort plan UI, and synchronized role contracts. Logistics/Courier coverage passes; the unrelated CustomerRecentlyViewed 404 failures remain documented as out of scope.
