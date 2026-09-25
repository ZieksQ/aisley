# School E-Commerce

Monorepo scaffold for a B2B2C e-commerce platform.

## Structure

- `src/api` - Laravel API backend
- `src/webapp` - Next.js customer storefront
- `src/seller` - React seller dashboard
- `src/admin` - React admin console
- `src/logistics` - React logistics dashboard
- `packages` - shared UI, feature packages, and address data

## Web design contract

Customer, Admin, Seller, and Logistics frontend changes must follow [docs/design.md](docs/design.md) and the matching feature specification. Build mobile-first, keep the storefront light-only, and support both light and dark themes in the three dashboards. Reuse compatible workspace components. This contract excludes `couriermockup` and external Flutter design documentation.

## Scripts

- `pnpm dev` - run all apps plus the Laravel queue worker and scheduler with `concurrently`
- `pnpm dev:webapp` - run the storefront
- `pnpm dev:seller` - run the seller dashboard
- `pnpm dev:admin` - run the admin console
- `pnpm dev:logistics` - run the logistics dashboard
- `pnpm dev:api` - run the Laravel API
- `pnpm dev:queue` - process queued notifications and audit events
- `pnpm dev:schedule` - run scheduled recovery tasks such as pending audit-event dispatch

## Notes

The repository is scaffolded to match the architecture in `docs/architecture.md`. PostgreSQL must already be running before starting the development processes.
