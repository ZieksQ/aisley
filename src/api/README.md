# AISLEY Laravel API

Shared backend for Customer, Seller, Admin, Logistics and external Courier/Buyer Flutter clients. The committed manifest requires PHP ^8.3 and Laravel ^13.17; authentication uses Sanctum. PostgreSQL is the application database; private storage uses the configured local/Azure disk.

## Development

Run commands from the monorepo root. Install the committed Composer dependencies with `composer --working-dir=src/api install` and configure the API using `src/api/.env.example` and [architecture](../../docs/architecture.md). Existing database/environment setup must be available before starting workers.

```sh
pnpm dev:api
pnpm dev:queue
pnpm dev:schedule
```

Root `pnpm dev` starts those processes with all four web applications. `pnpm dev:media` starts the separate private attachment worker when media is enabled. See [media setup](../../docker/README.md#private-chat-media) for storage, scanner and processing prerequisites.

## Contract boundaries

- Versioned endpoints use `/api/v1`; [routes/api.php](routes/api.php) defines exact methods, middleware and paths.
- Web apps use stateful Sanctum sessions with HttpOnly cookies/CSRF; mobile clients use scoped personal-access bearer tokens. Customer login chooses bearer authentication when `device_name` is supplied.
- Protected routes enforce role/status/consent and ownership. Seller data is Store-scoped; Logistics data is organization/hub-scoped. Seller and Courier approval gates remain server-owned.
- Store enum-like columns as strings with PHP enum casts. Schema changes use new migrations; previously executed migrations remain immutable.
- Courier is mobile-only. The external Flutter projects own their screens and adoption evidence.

## Inspection and checks

```sh
php src/api/artisan route:list --path=api/v1 --json
php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml
```

Route listing inspects available code without proving deployment. Tests require their documented isolated database/environment. Match focused tests to the feature; this documentation sync did not run API tests.

Read [requirements](../../docs/requirements.md), [schema](../../docs/schema.md), [feature specifications](../../docs/features), and [Progress](../../docs/PROGRESS.md). Portable [Courier](../../docs/docs-flutter-rider/README.md) and [Buyer](../../docs/docs-mobile-buyer/README.md) contracts distinguish server availability, client adoption and release acceptance.
