# Three-project documentation audit — 2026-10-12

## Source baselines

| Project | Inspected source commit |
| --- | --- |
| AISLEY platform | `240eefddd4e2e2eea2f9558beec0292efa2121fe` |
| Courier Flutter (`aisley_app`) | `177eac1d1d132916cef25054cfc959e223fa409c` |
| Buyer Flutter (`aisley_mobile_buyer`) | `7924cf06158817a2dcd709ec19a7442e3496dda5` |

The initial shared-copy comparison found 24 differing Courier documents and 69 differing Buyer documents. Differences included newer backend contracts on the platform side and newer implementation/evidence on the client side. Documentation was reconciled against current routes, Requests/Resources/services and client models/repositories/controllers, plus committed manifests/scripts. Existing test reports were inspected as historical evidence.

## Reconciled state

- Courier implements Auth v2.6 handling, targeted notification navigation, reference-filtered history, read-only MapLibre routes, failed attempts, dashboard v2/default-v1 fallback, image chat and received MP4/documents. Recovery UI and linehaul screens remain unadopted.
- Buyer implements shipping choices/frozen intent, collection/wallet, Order/Checkout thumbnails, image chat and received MP4/documents. Candidate voucher names use code fallback, but applied/Batch names and same-benefit replacement remain unadopted. Order coordinate parsing and the new Shop-context read/availability field also remain unadopted.
- Current Laravel implements contact-only Order correction at the same location/pin (B02), bounded profile-image decode/rewrite (B04), approved-origin Retry-After exposure (B05), and legacy Shop-shipping funding guards (B06). These contracts are synchronized without changing applications or deployment.
- Canonical Courier specs and messaging/domain summaries reflect actual client adoption. Portable Buyer responsibility notes now name existing controllers/repositories rather than unimplemented blueprint ViewModels.
- The stale Cart API-absent claim and draft-only statuses for implemented Admin foundations/Seller approval/notifications are corrected. Current Admin authentication paths and frozen-provider Seller pickup behavior are explicit; deferred extensions and unchecked criteria remain open.
- Root/component READMEs describe actual apps, pnpm/Composer scripts, API-origin settings and session/bearer boundaries. Framework-template text was replaced.

The [Courier record](../docs-flutter-rider/references/synchronization-2026-10-12.md) and [Buyer record](../docs-mobile-buyer/references/synchronization-2026-10-12.md) provide standalone source/route/evidence details. Both portable documentation trees match their client copies; repository-root setup and instructions remain project-specific.

## Validation and history

Read-only Laravel `route:list --path=api/v1 --json` enumerated 565 route records. The Buyer operation index now contains 111 unique operations, including current Shop context. Scoped route snapshots preserve current methods/middleware without replacing dated snapshots.

Checks cover portable links/anchors, JSON and duplicate operation examples, 44 named successful DTO fixtures/1,045 typed values, all 111 Buyer operation methods/paths against current routes, 22 Buyer and 12 implementation-ready Courier specs at 200–230 lines, original progress prefixes, existing archive bytes, PSGC checksums and whitespace. The two unchanged Courier Incident/Profit drafts remain explicitly deferred and outside that spec certification.

Complete platform/client role progress histories are preserved in separately attributed archives before fresh status summaries. Existing archives remain unchanged. Conflicting platform verification/package-baseline reports are preserved alongside the current client records; original dated test/build/live results retain their execution scope. See the [Courier machine record](../docs-flutter-rider/references/sync-validation-2026-10-12.json) and [Buyer machine record](../docs-mobile-buyer/references/sync-validation-2026-10-12.json).

The existing Buyer documentation validator passes. Its separately run pre-change unit suite had three passes and one failure: the ordinary-log negative fixture resolves through pre-existing `logs/references/` forwarding pages, contrary to the test's missing-link expectation. This pre-existing tooling mismatch is recorded without source/tool changes.

No Flutter/API application tests, builds, live authenticated commerce/media/provider exchanges, migrations/seeds, deployment or installed-device checks were rerun. Deployed revision, media storage/worker/scanner readiness, installed Android/TalkBack, and Buyer production provider/signing gates remain open.
