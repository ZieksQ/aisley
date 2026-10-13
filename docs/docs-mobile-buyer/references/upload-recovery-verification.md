# Profile and Review upload recovery — 2026-10-10

Implemented on `fix/buyer-upload-recovery`. General API baseline remains
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; shipping remains `22b0a48`.
Deployed backend revision is unidentified. No endpoint, dependency or backend change.

## Behavior and regression evidence

- Shared picker uses measured bounded XFile streams and checks actual length, matching
  filename/extension/MIME/signature and image decoding before preview. Android lost files
  are discarded once with explicit reselection/error feedback; web skips native recovery.
- Profile writes are session-owned across navigation. Current account/photo reconciliation
  cannot clear uncertainty from an old versioned URL or account/permission denial.
  Confirmed upload success remains success when private preview refresh fails.
- Both screens cancel only the individual upload, clear selection and require a server
  check before another image write. Selection dismissal preserves a valid preview.
- Review text/committed photos survive later validation, cancellation and uncertain image
  results. Canonical page traversal stops obsolete requests on identity loss; failed reads
  keep writes blocked. No automatic multipart replay or invented idempotency header.
- Private cleanup handles consent/account changes, cancels uploads and rejects stale
  picker/progress/dialog/network results. Identity loss discards all private selections.

Focused controller/picker/contribution suites pass, including **34** final dimension/picker/recovery cases. Four new widget
checks pass, covering 320px doubled text and 1440px, 48px cancellation targets, preview
removal, cancelled confirmation, account loss and remount recovery. Browser transport
suite: **13 passed**, including real Blob-backed XFile bytes, exact multipart field names,
Fetch abortion, pre-cancelled requests and an unaffected authenticated session read.

The actual web journey exposed the pre-existing use of unsupported encoded-image
`ImageDescriptor.width/height` getters. Bounded PNG/JPEG/WebP header inspection now
checks Review dimensions before preview decoding on both platforms. Real baseline/progressive
JPEG and lossy/lossless/extended WebP fixtures decode in native and browser tests; the
pixel ceiling is checked independently of the edge ceiling.

## Final checks

- `dart format --output=none --set-exit-if-changed lib test`: passed.
- `flutter analyze --no-pub`: passed after correcting three brace-style diagnostics.
- `flutter test --no-pub`: full suite passed; opt-in live cases remain skipped.
- `CHROME_EXECUTABLE=/usr/bin/chromium flutter test --no-pub --platform chrome test/web`: 13 passed.
- `python3 tool/verify_bundle.py`: passed; revised Customer specs are 225/223 physical lines.
- `flutter build web --no-pub` and `flutter build apk --release --no-pub`: passed with
  public HTTPS placeholder origins; maps disabled and no secret configuration read.
- `python3 tool/browser_smoke.py --synthetic-upload-recovery`: passed at 390×844 and
  1440×900 on `http://localhost:8766`, using trusted file-picker clicks and actual browser
  PNG files. Verified picker dismissal/corruption, private avatar cancellation/re-entry,
  confirmed Review text, partial photos, lost-response recovery and failed canonical checks.
  Every API call/write was intercepted; no synthetic credential or upload reached Laravel.
- `python3 -m py_compile` for the three browser modules and `git diff --check`: passed.
- Python tooling suite: 10 passed/1 failed, reproducing the documented pre-existing negative
  archive-link fixture failure. Actual bundle validation passes; validator/test sources are unchanged.

The selected-check runner is recorded in `build/verification/upload-recovery-final.json`.
Its initial analyzer style failure is superseded by the passing final formatting/analysis
report `build/verification/upload-recovery-style.json`; behavior/build checks remain independent.
No live account/upload or installed Android operation is inferred.

## Remaining acceptance

- Installed Android gallery/permission/process-death recovery, TalkBack and device cleanup.
- Live profile/Review ownership, media processing, concurrent limits, cancellation/lost
  response outcomes, exact-origin CORS and exposed Retry-After with controlled accounts.
- G15 server decoding/rewrite/retention hardening and lack of durable image replay.
- Process death retains no selected bytes or upload intent; fresh forms must read current
  server state. Canonical rereads cannot prove which specific image an uncertain write saved.
- Production signing and existing G25/G26 gates remain open.
