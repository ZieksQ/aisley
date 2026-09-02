# System Architecture

## System Overview

A multi-domain e-commerce platform utilizing a monorepo architecture. It features a single centralized backend API serving multiple specialized frontend applications.

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
├── packages/          # Shared reusable React components across all frontends
└── src/
    ├── webapp/        # Customer-facing storefront (Next.js)
    ├── seller/        # Seller dashboard (React SPA)
    ├── admin/         # Admin dashboard (React SPA)
    ├── logistics/     # Logistics dashboard (React SPA)
    └── api/           # Core Backend (Laravel)

```

## Backend Architecture (Laravel)

### API Routing

* **Versioning Strategy:** All endpoints must be prefixed with `/api/v1/`.

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
* **Process launcher:** Root `pnpm dev` starts the Laravel HTTP server, database queue worker, Laravel scheduler, and all three current frontend applications. The queue worker persists asynchronous notifications and audit events; the scheduler redispatches recoverable pending audit outbox events.

### Production Strategy

* **Frontend Hosting (Vercel):** All frontend applications (`webapp`, `seller`, `admin`, `logistics`) are deployed to Vercel.
* **Backend Hosting (Azure VM):** The API is hosted on an Azure Virtual Machine using `docker/docker-compose.prod.yml`.
* **Container Stack:** PHP-FPM, Nginx, PostgreSQL, Laravel queue worker/scheduler, Cloudflare Tunnel.
* **Ingress:** Cloudflare Tunnel is the only public ingress. Nginx, PHP-FPM, and PostgreSQL have no host-published ports; Cloudflare terminates public HTTPS for the configured API hostname.

* **Domain Routing:**
* Storefront (`webapp`) uses the root domain.
* All dashboards and the API are routed via dedicated subdomains.
