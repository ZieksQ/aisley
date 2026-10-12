# Documentation validation record

Original baseline validation, 2026-10-03: checked 44 Markdown files, 268 portable local links, 192 endpoint references, 23 feature specs and 196 source paths/hashes. Backend baseline: `7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0`. These are historical baseline checks, separate from all pending [Flutter acceptance](../verification.md).

- Read-only Laravel route enumeration established 95 relevant implemented route records, including Customer, public Product/media, shared policy/platform and auxiliary address-options routes. Inventory methods and composed middleware derive from that output.
- Local Markdown link/path checks cover every Markdown file, including all 23 feature specifications. All relative links remain inside the portable bundle; source locators are code-formatted upstream references.
- Feature coverage matches all 19 canonical Customer spec directory names, with additional notification, Logistics/Courier messaging and shared-policy specs. Every feature is explicitly Flutter pending with unchecked acceptance.
- Validated every explicit method/path reference against enumerated routes and every manifest source path against the checkout. Reviewed DTO/request casing/envelopes and source differences: Q&A question, support body, photo/image parts, Shop sequence versus operational last_read_sequence, mine message flag, current token/recovery effects and shipping/address correction gap.
- Reviewed role boundaries: no Buyer call to Courier task/operational APIs, approvals, evidence/vehicle/cash operations or other-role mutation routes. References to Courier practices grant no operational permission or inherited implementation completion.
- Reviewed local-web/native boundaries: fixed Buyer 8766 versus Courier 8765, exact-origin CORS/header gaps, bearer versus storefront cookies, browser file bytes/native adapters, secure-storage failures and Dart PSGC/map adaptation.
- Scanned for checked implementation boxes, conflict markers, trailing whitespace and accidental scaffold/dependency/backend changes. At the original location under docs/cabigan, the bundle was ignored and only the required app-wide Progress entry was tracked/committed. Commit `c5ce0cc` subsequently relocated and tracked it at `docs/docs-mobile-buyer/`; the docs/cabigan ignore policy is unchanged.

No Flutter repository/scaffold was created, and no application/API tests, builds, live endpoint exchange, migrations, seeds, dependencies, native capture or installed-device/browser acceptance ran. Backend/source test inspection and route listing establish contract evidence only. Tests and release gates in verification.md and the integration register remain pending.

## Agent and Customer-rule revision — 2026-10-03

- Expanded [Buyer agent instructions](../AGENTS.md) using the Courier guide's structure, with Customer-specific authentication, consent, shopping, privacy and verification boundaries.
- Added [Customer specification rules](../features/customer/rule.md). New/revised Customer specs, including authentication, require WHAT/MUST/HOW and 200–230 physical lines, explicitly overriding the feature-spec skill's shorter preference. Dart source thresholds and shared-policy specs remain separate.
- Checked 291 portable Markdown links across 45 documents and 19 required destination `docs/...` paths in the root-copy agent instructions. Archive filename templates describe future files and are not required to exist yet.
- Reviewed instruction sections, rule precedence, Customer authority and pending/unchecked mobile acceptance. All 19 canonical Customer areas remain covered by 22 Customer specs plus one shared-policy spec. Existing 40–47-line Customer baselines were preserved; they are not certified ready under the new specification rule.
- Confirmed relocation/tracking at `docs/docs-mobile-buyer/`, preserved original progress history and the existing docs/cabigan ignore policy, and checked the documentation diff for whitespace/conflict markers and unrelated changes.

These revision checks do not rerun the original route enumeration or source-hash audit. Existing Customer auth routes/controller were inspected to cross-check bearer login and revocation wording; no application tests, Flutter builds, device/browser acceptance or live API checks ran.

## Standalone handoff revision — 2026-10-03

New inspection checkout: `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`, captured before editing. The original baseline and its provenance manifest remain unchanged; [current inspection hashes](source-inspection.json) record 131 separately inspected source files.

- All 22 Customer specs contain WHAT/MUST/HOW and 210–217 physical lines. The validator preserved each pre-existing unchecked acceptance requirement and verified canonical feature coverage; shared consent has equivalent contract detail without the line limit.
- Copied the complete bundle into an isolated repository-local Flutter-style docs/ layout and copied its agent instructions to root. Checked local Markdown destinations/anchors and every concrete root-instruction docs path with no monorepo files in the simulated destination.
- Validated 95 distinct operation methods/paths against the captured 95-route inventory, with no other-role route consumption. Parsed all JSON documents; checked 107 named model references and nested successful response fixtures, and ensured each operation's fixture agrees with the machine-readable inventory.
- Compared all 19 bundled PSGC files byte for byte with their source and checked SHA-256/size manifests, eighteen index targets, ten-digit string codes and recursively nested children. All assets resolve after standalone copying.
- Reviewed exact request casing, ownership/consent, status/envelopes, nullable/omitted fields, channel-specific paging/read fields and replay boundaries against current Laravel source. Support cursor traversal uses the framework request resolver; no unavailable-cursor API claim remains.
- Inspected official Flutter release/package metadata for the concrete SDK and ten package pins; recorded constraints and checksums in [package baseline](package-baseline.json). Direct constraints accept the selected SDK; transitive resolution and target builds were not executed.
- Preserved historical provenance, documentation-validation and progress prefixes and all existing archive bytes. Reviewed synthetic fixture identifiers/contact/text/secret placeholders, conflict markers, completion states and documentation-only scope; whitespace checks passed.

The final machine-readable [check summary](standalone-validation.json) records the actual link/file counts and zero validation errors. These checks cover document portability and fixture consistency, not executable Dart DTOs or a live API. No Flutter scaffold, dependency installation/resolution, analyzer, unit/widget/integration tests, Android/web builds, backend tests, migrations, seeds, live exchange or installed-device acceptance ran. Open integration gates and all Flutter completion criteria remain pending.

> Imported external Buyer Flutter results follow. “This repository” below means the external Flutter project; these commands were not rerun here.

## Registration fixture and project SDK correction — 2026-10-04

The backend contract baseline remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; no backend source or live exchange was revalidated. Historical validation entries above are unchanged.

- Corrected both synthetic registration operation copies to HTTP 201, pending Customer and no token. Returned profile values match the synthetic request; nullable middle name/photo path remain null. JSON/semantic checks confirm duplicate agreement and unchanged non-registration operations, including active successful login.
- Verified the installed Flutter 3.47.2 stable / Dart 3.13.2 and revision `d3b14c876900e553bc736ca19295fc09e3853e8e` with `flutter --version --machine`. Setup now preserves the existing `^3.13.2` constraint. The old SDK metadata and unchanged ten package metadata records remain historical evidence in [package baseline](package-baseline.json).
- Executed `flutter pub get --enforce-lockfile` in this repository: exit 0; existing dependencies resolved without tracked manifest/lockfile changes. Executed `flutter analyze --no-pub`: exit 0, no issues found in the existing counter scaffold.
- Executed `flutter pub get` in an isolated temporary manifest with the project SDK constraint, all ten documented exact pins, scaffold Cupertino icons and Flutter test/lint dependencies: exit 0; 126 packages resolved. Checked all ten locked pin versions. The manifest and lockfile hash are recorded in [package baseline](package-baseline.json); no feature packages were added to this application.
- The initial sandboxed Flutter command could not write its SDK cache; subsequent commands passed with approved cache access. Parsed all documentation JSON and checked whitespace, duplicated fixtures, SDK agreement and unchanged tracked application files.

No feature-code analysis, Flutter tests, Android/web builds, installed-device/browser checks or live API acceptance ran. These dependency/scaffold checks do not complete any Buyer feature or resolve remaining storage, plugin runtime, deployment or release gates.

## Selective platform synchronization — 2026-10-04

Current Laravel inspection `22b0a48f9575ead182d03c35ab87345711c23b90` is separate from reported external Buyer adoption `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`. Imported Phase 1–5/responsive evidence and SDK/package resolution were not rerun here; those report texts and earlier validation history remain preserved.

- Copied Buyer and Courier bundles into isolated repository-local `docs/` layouts. Validated relative Markdown destinations/anchors, Buyer root-copy instruction paths, JSON parsing, evidence references and preserved Courier instructions. Courier AGENTS.md retains its README’s historical content/link exclusion; byte preservation was checked.
- Checked all 22 Customer specs use WHAT/MUST/HOW, remain 200–230 lines and retain historical acceptance requirements except the explicit account-only recency revision. Imported checks complete only their evidenced adopted-baseline criteria; current shipping parsing/operation criteria are reopened under G25.
- Compared 96 operation method/path pairs with actual current route enumeration; preserved existing IDs, assigned op-096, checked middleware and current Requests/Resources/source hashes. Validated 111 named nested types, required/nullable fields and all duplicated fixtures, pending/no-token/request-consistent registration and unchanged active login.
- Reviewed snake_case selections, serviceable versus unplanned, nullable legacy provider fields, quote/placement hashing, exact-key replay and internal route failures versus client errors. Nineteen synthetic shipping scenarios supply expected contracts; they are not executed client/backend tests.
- Checked all 19 PSGC manifest/hash/size records against unchanged tracked bytes, historical manifests/validation/progress prefixes, existing archive bytes, root instructions and unchanged Courier role contracts/client guides. Recorded snapshot/report provenance separately. Reviewed whitespace, privacy, contradictory provider/status wording and documentation-only scope.

[Machine-readable results](sync-validation.json) report actual counts and limits. No application/Flutter/backend tests, SDK/dependency resolution, builds, authenticated API calls, browser/device or deployment acceptance ran in this checkout. G25 and controlled authenticated, installed-device, accessibility, signing and deployment gates remain open.

## Selective client-evidence synchronization — 2026-10-07

[Current check record](synchronization-2026-10-07.md) and [machine-readable results](sync-validation-2026-10-07.json) cover independent temporary Buyer/Courier copies with no monorepo source dependencies. Buyer validation checks links/anchors, 22 Customer specs (215–230 lines), 103 operation/route/duplicate fixtures, 112 named DTOs, 701 wire fields, successful nested examples and 19 synthetic shipping scenarios. All 19 PSGC asset hashes/source bytes and ten screenshot hashes/viewports are preserved. Courier validation checks its own routes/examples and 12 non-draft specs (203–230 lines); unrelated Incident/Profit drafts stay unchanged.

The complete 161-line Buyer history was archived with its original prefix intact; forwarding pages preserve old relative evidence links. Existing archives, Cabigan files and root/Courier agent instructions remain byte-identical. The Buyer guide receives only a scoped PSGC instruction clarification. Historical source manifests/reports and original validation records remain unchanged. Reviewed Laravel a946692 is separate from adopted Buyer 57e9eb2/Courier d7df220; provider/media adoption and historical checkout resolution remain unverified.

These are documentation checks and read-only route/source inspection. No Flutter/backend/application tests, dependency resolution, build, authenticated request, browser/device/accessibility/signing/production acceptance, migration or deployment repair ran here. Externally reported tests/builds/screenshots retain their dates and attribution.
