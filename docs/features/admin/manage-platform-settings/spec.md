---
feature: manage-platform-settings
title: Admin Manage Platform Settings
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Manage Platform Settings

## WHAT

- Authorized Admins manage platform announcements and the allow-listed policies: Terms of Service, Privacy Policy, and Internal Platform Rules.
- The Admin React dashboard owns the editor, preview, confirmation, history, and error states. Laravel owns authorization, validation, versioning, persistence, cache invalidation, and audit records.
- Policy content is versioned. A published version is immutable; Admins may still choose Edit, which creates a copied successor Draft rather than changing the published record.
- Ordinary user policy views show only the current published version. A separate history view lets an authorized user read prior published/superseded versions.
- Announcements are separate from Push Notification Management. Publishing an announcement does not imply push, SMS, or email delivery.
- This feature does not manage secrets, `.env`, infrastructure, arbitrary key/value settings, feature flags, policy-writing/legal advice, or targeted campaigns.

## MUST

### Access and boundaries

- Every Admin endpoint requires `auth:sanctum`, persisted `ADMIN` role, and `platform-settings.manage` permission where custom permissions apply.
- Laravel is authoritative; hiding an Admin control in React is never authorization.
- Return `401`, `403`, `404`, `409`, or `422` consistently for authentication, permission, missing resource, stale state, and validation failures.
- Platform Settings may modify only supported domain records; no API may expose arbitrary runtime configuration or secrets.

### Announcements

- Support `DRAFT → PUBLISHED → ARCHIVED`; only a Draft can be updated or published, and only a Published announcement can be archived.
- Store UUID, title, body, status, revision, creator/updater, timestamps, optional publication and expiry times.
- Validate and safely render content. Use plain text/Markdown unless an approved server-side rich-content sanitizer exists.
- User-facing reads return only currently active Published announcements; drafts, archives, and expired records are excluded by Laravel.
- Publish/archive must invalidate the active-announcement cache after the transaction commits and emit an audit record.

### Policy identities and versions

- Policy types are server allow-listed: `terms_of_service`, `privacy_policy`, and `internal_rules`.
- Maintain one stable policy identity per type and ordered version records with UUID, integer version, title, content, status, revision, creator, publisher, timestamps, and `requires_reconsent`.
- A policy version lifecycle is `DRAFT → PUBLISHED → SUPERSEDED`. Exactly one current Published version may exist for a policy type.
- Published and Superseded content is immutable. It must never be overwritten, deleted, or relabeled as a correction.
- A new Draft receives the next version number. Optional `source_policy_version_id` records which published version it copied; optional user-safe `change_summary` may be shown in history.

### Editing a published policy

- The Admin UI may show **Edit** on the current Published version.
- Edit calls a successor-Draft action; it must lock the policy and selected published version, copy title/content/re-consent settings, assign the next version number, and record the source/version creator.
- The source Published version, its exact content, acceptance records, publication metadata, and audit history remain unchanged.
- The response returns the new Draft ID; all ordinary editing uses that Draft ID. Saving the Draft does not change user-facing policy content.
- If a successor Draft already exists for the same policy/source lineage, return that Draft or `409`; do not create competing successor copies.
- Only Draft versions accept `PATCH`; updates require the submitted revision and increment it atomically.
- Audit successor creation, Draft update, and publication as distinct actions.

### Publishing and concurrency

- Publishing requires an explicit confirmation and submitted Draft revision.
- In one database transaction, lock the Draft and policy, reject stale/non-Draft state, publish the Draft, supersede the former current version, set `current_version_id`, and persist publisher/time/re-consent choice.
- Concurrent create-successor, update, or publish attempts must not create two current versions or overwrite newer content; return `409` and refetch current state.
- Invalidate the current-policy cache only after a successful commit. Any notification/broadcast is queued after commit and cannot roll back publication.

### User policy views and consent

- The default policy endpoint/page returns only the current Published version; it must not render all versions inline.
- A separate history endpoint/page lists and renders exact Published/Superseded versions only, with version, title, publication/effective date, current/superseded state, and optional safe change summary.
- History never exposes Drafts, Admin-only metadata, internal notes, or audit data. Internal Rules remain limited to their authorized audience.
- Terms and Privacy may be public if the product visibility decision permits; otherwise use the project’s authenticated policy route.
- `requires_reconsent` belongs to a specific Published version. A user acceptance must store `user_id`, `policy_version_id`, and server `accepted_at` with a unique user/version constraint.
- Never silently mark a user accepted or synchronously update every user row on policy publication. Determine outstanding consent by comparing the current required version with exact acceptances.
- The blocking point for required consent (login, session restoration, or protected feature entry) remains an explicit integration decision; Platform Settings does not fabricate acceptance.

### APIs and UI

- Admin APIs follow `/api/v1/admin/platform-settings` conventions:

```http
GET   /announcements
POST  /announcements
PATCH /announcements/{announcement}
POST  /announcements/{announcement}/publish
POST  /announcements/{announcement}/archive
GET   /policies
POST  /policies/{type}/versions
POST  /policy-versions/{version}/successor
PATCH /policy-versions/{version}
POST  /policy-versions/{version}/publish
```

- User APIs expose current policy content and, when authorized, version history and an exact history entry. They return published-safe DTOs only.
- The Admin policy screen shows the current version, a New version action, Edit-to-successor action, Draft editor, Publish confirmation, re-consent checkbox, and version history.
- The user experience distinguishes “Edit published policy — creates a new draft” from editing a Draft.
- Forms require labels, keyboard operation, visible focus, associated validation messages, non-color-only status, loading/error/retry states, and no optimistic publish result.

### Acceptance criteria

- [ ] Guests, non-Admins, and Admins without permission cannot mutate Platform Settings.
- [ ] Admin can create, edit, publish, archive, and safely render an announcement; only active Published announcements reach users.
- [ ] Admin can create a policy Draft and publish it as the sole current version.
- [ ] Edit on a Published policy creates a copied successor Draft; the source row remains byte-for-byte unchanged.
- [ ] Updating or abandoning a successor Draft does not change the current user-facing policy.
- [ ] Publishing a successor supersedes the former current version atomically and preserves exact historical content.
- [ ] Stale/concurrent successor, Draft-update, and publish attempts return `409` without corrupting version state.
- [ ] User default view returns only the current policy; history excludes Drafts and renders a selected historical version exactly.
- [ ] Re-consent and acceptance reference the exact policy version; users are never auto-accepted.
- [ ] Administrative mutations create safe audit entries and invalidate relevant caches after commit.

## HOW

- Reuse `PlatformPolicy`, `PlatformPolicyVersion`, `PolicyAcceptance`, `Announcement`, their enum casts, UUID migrations, `PlatformSettingsService`, Admin Form Requests/Resources, and the shared Admin API client.
- Add an additive migration for successor lineage/change summary only if those fields are adopted; keep enum-like database columns as strings and Eloquent enum casts.
- Implement successor creation in `PlatformSettingsService` with `DB::transaction()` and `lockForUpdate()` on the policy/version. Add a service/controller route, authorization, request validation, resource projection, and audit action.
- Keep existing Draft-only update and publish paths, but update the Admin page so Published Edit creates/opens a successor Draft. Do not change a Published version through `PATCH`.
- Add current/history user resources and routes that enforce policy-type visibility and exclude Draft/Admin data. Cache only current Published policy payloads.
- Test Laravel authorization, allow-listing, immutable source, copied successor data, single-current invariant, stale revision conflicts, history visibility, exact acceptance, cache invalidation, and audit records.
- Test the Admin UI’s successor-edit flow, Draft/publish states, conflict recovery, latest-only user view, history selection, and keyboard/error accessibility.
- Roll out only after the user-facing policy/consent integration identifies who may see Internal Rules and where required re-consent blocks access.

### Open questions

- Are Terms and Privacy public, authenticated-only, or role-specific?
- Should a successor Draft be returned or rejected when another Admin already created one?
- Who decides whether a change requires re-consent, and is second-Admin approval required before publication?
- What user-facing change-summary format and policy notification channel are desired?

### Sources

- Project: `docs/requirements.md`, `docs/architecture.md`, existing Platform Settings models/service/routes/tests.
- [Laravel database locking and transactions](https://laravel.com/framework/docs/13.x/queries)
- [Laravel queued work after database commit](https://laravel.com/framework/docs/12.x/queues)
- [OWASP policy change-history guidance](https://owasp.org/www-project-top-10-privacy-risks/OWASP_Top_10_Privacy_Risks_Countermeasures_v2.0.pdf)
