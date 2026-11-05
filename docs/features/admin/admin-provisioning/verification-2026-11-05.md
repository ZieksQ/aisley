# Admin provisioning verification — 2026-11-05

## Implemented behavior

Admin Accounts and Custom Roles support account creation/profile and access editing, live roles plus direct grants, granular suspend/restore/archive permissions, protected initial super-admin bootstrap and super-admin-only promotion. API authorization, projections, notification recipients, support assignees and dashboard reads use effective authority. Management mutations recheck credentials/authority/revisions under a shared database lock and have an independent ten-per-minute actor quota.

New admins must change their temporary password and verify email with OTP. Changed email requires OTP without another password change. The initial bootstrap and existing admins retain their previous setup state. Setup precedes policy consent and operational access, including direct API calls. OTP delivery uses the encrypted transactional outbox; codes are hashed, identity/password bound, throttled and single-use. Lifecycle and setup transitions invalidate older sessions.

## Automated evidence

- Focused isolated SQLite suites: **30 tests, 216 assertions passed** across AdminProvisioningTest, AdminProvisioningSecurityTest, AdminAuthenticationTest and AdminAccountManagementTest. Coverage includes creation, dependencies, grant limits, role propagation, indirect escalation, initial/super-admin protection, duplicate identities, revisions, lifecycle actions, email-only setup, session preservation/revocation, wrong/expired/superseded/replayed/cross-account codes, resend/hour limits, successful/failed mail and retained role audit history.
- Broader isolated Admin/Mail/Voucher sweep at the preceding checkpoint: **239 passed, 9 skipped, 1 failed** (249 tests, 2,319 assertions). The remaining failure is SellerComplianceTest::test_warning_restriction_revocation_and_closure_are_immutable_and_idempotent: its unchanged checkout fixture lacks the address pin now required by the preceding address-pin feature (expected 409, actual 422). No Seller checkout/compliance behavior or fixture was changed for this task. Later edits were covered by the focused rerun above.
- Real PostgreSQL lock contention: **3 tests, 26 assertions passed** in PostgresAdminProvisioningConcurrencyTest. Confirmed actual waiting locks for competing OTP completions, permission revocation versus waiting account creation, and revision-bound role edits. A uniquely named disposable database/restricted role was created and removed; application data was not migrated or seeded.
- Admin TypeScript build, production Vite build, Oxlint, scoped Pint and whitespace checks passed. Vite retains the existing large-bundle warning. Package-manager startup attempted a read-only external store lock, so validation used the installed package binaries directly; no dependency was added.
- Synthetic real Chromium: **32 viewport/theme combinations** at 320/390/768/1440px across account list/create, roles and standalone setup. Exercised create/edit, role read dependencies/inheritance, suspend/restore, unsaved-link confirmation, Escape/focus restoration, live privilege revocation, read-error/empty recovery, first-login redirect with no operational requests, OTP cooldown/error recovery/completion, email-only verification and policy-consent ordering. No live accounts, mutations or email were used.
- Browser smoke: `node src/admin/tests/admin-provisioning-browser.smoke.mjs` from the repository root, with Admin Vite at localhost:15175 and ChromeDriver at localhost:19515. It uses installed Chromium and Node; no browser library dependency. Artifacts: `node_modules/.cache/admin-provisioning-browser/` (16 phone/desktop screenshots, four review sheets and a Taste report). All final review sheets were inspected.
- Taste source lint: 0 failures, 0 warnings. Authenticated DOM probe/judge checks at 390/768/1440px in both themes: 0 failures, six warnings after documented brand (`palette-purple`) and synthetic fixture email (`placeholder-data`) allowances. Four desktop warnings describe honest short lists with one fixture row; two describe spacing around form legends. Setup has no remaining findings. Duplicate headings, invisible standalone setup boundaries and cramped phone filters were corrected. No shared shell redesign was introduced.

## Design review

ROUND 3

Seen in one second: AISLEY Admin account and role administration, with explicit create actions and a separate setup gate.

Idea (one sentence): Show who can access the marketplace administration and which grants provide that access.

Live thing: API-backed account/role forms and status actions; the browser evidence uses synthetic HTTP contracts.

Layout words by section: shell=existing portal navigation / accounts=filters and operational table / account=identity and access fieldsets / roles=table and editor / setup=single focused form.

Scores: design 7.5 · usability 8 · creativity 7 · content 8 → overall 7.6.

Caps applied: Public marketing imagery/motion criteria do not apply to these operational screens; docs/design.md governs the established palette, controls and shell.

Top three problems (most visible first), each with the screenshot it shows in and the fix:

1. `setup-dark-390.png`: controls originally lacked portal token scope. Fixed with the standalone portal root, retaining no operational navigation.
2. `admin-accounts-dark-390.png`: the original filter labels and fields crowded one line. Fixed with the shared field and responsive filter grid.
3. `admin-accounts-new-light-1440.png`: fieldset legends retain modest extra spacing (inspector warning). Retained readable grouping; no unrelated shared CSS changes. One-row table fixtures also leave honest unused canvas rather than invented records.

## Deployment and limits

Apply the additive migration, then targeted AdminPermissionSeeder/InitialAdminSeeder before exposing these screens. See the [feature contract](spec.md) for exact commands and bootstrap identity behavior. Queue worker and scheduler must be running. No live migration, bootstrap reconciliation, inbox delivery, deployed cookie/CSRF check, assistive-technology acceptance or external Flutter adoption is claimed. OTP is onboarding/email verification, not recurring MFA. Admin recovery and manager-triggered password resets remain outside this feature.

The shared workspace acquired separate landing-page changes and switched its active branch while this task was running. The Admin feature is committed from an isolated worktree on feature/admin-account-provisioning; unrelated landing files and their working branch are preserved.
