# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:

```
## YYYY-MM-DD
- Feature/change short summary
```

---

## 2026-09-09

- Archived the previous 451-line progress log at `docs/logs/PROGRESS-2026-09-09.md` and added a 150-line progress-log archival rule to `AGENTS.md`.
- Added Seller pickup address-book CRUD with searchable PSGC fields and one default, per-Order pickup-address selection with immutable waybill snapshots, first-provider defaulting, and a searchable Logistics provider modal with hub details and recommendation/location tags.
- Changed solo and bulk Seller pickups to use one shared saved address per request, and added Geoapify geocoding with a click/drag Leaflet pin for pickup coordinates retained in immutable waybill snapshots.

## 2026-09-10

- Switched Seller registration and pickup-address PSGC selectors to the bundled `@aisley/psgc-address-data` loader and renamed the Seller Geoapify example variable to `GEOAPIFY_API_KEY`.
- Fixed repeat Customer homepage requests under production-safe cache deserialization by caching only scalar advertisement, campaign, and category projections, rotating the affected cache keys, and covering guest plus Seller/Admin/Logistics session behavior; disabled prefetch for unimplemented storefront resource links to prevent background RSC 404 noise.
- Revised Courier Account Management into a standalone Phase 1 contract for own-profile read/update and password change, with exact planned `/api/v1/courier` routes, bearer-token and Flutter handoff rules, privacy/error/retry semantics, and explicit deferral of vehicle, license, payout, uploads, and shipment operations. No application behavior or migrations changed.
- Implemented Courier Account Management for the external Flutter client. Added protected `GET /api/v1/courier/account`, `PATCH /api/v1/courier/account/profile`, and throttled `PUT /api/v1/courier/account/password` endpoints with Courier role/status/Logistics-affiliation gates, server-derived ownership, allow-listed profile updates, transactional row locking, centralized password validation, complete bearer-token revocation after password changes, private no-store DTOs, and no Courier web UI. Focused Courier account coverage passes 8 tests/84 assertions (13 tests/125 assertions with the existing Courier suite); PHP formatting and diff checks pass. Vehicle, license, payout, profile-photo, email, and delivery operations remain deferred by the account contract.
