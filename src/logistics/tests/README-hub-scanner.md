# Hub scanner browser verification

Run commands from the repository root. Build Logistics, then serve the build on a local port:

```sh
pnpm --dir src/logistics build
pnpm --dir src/logistics exec vite preview --host 127.0.0.1 --port 15177
HUB_ORIGIN=http://127.0.0.1:15177 node src/logistics/tests/hub-scanner-browser.smoke.mjs
node --test src/logistics/tests/waybillScanner.test.cjs src/logistics/tests/waybillPdfBarcode.test.cjs
```

The browser check requires installed Chromium/Brave (`CHROMIUM_BINARY` overrides the executable), PHP with the existing API dependencies, and a writable repository. It launches a separate browser profile, intercepts all API reads/writes, and substitutes real Code 128, waybill QR and tracking-only QR images through a canvas camera stream. It confirms both workflows accept captures offline, show pending-verification notifications inside full screen, keep the camera active, release media tracks on Stop, and restore focus and scrolling on Escape. Synthetic scans never change custody or reach the real API.

Artifacts are written under `node_modules/.cache/logistics-redesign/`. A short repository-local `.tmp` directory holds Chromium temporary sockets because Unix socket paths have a small length limit. Browser artifacts can be removed after verification. Profiles are reset at each run; use no ordinary browser profile or account.

The existing `sorting-browser.smoke.mjs` separately covers published versions, duplication/retry identity, inspection/recovery, offline synchronization, and responsive themes. Browser fixtures do not establish physical camera, live API, PostgreSQL or warehouse acceptance.
