# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

```
## YYYY-MM-DD
- Feature/change short summary
```

---

## Status

Project is currently in the planning/documentation phase. No code has been implemented yet.

## 2026-08-27

- Added the initial Laravel API data layer with UUID-backed users and Sanctum tokens, role profiles, registration approvals and documents, addresses, admin permissions, courier vehicles, shops, and category models/migrations. Added PHP enum casts, model relationships, and integration coverage for UUID generation and schema constraints.
- Documented the implemented UUID schema in `docs/schema.md`, including relationships, exact columns and constraints, enum values, foreign-key behavior, framework key exceptions, application-enforced invariants, migration order, and deferred marketplace domains.
