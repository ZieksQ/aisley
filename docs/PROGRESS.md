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

## 2026-09-16

- Archived the previous 148-line progress log at `docs/logs/PROGRESS-2026-09-16.md` and added thin Code 128 tracking-ID waybills, tenant-scoped postal-code sort plans, server-authoritative automatic sorting with exception fallback, responsive Sort plan UI, and synchronized role contracts. Logistics/Courier coverage passes; the unrelated CustomerRecentlyViewed 404 failures remain documented as out of scope.
