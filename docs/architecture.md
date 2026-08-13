# Architecture

## Purpose
Defines **HOW** the system is structured: components, tech stack, data layer, and how pieces connect.

## Repo layout
```
src/
  api/       # Laravel API — backend for all roles
  webapp/    # Customer-facing storefront (Next.js)
  seller/    # Seller dashboard (React)
  admin/     # Admin dashboard (React)
```
Courier has no folder in `src/` — it's served by `api/` and consumed by an external mobile app (not part of this repo).

## Tech stack

### api/
- Laravel
- Sanctum — authentication (token-based; supports SPA and mobile consumers)
- Eloquent — ORM

### webapp/ (customer)
- Next.js + TypeScript
- Rendering: SSR + CSR (hybrid, per-page as needed)
- Tailwind CSS
- react-icons

### seller/ and admin/
- React + TypeScript
- Tailwind CSS
- react-icons
- React Router

## Database
- Supabase (Postgres) — primary environment
- Local development: can switch to local Postgres via `.env`
- **Known migration issue:** Postgres errors on native enum column types in migrations. Workaround: define the column as `string` in the migration/DB schema, but keep it strongly typed as an enum in the API layer (PHP enum class + Eloquent cast). All future enum-like fields should follow this same pattern for consistency.

## Auth model
- Sanctum issues tokens for all API consumers: `webapp/`, `seller/`, `admin/`, and the external courier mobile app.
- Role-based access control (RBAC): every API endpoint checks the caller's role before executing role-specific logic.
- Seller and Courier roles have an additional "approval" gate — an approved-by-admin status required before their tokens can access role-specific endpoints.

## Multi-tenancy model
- Each Seller owns one Store.
- Store-scoped data (products, orders for that store) must be filtered by store ownership at the query level in `api/`, not just hidden in the frontend.

## How components talk to api/
- `webapp/`, `seller/`, and `admin/` all call the same Laravel API (`api/`) over HTTP, authenticated via Sanctum.
- The courier mobile app (external) calls dedicated courier endpoints on the same API.

## TBD
- API versioning strategy
- Hosting/deployment targets per component
- File/image storage (product images, store assets)