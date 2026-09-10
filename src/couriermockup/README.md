# Courier API mockup

This is a small, development-only React harness for exercising the implemented Courier API from a browser while the real client is built in Flutter.

## Run it

From the repository root:

```bash
pnpm install
pnpm --dir src/couriermockup dev
```

The Vite proxy forwards `/api` requests to `http://127.0.0.1:8000`. Set `VITE_API_URL` when the API is hosted at another origin.

## Authentication boundary

Login receives the Sanctum token once, then protected requests send it in an `Authorization: Bearer <token>` header. Requests explicitly use `credentials: omit`; this mockup does not initialize Sanctum cookies or send CSRF cookies. The token is kept in browser `sessionStorage` only for this local test harness. Flutter must use OS secure storage.

The mockup checks login, session restoration, account read, profile update, password change, logout, dashboard, and the first-mile Seller pickup contract. Pickup testing includes schedule-grouped task details, a revision-scoped route manifest, an embedded MapLibre GeoJSON map showing the Logistics start/end, numbered pickups, and road route line with an ordered-list fallback, acceptance, local browser QR decoding, manual Order-reference entry, explicit idempotent pickup confirmation, and truthful API failure states. Logistics receipt remains unavailable.

`VITE_API_URL` is only a non-secret API origin. Do not add Geoapify or any other secret to a `VITE_*` variable: Vite exposes those values to the browser bundle. Matrix, Routing, and map-tile requests are made or proxied by Laravel and use `GEOAPIFY_SERVER_API_KEY` only. Run the backend queue worker so newly committed schedule revisions move from `pending` to `ready` or an honest `unavailable` state.
