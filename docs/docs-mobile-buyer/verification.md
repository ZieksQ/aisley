# Buyer Flutter acceptance and release checks

All application checks below are **pending**. This bundle's completed checks cover documentation only, recorded in [Progress](PROGRESS.md). Source-test inspection proves existing test definitions, not a newly executed test or device result.

For each phase record backend commit/configuration, target/origin, Flutter SDK/approved package versions, commands run, actual results and unresolved gates. Use controlled development accounts; never log credentials, evidence or private transcripts.

- [ ] Formatting, analyzer and focused DTO/repository/controller/widget tests pass; web and Android release builds pass using the destination's configured tools.
- [ ] Installed Android and actual browser at `http://localhost:8766` reach the development API; exact CORS/preflight, bearer-only authentication, cookie isolation, exposed Retry-After and private-image bytes work. A mocked HTTP browser run is reported separately.
- [ ] Cold start restores the token through `/me`; no private flash; absent/revoked token, pending/rejected/suspended/wrong-role identity, offline startup and secure-storage read/write/delete failure produce distinct states.
- [ ] Logout/relogin/A→B→A account switching clears all private caches/drafts/quotes/uploads/read markers; late successes/errors/page requests cannot update the new account. Offline sign-out does not claim remote revocation.
- [ ] Current Terms/Privacy reading/history/explicit acceptance and publication race work; disabled/enabled enforcement, `POLICY_CONSENT_REQUIRED` and exact acceptance semantics do not loop or repeat protected writes.
- [ ] Registration collects only supported keys, returns pending/no token, handles duplicate/normalization/throttling, and avoids claiming address/evidence/email/status-polling features. Storefront recovery and reset-token invalidation are verified.
- [ ] Public Products/Shops/Home omit hidden/restricted/vacation/inactive content; variant choices, literal wildcard search, pagination/end/error and guest/private cache isolation match current APIs.
- [ ] Guest recency keeps only 12 ID/time hints, tolerates blocked/corrupt storage, records successful Product Detail only, filters stale Products and merges once after verified auth without copying account history to guest state.
- [ ] PSGC JSON manifest/hierarchy and Region→Province→City/Municipality→Barangay cascading work offline with manual fallback. Optional pin/GPS uses approved provider/adapter, clears stale coordinates and handles denial/failure/attribution without blocking text save.
- [ ] Profile/password/preference fields are allow-listed; current bearer survives account password change, other tokens are revoked, reset revokes all tokens; email remains read-only. Private avatar bytes cannot leak to another account/cache.
- [ ] Android/browser multipart uses `photo`/`image`, exact under-10-MiB limit and allowed types; cancel/permission/corruption/spoof/size/throttle/consent/storage failure and uncertain response reconciliation work; review partial photos are not duplicated blindly.
- [ ] Cart same-configuration merge/increment, separate variants, variation replacement/merge, server stock/visibility conflicts and unavailable lines work; uncertain additive writes do not auto-replay.
- [ ] Buy Now leaves Cart unchanged; selected Cart checkout creates atomic one-Order-per-Shop batches; address/serviceability/rate changes invalidate quotes; no provider selection or local payable calculation appears.
- [ ] Voucher UUID/targeting, one App per batch, per-benefit limits/reciprocal stacking, zero-saving redemption, caps/rounding and limited-capacity conflicts are verified; no wallet/claim/code-entry endpoint is assumed.
- [ ] Place response loss/timeouts and exact-key replay create one batch/reservation/redemption; changed payload/key conflicts, fresh quote review and process-death uncertainty follow documented limits.
- [ ] Owned Orders/tracking hide foreign data; status tabs/capabilities match server; maps remain unavailable; cancellation/address correction races with Seller processing, releases/snapshots and revision/idempotency work without refund promises.
- [ ] Shop/Logistics/Courier first send/reply/read/cursor flows work with live counterparts; channel identities/envelopes stay separate, unaccepted final-mile offers deny contact, ended custody/reassignment preserve scoped history and forbid sends.
- [ ] Messaging uncertain keys, 409/422/429, offline/focus/background recovery and older-history gaps preserve intended text without duplicates or falsely sent bubbles; private denial clears affected transcripts.
- [ ] Q&A read/ask is Product-visible and UUID-keyed; delivered-item Review create replays identical content, rejects changed repeat, maintains aggregate/official-response privacy and reconciles partial images.
- [ ] Customer notifications use actual page filters/destinations/read endpoints; missing global count/read-all/native push are not fabricated; promotion opt-in is default-off and separate from Terms/Privacy.
- [ ] Support create uses subject/category/body only; replies carry expected revision/key, reopen waiting/resolved cases, preserve uncertain draft and own history/read state without assignment/status powers.
- [ ] 320–390px phones, intermediate/wide browser and landscape/small height remain usable; 48px targets, TalkBack/text scaling, keyboard/Tab/focus, Android/browser Back, dialogs, soft keyboard, loading/empty/error, reduced motion and non-color status cues are verified.
- [ ] Open policy/privacy/backend gates in [integration gaps](references/integration-gaps.md) are reviewed, including message retention, upload hardening, rate/address correction and native map credentials. No mocked test or build is reported as live production certification.

Backend test references are in [source provenance](references/source-provenance.md). Running migrations/seeds, provisioning databases or changing backend/deployment configuration requires the owning authorized backend task; these are not automatic Flutter build steps.
