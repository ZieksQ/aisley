# School E-Commerce

Monorepo scaffold for a B2B2C e-commerce platform.

## Structure

- `src/api` - Laravel API backend
- `src/webapp` - Next.js customer storefront
- `src/seller` - React seller dashboard
- `src/admin` - React admin console

## Scripts

- `pnpm dev` - run all apps with `concurrently`
- `pnpm dev:webapp` - run the storefront
- `pnpm dev:seller` - run the seller dashboard
- `pnpm dev:admin` - run the admin console
- `pnpm dev:api` - run the Laravel API

## Notes

The repository is scaffolded to match the architecture in `docs/architecture.md`.

