# SMTP email operations

Laravel sends transactional email through an external SMTP service. Configure the existing deployment environment; repository implementation/testing does not open or modify any `.env` file.

| Variable | Value supplied by the operator |
| --- | --- |
| `MAIL_MAILER` | `smtp` for external delivery; `array` for isolated tests; `log` is local diagnostic output only |
| `MAIL_SCHEME` | `smtp` for provider-supported STARTTLS (commonly port 587), or `smtps` for implicit TLS (commonly port 465) |
| `MAIL_HOST` | SMTP provider hostname |
| `MAIL_PORT` | Provider SMTP port |
| `MAIL_USERNAME` | Provider authentication username |
| `MAIL_PASSWORD` | Provider authentication password/app password |
| `MAIL_FROM_ADDRESS` | Sender address authorized by the provider |
| `MAIL_FROM_NAME` | Sender display name, such as `Aisley` |

No extra SMTP variable is required. An unset/blank scheme lets Laravel infer implicit TLS on port 465 and SMTP otherwise; STARTTLS is negotiated when supported. A blank mailer keeps the existing local `log` default. Do not use the log mailer for real recovery: it writes email content, including reset URLs, to the configured log rather than delivering it. The legacy optional `MAIL_URL` remains compatible; leave it unset when configuring the eight individual settings. An empty URL is treated as absent.

Password-reset destinations remain the existing server-side `CUSTOMER_PASSWORD_RESET_URL`, `SELLER_PASSWORD_RESET_URL`, and `LOGISTICS_PASSWORD_RESET_URL` settings. Set trusted HTTPS storefront/portal URLs in production; localhost defaults serve development. Keep existing role-specific expiry/throttle settings. SMTP settings do not create mobile deep links or new reset routes.

## Deployment

Run all commands from the repository root. Through the normal release process, apply migrations before starting the updated API/worker/scheduler:

```sh
php src/api/artisan migrate --force
php src/api/artisan config:cache
php src/api/artisan queue:restart
```

The new table is required before updated auth/review code accepts requests. Apply it while traffic is paused or before switching application versions. No old registration decisions are automatically backfilled or resent.

The existing `pnpm dev` launcher and production queue/scheduler services already process the default database queue and minute scheduler. Manual equivalents are:

```sh
php src/api/artisan queue:work database --sleep=3 --tries=5 --timeout=60
php src/api/artisan schedule:work
```

Emails explicitly use the existing `database` connection, even when the default queue driver is `sync`. Workers must consume its configured queue (`DB_QUEUE`, default `default`) and database (`DB_QUEUE_CONNECTION`, default application database). Keep API, worker, and scheduler configuration consistent, including `APP_KEY` and rotation keys needed to decrypt queued jobs/outbox content. SMTP timeout is 20 seconds and email job timeout 60 seconds; the database retry lease must remain longer than the job timeout (existing default: 90 seconds). The two-minute send claim and five-minute queue reservation allow scheduler recovery after a crash/backlog.

## Inspection and recovery

```sh
php src/api/artisan mail:status --limit=50
php src/api/artisan mail:status --failed
php src/api/artisan mail:dispatch-pending --limit=100
php src/api/artisan mail:retry EMAIL_UUID
```

Status output includes only IDs, roles, kinds, states, attempts, and safe error codes. `queue_unavailable` means dispatch retained the intent; `delivery_failed` means delivery could not finish; `obsolete` marks a skipped identity/token/application. Inspect provider and infrastructure diagnostics in their own systems without dumping message content, credentials, encrypted payloads, or reset URLs.

Automatic delivery attempts are bounded at five, with 60/120/300/600-second waits plus scheduler cadence. `failed` rows await operator action. Correct the provider/worker issue, then retry the specific UUID; retry never repeats the account decision. Expired, consumed, or superseded resets are skipped even after retry; the applicant should request a fresh link. Accepted/skipped rows cannot be reopened through the retry command. Accepted/skipped payloads are erased; failed payloads remain encrypted for retry, and metadata has no new automatic retention policy.

`accepted` records success from the selected transport, not inbox placement or reading. Under `array`/`log`, no external email is delivered. Worker crashes after SMTP acceptance and ambiguous network failures can cause duplicate emails despite application deduplication.

## Verification

Use the isolated bootstrap so PHPUnit does not load environment files or configuration caches:

```sh
php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml --bootstrap src/api/tests/bootstrap-isolated.php src/api/tests/Feature/Mail
```

This uses synthetic mail settings, in-memory SQLite, array transport, and fresh ignored test storage under `node_modules/.cache`. Transport configuration tests construct SMTP/SMTPS connections without opening sockets; worker tests consume actual encrypted database jobs through array transport. Adjacent auth/approval suites can use the same bootstrap.

For deployment acceptance, an operator should request a fresh reset using an approved test account, verify safe status metadata and the intended portal link, and verify Courier approval/rejection using its owning Logistics test organization. Confirm provider acceptance/inbox arrival and actual worker/scheduler recovery separately; synthetic tests do not establish these results or PostgreSQL process concurrency.

See the [transactional email contract](../features/shared/transactional-email/spec.md) for state, privacy, and role boundaries.
