# Logistics parcel search and Sorting pagination verification

Date: 2026-11-05. Browser checks use synthetic tenant-scoped API responses and isolated Chromium against the production Logistics bundle. They establish frontend behavior, not deployed API, physical-printer or real-device acceptance.

## Delivered behavior

- Search-first `/operations` layout using shared Logistics portal controls, visible lookup/filter labels, reset, selected results, separate custody/task/evidence sections, and light/dark themes.
- Ten-row server queue pagination and existing barcode/manual lookup, local decoded hints and private scoped offline cache remain intact. Cached details cannot authorize custody or POD decisions.
- Mobile selected details precede results in DOM/visual order, receive focus, and provide Back to results. Desktop retains results beside details. Inputs/actions fit 320px; long values wrap.
- Superseded reads cannot replace a newer selection, including obsolete URL effects. Lookup drafts cannot retarget a custody update. Record changes clear recovery drafts, evidence selection and viewed-proof state; uncertain custody updates replay the original payload/key and block switching.
- Sorting Lanes displays eight rows per page with range and Previous/Next. Selection and manual routing survive paging; refresh clamps shrinking lists. Lane-label scans reveal the selected page, including a deliberate re-scan of an already-selected lane. Existing sessions, capture outbox and printing handlers remain in place.

## Static checks

Passed the configured Logistics tools through their installed binaries, from the repository root:

```sh
node src/logistics/node_modules/typescript/bin/tsc -b src/logistics
src/logistics/node_modules/.bin/oxlint src/logistics/src
node src/logistics/node_modules/vite/bin/vite.js build src/logistics
git diff --check
```

The pnpm launcher could not open its engine-store lock in this sandbox, so these run the same local TypeScript, Oxlint and Vite tools directly. Vite retains the existing large-bundle advisory; no dependencies, schema or API contracts changed.

## Browser checks

- `parcel-search-browser.smoke.mjs`: 16 result/detail × theme × width combinations at 320/390/768/1440px. Passed lookup, QR normalization/local hints, ten-row server pagination, filters/reset and browser history, selected-detail reading order/focus, rapid switching with delayed responses, cleared recovery drafts, no failed-lookup retry loop, loading/empty/error distinctions, offline cached reads/reconnect, proof viewing/completion gating and reset, and exact uncertain-update replay.
- `sorting-browser.smoke.mjs`: retained 24 responsive/theme checks across Sort plan, Sorting and downstream dispatch views, keyboard/dialog interactions, plan/version retries and exception/offline recovery. Added 0/8/9/17-lane pagination, page boundaries, refresh clamping, manual-selection preservation and printable-label opening from a later page.
- `hub-scanner-browser.smoke.mjs`: actual canvas camera frames decode Code 128, Aisley waybill QR and tracking-only QR in Parcel search and the existing Receiving/Sorting scanners. Confirmed camera continuity/cleanup, full-screen session guards, lane QR page reveal and repeated selected-lane reveal, with no custody write or parcel sound for lane selection.
- All three suites passed with no recorded browser runtime exceptions.

Browser output is generated under `src/api/storage/framework/testing/parcel-search-shots`, `src/api/storage/framework/testing/sorting-browser-shots`, and `node_modules/.cache/logistics-fullscreen/screenshots`; screenshots are local verification artifacts, not production data.

## Design review

Applied Design Taste app-screen guidance and Uncodixfy under the higher-priority `docs/design.md` contract. Dealt Achromatic ledger, seed **1305817956**; retained its flat surfaces and neutral hierarchy while preserving the mandated Logistics blue actions, Geist typography, established shell and supported themes. No redraws, new imagery or fonts.

The screen answers “Where is this parcel, and what can I do next?” through reference lookup, current custody and authorized evidence/recovery controls. Reviewed all 16 result/detail screenshots, including narrow/intermediate/wide light and dark views. Fixed a desktop Back-button specificity issue, nested empty-state borders, and dark detail borders during review. Qualitative review: task clarity 4/5, hierarchy 4/5, density 4/5, responsive usability 4/5; operational details remain intentionally scrollable.

Optional Taste probe/app-judge measurements run through the smoke harness at 390/768/1440px in both themes and both states. Raw `taste-measurements.json` retains the existing shell's four 9px **Beta** labels as `tiny-text` failures. Those labels are outside this change. Desktop `ragged-row` warnings reflect independent result/detail lengths; stretching either panel would introduce blank content. No other findings remained. This is not a claim that the entire unchanged shell passes the full Taste inspector.

## Remaining acceptance

Live Laravel/PostgreSQL integration, deployed cookies/private storage, physical scanners/cameras and actual label printing require their own environment checks. Backend/mobile workflows and external Flutter implementation status are unchanged.
