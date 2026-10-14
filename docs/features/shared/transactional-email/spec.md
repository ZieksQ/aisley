---
feature: transactional-email
title: Transactional SMTP Email
system: AISLEY
version: 1.1
status: Implemented; live provider and PostgreSQL concurrency acceptance outstanding
scope: Laravel API, database queue, and scheduler
---

# Transactional SMTP Email

## WHAT

- Deliver Customer, Seller, and Logistics password resets and Customer/Seller/Logistics Admin registration decisions through Laravel's configured mailer.
- Deliver Courier approval/rejection emails from the associated Logistics review workflow. Courier sign-in remains mobile-only.
- Use the existing eight `MAIL_*` settings; no provider SDK, mail-hosting service, new public endpoint, or frontend setting is introduced.
- Deliver authenticated password-edit verification codes for Customer, Seller, Logistics and Courier under the [verification contract](../../../references/password-change-verification.md).
- Admin/Courier recovery, other verification, marketing, order alerts, and general in-app notifications retain their existing boundaries.

## MUST

- Persist one encrypted email intent alongside each new role-scoped reset token or registration decision in the same database transaction. Rollback removes both; dispatch starts only after the outer commit.
- Admin still reviews Customer/Seller/Logistics; the owning Logistics organization still reviews Couriers. Existing Sanctum, approval, tenant, role, consent, and conflict checks apply before creating an intent.
- Preserve generic recovery acknowledgements, throttling, hashed role-scoped tokens, single use, expiration, and token revocation. Serialize reset creation/completion using the same User-before-token lock order.
- Encrypt recipients, reset secrets, and rejection content at rest. Queue jobs are encrypted and contain only the intent ID. Never log message content, raw transport exceptions, SMTP credentials, or reset secrets.
- Recheck recipient identity and role immediately before delivery. Skip reset mail for inactive accounts or expired, consumed, superseded tokens. Skip decisions whose application/user/role/outcome no longer matches.
- One application/decision key owns one intent. Row locks and claim tokens prevent overlapping live delivery and stale-worker finalization; no email retry may execute approval or reset completion again.
- Clear encrypted payload after accepted/skipped delivery. Failed payload stays encrypted for operator retry. Outbox metadata is private internal state, never a role API projection.
- Preserve applicant-visible rejection reasons without exposing evidence paths, reviewer information, credentials, or internal notes.
- Queue/SMTP failure never reverses a committed approval/rejection, changes access gating, or turns a generic reset acknowledgement into an account-existence response.
- SMTP acceptance does not prove inbox delivery or reading. Ambiguous transport acceptance followed by a crash can cause duplicate email; SMTP provides no exactly-once guarantee.

## HOW

- Add `transactional_emails` using an additive migration, string-backed Kind/Role/Status enums, encrypted payload, unique deduplication key, attempts, retry timestamp, and expiring claim metadata.
- Dispatch encrypted `DeliverTransactionalEmail` jobs on the existing `database` queue connection. Delivery owns the Laravel mail notification through `sendNow`; no nested notification job is created.
- States: `pending → queued → sending → accepted | skipped`; delivery failure returns to `pending`, then becomes `failed` after five attempts. Never replay terminal accepted/skipped rows.
- Retry waits: 60, 120, 300, and 600 seconds, plus scheduler cadence. Worker job timeout is 60 seconds, SMTP stream timeout 20 seconds, live-send lease two minutes, queue reservation five minutes.
- The minute scheduler recovers due pending work and expired queued/sending claims. Queue dispatch failures retain durable work and retry after one minute. Crashed send attempts consume their recorded attempt budget.
- `mail:status` shows bounded safe metadata, `mail:dispatch-pending` recovers work, and `mail:retry {id}` reopens only exhausted delivery. Manual retry revalidates identity/token/application and may skip obsolete work.
- SMTP settings, worker startup, deployment ordering, diagnostics, and isolated test commands are in [SMTP operating instructions](../../../references/smtp-email.md).

## Verification

- Focused tests cover actual encrypted queue consumption using synthetic array transport, sender/recipient/rendered role links, both decisions for four roles, same-email isolation, generic outages, token invalidation, rollback/outer commit, failed retries, queue recovery, live-claim exclusion, and stale-claim protection.
- Adjacent auth/registration/approval tests retain role, approval, evidence, API-response, and single-use coverage. Tests use a bootstrap that skips Dotenv/config caches and owns disposable storage.
- Real SMTP provider delivery, deployed worker/scheduler readiness, and PostgreSQL process concurrency require operator acceptance. Backend email implementation does not establish Flutter adoption or device acceptance.
