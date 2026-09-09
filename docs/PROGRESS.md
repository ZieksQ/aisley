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
