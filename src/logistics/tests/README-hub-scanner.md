# Hub scanner browser verification

Run commands from the repository root. Build Logistics, then serve the build on a local port:

```sh
pnpm --dir src/logistics build
pnpm --dir src/logistics exec vite preview --host 127.0.0.1 --port 15177
HUB_ORIGIN=http://127.0.0.1:15177 node src/logistics/tests/hub-scanner-browser.smoke.mjs
node --test src/logistics/tests/waybillScanner.test.cjs src/logistics/tests/waybillPdfBarcode.test.cjs
```

The browser check requires installed Chromium/Brave (`CHROMIUM_BINARY` overrides the executable), PHP with the existing API dependencies, and a writable repository. It launches a separate browser profile, intercepts all API reads/writes, and substitutes real Code 128, waybill QR and tracking-only QR images through a canvas camera stream. It confirms both workflows accept captures offline, fill the viewport with the camera, center the scan guide, show plain green bottom-left pending-verification text, schedule one Web Audio chime per accepted capture, preserve the camera on exit/re-entry, release tracks on Stop, and restore focus/scrolling. It also exercises full-screen Sorting Start/End session controls, close confirmation, reconciliation guards and exact uncertain-request retry without playing parcel sounds. Synthetic scans never change custody or reach the real API.

Artifacts are written under `node_modules/.cache/logistics-fullscreen/`. A short repository-local `.tmp` directory holds Chromium temporary sockets because Unix socket paths have a small length limit. Browser artifacts can be removed after verification. Profiles are reset at each run; use no ordinary browser profile or account.

The existing `sorting-browser.smoke.mjs` separately covers published versions, duplication/retry identity, inspection/recovery, offline synchronization, and responsive themes. Browser fixtures do not establish physical camera, live API, PostgreSQL or warehouse acceptance.
