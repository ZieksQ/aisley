# Platform contract adoption — Courier, 2026-10-26

Platform source: `1858785e9b5954f71a9be1d5fe7c411bbdc1fa4a`. Flutter parent: `60a04ac15dcef8ca9e09ebd42069a796f311eeef`. Implementation branch: `feature/platform-contract-sync`.

## Adopted behavior

- `courier-final-mile-parcel-decisions-v2`: individual accept/reject, reason and frozen rejection key, unchanged sibling decisions, current dispatch membership, dependent-work refresh and accepted-parcel advisory routes. The legacy batch endpoint remains compatibility-only and has no normal UI action.
- `courier-direct-delivery-v2`: accepted and compatible later tasks can submit one Delivered action with current payment authority, explicit COD collection, photo capture/preview/retake, private proof upload and linked intent. Prepaid paid submissions omit COD. No pickup/transit writes or physical-state timestamps are invented. Partial success, unchanged proof/intent retries, fresh-proof checks and GET reconciliation preserve Logistics confirmation authority.
- Linehaul operations v1: assigned outbound/return jobs, known hubs and advisory road route, company truck, schedules, parcel references, lane blocks and Logistics evidence. Explicit Depart and Arrived at hub use the documented revision/confirmation body; uncertain attempts remain frozen, conflicts require review, route cooldown does not block driver actions, and session loss clears private state. Receiving and unloading remain Logistics-owned.
- Chat selection accepts new JPEG/PNG only, up to 8,000,000 bytes inclusive, 4,096 pixels per edge and 8,000,000 pixels. Historical committed WebP/documents, received MP4/documents and exact committed-send replay remain supported.

## Verification

- `flutter analyze --no-pub`: no issues. The full Courier suite passes 1,146 tests; 378 focused workflow/media/navigation/map checks also pass. The final refresh-during-Delivered guard passes 35 additional affected checks, including the new race regression.
- `flutter build web --no-pub` and `flutter build apk --release --no-pub` pass for the final application source using isolated synthetic public configuration and unchanged locked dependencies. SDK XML/deprecation warnings remain.
- Chromium passes 18 synthetic layout/journey checks: four mounted widths plus doubled-text/dark mode per changed screen, explicit linehaul departure/cancel/arrival, independent parcel acceptance/reasoned rejection, and accepted-task photo/COD/Delivered submission. The submitted private proof decodes; delivery remains pending Logistics. Browser exception log is empty; representative phone, desktop, dark/enlarged, dialog and proof screenshots were reviewed.
- Changed Dart formatting, Git whitespace, affected specification lengths/local links, and paired adoption records pass. `r` recompiled the temporary debug fixture, but no client was connected; browser acceptance uses the final release fixture instead.

 Evidence stays in ignored `build/sync-*.log` and `build/verification/platform-sync/`; browser scenarios use synthetic repositories and no ordinary accounts. Builds use isolated `build/platform-sync/` source copies and a synthetic public `.env`, excluding original environment files, signing keys and credentials. They are verification artifacts, not configured deployment releases.

Representative commands (build commands run inside the isolated synthetic-config copy):

```sh
flutter analyze --no-pub
flutter test --no-pub --no-test-assets --concurrency=4
flutter build web --no-pub
flutter build apk --release --no-pub
python3 test/manual/check_platform_sync_browser.py
```

## Remaining acceptance

No Android device/emulator was attached. Installed Android camera/permissions/TalkBack, controlled deployed API/provider/media exchange, PostgreSQL concurrency and production signing remain unverified. No database, deployment configuration, secret-bearing environment file or production service was modified. Dependencies and locked versions are unchanged.

The full-app sync preserves local dotenv/release selection, visual design, first-mile workflows, existing media history and previously recorded acceptance boundaries. Company-created Courier email-change notes describe a separate pending feature; this sync does not claim its client adoption or SMTP acceptance.
