# Buyer Flutter acceptance and release checks

> Implementation, SDK/package resolution, tests, builds and browser results in this guide are reports from the external Buyer Flutter project and were not rerun here. This bundle contains documentation; `lib/`, tests, tools, lockfiles and build reports belong to that project. Current shipping-contract adoption remains [G25](references/integration-gaps.md).

Phase 5 adds repeatable local checks and a controlled-authenticated/device runbook.
See [Phase 5 evidence and gate matrix](references/phase-5-verification.md) and
[current responsive/sign-in evidence](references/responsive-signin-verification.md).
Run `python3 tool/verify_release.py`; `--live --browser` opts into public target
checks only. A passing local report leaves external release gates open.

The broad release checks below remain open where they include unimplemented features or live/device acceptance. Executed Phase 4 checks are in [Phase 4 evidence](references/phase-4-verification.md); Phase 3 checks are in [Phase 3 evidence](references/phase-3-verification.md); Phase 2 checks are recorded in [Phase 2 evidence](references/phase-2-verification.md); Phase 1 checks are recorded in [Phase 1 evidence](references/phase-1-verification.md) and [Progress](PROGRESS.md). Source-test inspection proves existing test definitions, not a newly executed test or device result.

For each phase record backend commit/configuration, target/origin, Flutter SDK/approved package versions, commands run, actual results and unresolved gates. Use controlled development accounts; never log credentials, evidence or private transcripts.

- [x] Formatting, analyzer and focused DTO/repository/controller/widget tests pass; web and Android release builds pass using the destination's configured tools. See Phase 5 evidence; HTTPS placeholders/debug signing establish compilation only.
- [ ] Installed Android and actual browser at `http://localhost:8766` reach the development API; exact CORS/preflight, bearer-only authentication, cookie isolation, exposed Retry-After and private-image bytes work. A mocked HTTP browser run is reported separately.
- [ ] Cold start restores the token through `/me`; no private flash; absent/revoked token, pending/rejected/suspended/wrong-role identity, offline startup and secure-storage read/write/delete failure produce distinct states.
- [ ] Logout/relogin/A→B→A account switching clears all private caches/drafts/quotes/uploads/read markers; late successes/errors/page requests cannot update the new account. Offline sign-out does not claim remote revocation.
- [ ] Current Terms/Privacy reading/history/explicit acceptance and publication race work; disabled/enabled enforcement, `POLICY_CONSENT_REQUIRED` and exact acceptance semantics do not loop or repeat protected writes.
- [ ] Registration collects only supported keys, returns pending/no token, handles duplicate/normalization/throttling, and avoids claiming address/evidence/email/status-polling features. Storefront recovery and reset-token invalidation are verified.
- [ ] Public Products/Shops/Home omit hidden/restricted/vacation/inactive content; variant choices, literal wildcard search, pagination/end/error and public/private cache isolation behind verified app navigation match current APIs.
- [ ] Shopping widgets never mount/fetch before verified identity/consent. Recently Viewed records account history only, never writes/merges guest hints, and removes only the legacy key without blocking sign-in.
- [ ] PSGC JSON manifest/hierarchy and Region→Province→City/Municipality→Barangay cascading work offline with manual fallback. Optional pin/GPS uses approved provider/adapter, clears stale coordinates and handles denial/failure/attribution without blocking text save.
- [ ] Profile/password/preference fields are allow-listed; current bearer survives account password change, other tokens are revoked, reset revokes all tokens; email remains read-only. Private avatar bytes cannot leak to another account/cache.
- [ ] Android/browser multipart uses `photo`/`image`, exact under-10-MiB limit and allowed types; cancel/permission/corruption/spoof/size/throttle/consent/storage failure and uncertain response reconciliation work; review partial photos are not duplicated blindly.
- [ ] Cart same-configuration merge/increment, separate variants, variation replacement/merge, server stock/visibility conflicts and unavailable lines work; uncertain additive writes do not auto-replay.
- [ ] Buy Now leaves Cart unchanged; selected Cart checkout creates atomic one-Order-per-Shop batches; address/serviceability/rate changes invalidate quotes; current per-Shop provider selection/DTO adoption (G25), single/multiple/empty options and frozen intent are verified; no local payable calculation appears.
- [ ] Voucher UUID/targeting, one App of each benefit per batch, per-benefit limits/default opposite-benefit pairing and name snapshot parsing, zero-saving redemption, caps/rounding and limited-capacity conflicts are verified; no wallet/claim/code-entry endpoint is assumed.
- [ ] Place response loss/timeouts and exact-key replay create one batch/reservation/redemption; changed payload/key conflicts, fresh quote review and process-death uncertainty follow documented limits.
- [ ] Owned Orders/tracking hide foreign data; status tabs/capabilities match server; maps remain unavailable; cancellation/address correction races with Seller processing, releases/snapshots and revision/idempotency work without refund promises.
- [ ] Shop/Logistics/Courier first send/reply/read/cursor flows work with live counterparts; channel identities/envelopes stay separate, unaccepted final-mile offers deny contact, ended custody/reassignment preserve scoped history and forbid sends.
- [ ] Messaging uncertain keys, 409/422/429, offline/focus/background recovery and older-history gaps preserve intended text without duplicates or falsely sent bubbles; private denial clears affected transcripts.
- [ ] Q&A read/ask is Product-visible and UUID-keyed; delivered-item Review create replays identical content, rejects changed repeat, maintains aggregate/official-response privacy and reconciles partial images.
- [ ] Customer notifications use actual page filters/destinations/read endpoints; missing global count/read-all/native push are not fabricated; promotion opt-in is default-off and separate from Terms/Privacy.
- [ ] Support create uses subject/category/body only; replies carry expected revision/key, reopen waiting/resolved cases, preserve uncertain draft and own history/read state without assignment/status powers.
- [ ] 320/360/390/412px phones and 600/800px tablets, landscape/split-screen and keyboard-open height remain usable; 48px targets, TalkBack/text scaling, keyboard/Tab/focus, Android/browser Back, dialogs, soft keyboard, loading/empty/error, reduced motion and non-color status cues are verified.
- [ ] Open policy/privacy/backend gates in [integration gaps](references/integration-gaps.md) are reviewed, including message retention, upload hardening, rate/address correction and native map credentials. No mocked test or build is reported as live production certification.

Backend test references are in [source provenance](references/source-provenance.md). Running migrations/seeds, provisioning databases or changing backend/deployment configuration requires the owning authorized backend task; these are not automatic Flutter build steps.

## Standalone implementation verification inputs

Use the pinned SDK/packages and target commands in [setup](setup.md). The local [operation inventory](api/operation-index.json), [DTO schema](api/dto-schema.json), [synthetic examples](api/examples/README.md) and [failure contracts](api/errors.md) supply test inputs without an upstream checkout. Synthetic fixtures establish expected parsing cases; they do not certify a deployed API.

- [ ] Resolve the pinned dependencies and record pubspec.lock; execute formatter/analyzer, meaningful repository/view-model/widget tests, debug/release Android builds and local-web compilation separately. Official metadata compatibility is not dependency resolution.
- [ ] Traverse Shop, operational and Support cursors with multiple pages; Support uses Laravel's request-bound cursor resolver. Detect repeated cursors and preserve session/query guards.
- [ ] Verify every PSGC source checksum after asset copying and all eighteen regional loaders, including direct cities/NCR; confirm reviewed Province text against the deployed shipping-coverage data.
- [ ] Discard registration profile_photo_path and unknown private fields; verify the client never derives a public media URL from that path.
- [ ] Exercise optional intentional geocoding, reviewed pin edits, foreground GPS denial/permanent denial, attribution and text-only fallback with deployment-approved public credentials.
- [ ] Verify nullable Home flashDeals, arbitrary nullable Product specifications, legacy nullable checkoutBatchId and tracking's empty-array location compatibility with typed fixture tests.

Completed documentation-only checks are recorded in [documentation validation](references/documentation-validation.md).
Phase-specific application evidence is linked above; broad criteria that combine
synthetic and live/device acceptance remain unchecked until the whole criterion passes.

## Current contract adoption gate — 2026-10-04

- [ ] Adopt [shipping selection](api/shipping-selection.md) at the current Laravel inspection: options read, per-Shop choice/fallback, quote invalidation/hashes, revised shipping projections and nullable legacy Order provider. Re-run affected client parsing/repository/UI checks and controlled commerce acceptance. Phase 1–5 reports do not resolve G25.

The older Phase 5 runbook mentions guest hints and no provider assignment. Its imported scope is historical: current Buyer presentation has account-only recency, and current checkout requires provider selection. Keep installed-device, authenticated, accessibility, signing and deployment gates open.
