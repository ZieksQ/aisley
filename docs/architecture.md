# System Architecture

## System Overview

A multi-domain e-commerce platform utilizing a monorepo architecture. It features a single centralized backend API serving multiple specialized frontend applications.

The repository contains four frontend applications: the Customer storefront, Seller dashboard, Admin dashboard, and Logistics dashboard. Production Courier functionality is consumed by an external Flutter/mobile application. `src/couriermockup` is an existing development-only API harness, not a fifth production frontend.

* **Authentication:** Laravel Sanctum
* **Architecture Pattern:** Monorepo (pnpm workspace)
* **Package Manager:** pnpm

## Technology Stack

| Layer | Technologies |
| --- | --- |
| **API (Backend)** | Laravel, Eloquent, PHP |
| **Storefront Webapp** | Next.js, React, TypeScript, Tailwind CSS, React-Icons |
| **Dashboards (Admin/Seller/Logistics)** | React, TypeScript, Tailwind CSS, React-Icons, React Router |
| **Database** | PostgreSQL 18.3 |
| **Blob Storage** | Azure Blob Storage |

## Monorepo Structure

The workspace is managed via `pnpm-workspace`. Applications and shared resources are logically separated into specialized directories.

```text
/
├── packages/          # Shared React UI/feature packages and address data
└── src/
    ├── webapp/        # Customer-facing storefront (Next.js)
    ├── seller/        # Seller dashboard (React SPA)
    ├── admin/         # Admin dashboard (React SPA)
    ├── logistics/     # Logistics dashboard (React SPA)
    └── api/           # Core Backend (Laravel)

```

## Web frontend design ownership

`docs/design.md` is the mandatory visual and interaction contract for the four production web applications and shared UI they consume. Root `AGENTS.md` requires frontend changes to follow it; matching feature specifications supply workflows, permissions, and role-specific navigation.

| Application | Rendering model | Theme and layout contract |
| --- | --- | --- |
| `src/webapp` | Next.js server/client boundaries | Light-only, mobile-first Customer storefront |
| `src/admin` | React Router SPA | Mobile-first dashboard with light and dark themes |
| `src/seller` | React Router SPA | Mobile-first dashboard with light and dark themes |
| `src/logistics` | React Router SPA | Mobile-first dashboard with light and dark themes |

Place all new or extracted reusable UI components in `packages/ui` and export them through `@aisley/ui` or an appropriate subpath. Do not create standalone presentation packages. Keep one-off role compositions in their owning apps and leave existing feature-specific packages in place; this rule does not require migrating them. Shared presentation must support the consuming app's theme and preserve role-specific screens and navigation; it does not require moving the SPA dashboards to Next.js or applying storefront SEO rules to them.

The shared chat presentation, generic clients, media state, and notification behavior are owned by `packages/ui/src/chat` and exported through `@aisley/ui/chat`. Customer, Seller, and Logistics web screens import that subpath; `@aisley/chat-ui` remains a workspace compatibility re-export facade that depends on `@aisley/ui`. Role-owned page composition, routes, authorization, and role API clients stay in their existing apps. Other existing feature packages remain in place. Chat follows the same [Design System](design.md) as the other web screens; its feature specifications own messaging behavior and privacy.

This web design contract excludes the existing `src/couriermockup` harness and external Flutter documentation. It does not change their design rules or implementation scope.

## Backend Architecture (Laravel)

### Documentation ownership

The external Courier and Buyer Flutter projects own their client source, setup and implementation evidence. Their portable documentation is tracked here at `docs/docs-flutter-rider` and `docs/docs-mobile-buyer`, and copied into each client's `docs/`. Synchronize maintained contracts and newer client evidence selectively; preserve historical logs/reports and project-specific root instructions. Laravel source establishes available server behavior, while client source establishes adoption; deployed/device acceptance needs separate evidence. The [October 12 audit](references/synchronization-2026-10-12.md) records the current reconciliation and remaining gaps.

### API Routing

* **Versioning Strategy:** All endpoints must be prefixed with `/api/v1/`.

### Browser CORS and throttling

Laravel's global CORS middleware applies to `api/*` and `sanctum/csrf-cookie`. `CORS_ALLOWED_ORIGINS` supplies the exact approved origins; credentials remain enabled. The default local list includes the Buyer Flutter browser origin `http://localhost:8766` and Courier Flutter browser origin `http://localhost:8765`, plus their `127.0.0.1` equivalents and existing web apps.

`Access-Control-Expose-Headers: Retry-After` makes server cooldown headers readable by approved browser clients, including credentialed requests. Preserve the original `Retry-After` value (delta-seconds or HTTP-date); exposure does not invent a cooldown when the server omits it. Native clients receive the same response header. Unapproved origins receive no CORS authorization.

Audit B05 regression commands, run from the repository root, are `php src/api/vendor/bin/phpunit --configuration src/api/phpunit.xml src/api/tests/Feature/CorsRetryAfterTest.php` and `node src/api/tests/cors-browser.smoke.mjs`. The browser check requires installed Chromium, PHP dependencies, socket access and free localhost ports 8765–8767; it uses synthetic responses through the checked-in configuration and actual Laravel CORS middleware, without application bootstrap, database or real credentials. These checks do not verify actual Flutter cooldown behavior or deployed headers. Refresh Laravel's cached configuration through the existing release process and verify deployed exposure from each approved client origin before closing live acceptance.

### Strict Namespacing Rules

All role-specific classes MUST be scoped to their respective domains. **Do NOT cross-import role-specific classes** (e.g., never use `App\Enums\Admin\*` inside Customer logic).

* **Controllers:** `App\Http\Controllers\{Role}\{Name}Controller`
* **Requests:** `App\Http\Requests\{Role}\{Name}Request`
* **Resources:** `App\Http\Resources\{Role}\{Name}Resource`
* **Enums (Role-specific):** `App\Enums\{Role}\{Name}`
* **Enums (Shared/Global):** `App\Enums\{Name}`

## Database Architecture

**Engine:** PostgreSQL 18.3 (Dockerized via `alpine3.23`)

**Migration Convention (Enums):**
Due to native enum column type errors in PostgreSQL migrations, database columns must be defined as `string` in the migration files. The application will handle strict typing by casting to Enums at the API/Eloquent layer.

## Infrastructure & Environments

### Local Development

* **Database:** Hosted inside a local Docker container (`docker-compose.yml`).
* **Dependencies:** Runs on the local machine's native PHP, Composer, and Node environments.
* **Process launcher:** Root `pnpm dev` starts the Laravel HTTP server, database queue worker, Laravel scheduler, and all four current frontend applications (`webapp`, `seller`, `admin`, and `logistics`). The queue worker persists asynchronous notifications and audit events; the scheduler redispatches recoverable pending audit outbox events.

### Production Strategy

* **Frontend Hosting (Vercel):** All frontend applications (`webapp`, `seller`, `admin`, `logistics`) are deployed to Vercel.
* **Backend Hosting (Azure VM):** The API is hosted on an Azure Virtual Machine using `docker/docker-compose.prod.yml`.
* **Container Stack:** PHP-FPM, Nginx, PostgreSQL, Laravel queue worker/scheduler, Cloudflare Tunnel.
* **Ingress:** Cloudflare Tunnel is the only public ingress. Nginx, PHP-FPM, and PostgreSQL have no host-published ports; Cloudflare terminates public HTTPS for the configured API hostname.

* **Domain Routing:**
* Storefront (`webapp`) uses the root domain.
* All dashboards and the API are routed via dedicated subdomains.

### Transactional SMTP email

Password resets (Customer/Seller/Logistics) and registration decisions (Admin-reviewed Customer/Seller/Logistics and Logistics-reviewed Courier) use encrypted transactional email intents, the existing database queue, and minute scheduler recovery. The existing eight `MAIL_*` settings select the external SMTP service and sender. Delivery failure cannot reverse an account decision; SMTP acceptance does not establish inbox delivery. See [email contract](features/shared/transactional-email/spec.md) and [operations](references/smtp-email.md).

### Finance gateway simulator

- COD automation uses the existing Laravel database queue/scheduler and installed PDF renderer; no new application framework or provider SDK is required.
- `finance:automate` evaluates persisted daily times every minute. Delivery commits durable invoices; queued work and periodic recovery handle PDFs, notifications, outbound payment HTTP, and signed webhooks.
- Simulator routes are server-key-authenticated under `/api/v1/sandbox-gateway`; the result webhook is signature-authenticated under `/api/v1/finance/gateway/webhook`. Browser Finance routes retain Sanctum/RBAC/consent.
- Configure `FINANCE_GATEWAY_ENABLED`, URL/key, and webhook URL/secret from `src/api/.env.example`. Requests originate from the queue worker, avoiding synchronous loopback deadlocks under the development HTTP server. Enable explicitly outside local/testing; this simulator moves no real money.

### Private chat media

Existing role-owned conversation APIs share a private attachment lifecycle without sharing role screens or recipients. `chat_attachments` stores uploader/context/processing metadata; ready assets bind atomically to an existing message. Per-file jobs use the dedicated `media` database queue connection (240-second retry lease, 180-second job timeout), separate from notification/audit work. The five-minute maintenance command recovers lost work and removes unbound assets after 24 hours; sent history remains retained.

FFmpeg/ffprobe inspect H.264 MP4 and generate single-threaded posters; GD validates/rewrites PNG/JPEG images and thumbnails. New uploads/bindings allow only PNG/JPG/JPEG/MP4 up to 8,000,000 bytes each; historical committed files remain readable. Malware scanning is explicitly optional through `CHAT_MEDIA_SCAN_ENABLED=false` for the school deployment; absent settings default scanning on, with failures/outages blocking readiness. Participant authorization, private streaming and video byte ranges remain unchanged.

Production chat uses a separate private `azure_chat` disk/container, sharing Azure credentials by default while preserving existing disk/container/prefix settings and per-asset historical references. `chat:prepare-storage` creates/checks only the new container and verifies private ACL plus read/write/delete. The `chat-media` profile starts one memory-bounded worker; `chat-media-scanner` independently adds ClamAV when enabled. Local development uses `storage/app/private`. Uploads default disabled until storage/tools/worker readiness is verified. A 1 GiB VM still needs measured acceptance. See [media spec](features/shared/chat-media/spec.md) and [operations](../docker/README.md#private-chat-media).
