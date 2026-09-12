---
feature: logistics-courier-approval
title: Courier Application Review and Approval
system: AISLEY
type: Feature Specification
version: 1.1
status: Implemented (Phase 1): scoped review, private evidence, and atomic decisions
canonical: true
role: Logistics
scope: Laravel API and Logistics React dashboard
---

# Courier Application Review and Approval

## WHAT

- Let Logistics review Courier applications addressed to its organization and approve or reject them.
- Reuse existing affiliation decisions; do not introduce a second approval authority or registration flow.
- The backend lists pending applicants, exposes a scoped review projection and private evidence stream, and commits approval/rejection.
- The Logistics frontend provides protected pending-list and application-detail review screens.
- The list includes deterministic pagination, search, application status, and registration-readiness signals; detail includes submitted identity/contact, address, vehicle, and evidence metadata.
- Courier Auth continues to own registration, credential issuance, and mobile access gating.
- One Logistics account operates one organization and its sole hub; no staff/sub-hub model is introduced.
- Non-goals: task assignment, pickup approval, fleet editing, suspension/reactivation, reassignment of affiliation, and bulk decisions.
- Admin account lifecycle actions remain separate; Admin does not approve Courier affiliation.

```text
Courier registers under Logistics → pending affiliation
→ owning Logistics reviews application and available evidence
→ approve or reject transaction
→ Courier auth observes approved/active or rejected state
```

## MUST

### Authorization and scope

- Require existing Sanctum, active Logistics, and policy-consent middleware; preserve the configured web session/CSRF contract.
- Derive organization, sole hub, reviewer, Courier, and application from authenticated relationships.
- Cross-organization affiliation or document IDs return not-found without leaking identity or media.
- A same-email account in another role has no Logistics authority.
- Reject client-controlled status, reviewer, organization, hub, role, and approval timestamps.
- Subscription enforcement is deferred and must not become an approval prerequisite.
- Registration and image requirements come from the shared reference policies, not a duplicate local policy.

### Review and decisions

- Pending applications appear oldest first; completed decisions leave the pending queue.
- Detail shows submitted identity/contact, address, vehicle/plate, and document presence/preview status.
- Never substitute the Logistics hub address for the Courier's submitted address.
- Required ID/license and OR/CR evidence must be readable through authorized delivery before the UI claims document review is complete.
- Approval hardening rejects incomplete required registration records and preserves independent suspension/deactivation decisions.
- Approve sets affiliation/application to `approved` and Courier account to `active` in one transaction.
- Reject sets affiliation/application/account to `rejected`; require a meaningful reason of at most 2,000 characters.
- Store reviewer and server review time; approval clears the rejection reason.
- Lock and recheck pending affiliation inside the transaction; non-pending decisions conflict.
- Rejection is not task rejection and must not alter Orders, Inventory, existing delivery history, or custody.
- Do not add resubmission, reversal, revocation, or activation controls without their own lifecycle contract.

### Reliability, privacy, and communication

- Current approval mutations do not provide idempotency-key replay; repeated decisions return `409`.
- Disable repeated clicks; after timeout refetch instead of automatically resending or claiming success.
- Disappearance from the pending list proves only that it is no longer pending, not which decision committed.
- The detail read returns the recorded decision for reliable uncertain-result recovery.
- Private application/detail/media responses must use `Cache-Control: private, no-store`; harden the existing list too.
- Evidence stays in configured private storage; return authorized delivery paths, never raw object paths or credentials.
- Record safe sensitive-document access audit context without logging images, tokens, or full identity data.
- Current controller does not send approval/rejection notifications. Do not show “email sent” after its success response.
- Notification integration is a separate extension: persist durable work with the decision and deliver after commit.
- Communication failure must not reverse a committed decision or grant access to a rejected applicant.

### Logistics UI

- The Courier Applications navigation entry and protected pending-list/detail views are implemented in the existing React dashboard.
- Reuse the current API client, layout, consent handling, and design system; no new framework or Courier web UI.
- Show name/email, pending state, detail action, and explicit approve/reject confirmation.
- Rejection dialog includes a labelled reason, validation feedback, and cancel action.
- Evidence preview distinguishes missing, loading, forbidden, unavailable, and successfully loaded evidence.
- Never enable a fabricated evidence-preview link when the endpoint is unavailable.
- Keep loading, empty, request failure, conflict, and successful decision states distinct.
- Handle `403 POLICY_CONSENT_REQUIRED` without treating the session as invalid credentials.
- The screens support keyboard operation, focus restoration, accessible dialogs, text statuses, and mobile-width layouts.
- Clear private detail/media state on logout, account switch, or authorization loss.

### Acceptance criteria

- [x] Logistics can review only its organization's pending applications and authorized evidence.
- [x] Existing approval APIs are reused rather than duplicated.
- [x] Required-document completeness and account-lifecycle races are checked before approval.
- [x] Approval/rejection commits all related statuses, reviewer, and time atomically.
- [x] Duplicate/concurrent decisions cannot overwrite an earlier decision or independent suspension.
- [ ] Full browser timeout/offline automation is deferred; the UI times out, refetches the recorded detail, and does not claim a decision without the returned state.
- [x] Evidence and DTOs are private, no-store, scoped, and free of raw paths.
- [ ] Browser accessibility and interaction tests remain a verification follow-up; API behavior and production build checks pass.
- [x] No task, inventory, custody, or Admin lifecycle behavior is changed by this feature.

## HOW

### Existing API contract

| Method/path                                                         | Implemented behavior                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| GET `/api/v1/logistics/courier-applications`                        | Pending organization-scoped list with bounded `page`/`per_page`, optional name/email `search`, deterministic `(created_at,id)` order, readiness signals, and private no-store headers. |
| GET `/api/v1/logistics/courier-applications/{affiliation}`           | Organization-scoped detail projection with submitted Courier profile/address/vehicle, application/review outcome, completeness, and safe evidence metadata. |
| GET `/api/v1/logistics/courier-applications/{affiliation}/documents/{document}` | Authorized private inline evidence stream with configured-disk lookup, no-store headers, safe unavailable errors, and access log metadata. |
| POST `/api/v1/logistics/courier-applications/{affiliation}/approve` | Locks and rechecks the pending affiliation/application, validates required profile/address/active vehicle and ID-or-driver-license plus OR/CR evidence, then returns the approved detail projection. |
| POST `/api/v1/logistics/courier-applications/{affiliation}/reject`  | Requires a trimmed 3–2,000 character reason, atomically records the rejected affiliation/application and evidence, and returns the rejected detail projection. |

- List envelope: `{"data":[...],"links":{...},"meta":{...}}`; detail and decision envelopes use `{"data":{...}}`.
- Use the affiliation UUID, not Courier UUID, in decision URLs.
- Existing errors: `401` unauthenticated, `403` access/consent denial, `404` unknown/foreign affiliation, `409` non-pending, `422` reason validation.
- Decision conflicts expose machine codes such as `COURIER_APPLICATION_REVIEWED`, `COURIER_APPLICATION_INCOMPLETE`, and `COURIER_ACCOUNT_STATE_CONFLICT`; evidence failures use `EVIDENCE_UNAVAILABLE`.
- Handle infrastructure throttling/timeouts as failures, not empty lists or successful decisions.

### Deferred extensions

- Durable post-commit approval/rejection notifications are not implemented; the UI does not claim that email or push delivery occurred.
- Idempotency-key replay, resubmission, reversal, revocation, and automatic re-offer remain separate lifecycle work.
- Browser-level accessibility, offline, and concurrency automation remains a verification follow-up; API requests fail safely and refetch on decision timeout.
- No additive migration was required because the existing affiliation, application, document, profile, address, and vehicle records represent the Phase 1 workflow.

### Implementation and verification

- Inspect `CourierApprovalController`, Courier registration relationships, Logistics middleware, and existing approval tests first.
- Implemented detail/media authorization and completeness/lifecycle hardening before enabling the review workflow.
- Read `docs/design.md` before building the Logistics UI; follow the repository frontend rules.
- Test wrong role, cross-organization IDs, foreign documents, inactive Logistics, and missing relationships.
- Test both decisions, missing/oversized reason, duplicate requests, concurrent review, and independent account suspension.
- Test private media headers, absent documents, unavailable storage, and no status mutation from preview.
- Focused API coverage passes 7 tests/77 assertions, including scope, missing relationships, evidence privacy/unavailability, decisions, conflicts, and lifecycle preservation.
- Logistics TypeScript production build and oxlint checks pass.
- PostgreSQL concurrency verification and browser interaction testing remain separate follow-ups.
- Append actual results to `docs/PROGRESS.md`; do not mark deferred criteria complete from this document alone.

### References and deferred work

- `docs/features/courier/auth/spec.md` owns Courier registration/auth and documents the existing approval APIs.
- `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, and `docs/domains/Logistics.md` define shared authority.
- `docs/references/user-registration-requirements.md` and `docs/references/file-upload-requirements.md` are mandatory.
- Notification channels, long-term evidence retention, resubmission, and approval reversal remain separately specified extensions.
