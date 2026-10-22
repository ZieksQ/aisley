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

Assigned linehaul transfer jobs are shown through `GET /api/v1/courier/linehaul-trips`. Refresh to see Logistics updates, then select an outbound or return job to review its route, truck, departure schedule, parcel references and receiving status. Origin Logistics releases the load; the assigned Courier confirms actual departure and reports arrival, while receiving Logistics retains parcel receipt/unloading authority.

The selected transfer loads `GET /api/v1/courier/linehaul-trips/{trip}/route` for its saved origin/destination hub pins, Geoapify road line, drive distance and estimated driving time. Unknown pins and provider failures are labelled; a dashed fallback connects two known pins without claiming to follow roads. Hub addresses remain available when tiles/WebGL fail. **Reload route** retries the read; **Refresh transfers** refreshes both jobs and map. **Open directions** opens external navigation to the destination pin without sending bearer tokens or personal information. The job exposes **Depart** after Logistics release and **Arrived at hub** while in transfer, each with a physical-event confirmation checkbox. These POSTs require `expected_revision` and `confirmation: true`; unknown outcomes offer an explicit retry with the same action/revision, while conflicts require refresh. Scheduled time is a plan, not a status trigger. A driver arrival report does not receive parcels or free the truck. See [the operations contract](../../docs/features/courier/linehaul-trips/spec.md).

Login receives the Sanctum token once, then protected requests send it in an `Authorization: Bearer <token>` header. Requests explicitly use `credentials: omit`; this mockup does not initialize Sanctum cookies or send CSRF cookies. The token is kept in browser `sessionStorage` only for this local test harness. Flutter must use OS secure storage.

The mockup checks public registration and the recovery entry point, login, session restoration, policy consent, account read, profile update, profile photo upload/private preview/removal, vehicle edit and private OR/CR replacement, password change, logout, dashboard, both delivery legs, and delivered-task history. Registration uses the current API's combined `vehicle_registration` evidence field and waits for Logistics approval; recovery currently records a request but sends no reset email. After bearer login it checks policy status, shows only unaccepted current Terms/Privacy versions, fetches their public text, submits explicit version acceptance, and preserves the token until consent is complete. The authenticated page keeps Terms of Service and Privacy Policy links available for later viewing.

Seller pickup testing includes schedule-grouped task details, a revision-scoped route manifest, an embedded MapLibre map, acceptance, local browser QR decoding, manual Order-reference entry, same-schedule parcel matching, and explicit idempotent pickup confirmation. Final-mile testing includes per-parcel acceptance/rejection, rejected-parcel rescheduling, parcel merchandise price, an advisory Geoapify Matrix/Routing map with `osm-bright` tiles, a visible road LineString, Logistics start marker and numbered delivery stops in MapLibre, authorized delivery context, task-bound hub pickup confirmation without parcel identifier entry, movement, private camera photo POD, retryable failed attempts, Delivered intent, and read-only history. Photo and hub-pickup submissions await Logistics validation; Delivered intent alone does not mark the Order delivered. The API does not currently expose a Courier hub-pickup evidence read, so the mockup shows its own successful submission as pending during the current page session and requires refresh to observe validated custody.

`VITE_API_URL` is only a non-secret API origin. Do not add Geoapify or any other secret to a `VITE_*` variable: Vite exposes those values to the browser bundle. Matrix, Routing, and map-tile requests are made or proxied by Laravel and use `GEOAPIFY_SERVER_API_KEY` only. Run the backend queue worker so newly committed schedule revisions move from `pending` to `ready` or an honest `unavailable` state.

## Linehaul browser verification

Run `node src/couriermockup/tests/linehaul-browser.smoke.mjs` from the repository root with Vite running on port 5177 and headless Chromium exposing CDP on port 19227. Override those origins with `LINEHAUL_BROWSER_ORIGIN` and `LINEHAUL_BROWSER_CDP`. Use a temporary project-local Chromium profile. The fixture supplies synthetic trips, road geometry and raster tiles; it contacts no API/database/provider. It checks outbound/return selection, refresh, road/fallback rendering, missing pins, auth/tile/list failures, mobile overflow, directions coordinates, and bearer-only reads. Screenshots are written to `node_modules/.cache/linehaul-browser/`.

The suite also checks confirmed departure/arrival, release gating, lost-response replay, stale-revision recovery, and submission/job-switch locking. Set `LINEHAUL_LOGISTICS_ORIGIN` to a running Logistics Vite origin to include its synthetic release fixture: cancelled/confirmed release, conflict recovery, CSRF/session transport and light/dark layouts at phone/desktop sizes. Production Courier Flutter implementation remains external and unverified.

The last-mile parcel detail offers **Accept parcel** and **Reject parcel** (with reason). Rejection returns only that parcel to Logistics scheduling. Routes show accepted current parcels. **Take parcel photo** opens the rear camera with preview/retake and a visible file fallback; upload private POD before the **Delivered** action. That action retains the existing Logistics-reviewed completion intent.
