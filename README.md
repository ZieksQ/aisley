# AISLEY

Multi-tenant e-commerce platform with a Laravel API, Customer storefront, and Seller, Admin and Logistics dashboards. Separate Flutter applications serve Courier and Buyer mobile users.

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

Use pnpm for the web workspace and Composer for the API. See [architecture](docs/architecture.md) for the stack, authentication and environment boundaries, [requirements](docs/requirements.md) for intended behavior, [feature specifications](docs/features) for detailed contracts, and [Progress](docs/PROGRESS.md) for recorded implementation. PostgreSQL must already be running before starting development processes.

## Mobile documentation

The Courier project is `../aisley_app`; the Buyer project is `../aisley_mobile_buyer`. Each owns its Flutter source, setup and implementation evidence. The portable [Courier bundle](docs/docs-flutter-rider/README.md) and [Buyer bundle](docs/docs-mobile-buyer/README.md) mirror their documentation while retaining Laravel's authority over server contracts. Local browser tests use Courier port 8765 and Buyer port 8766.

See the [October 12 synchronization audit](docs/references/synchronization-2026-10-12.md) for inspected revisions, validation and remaining adoption/release gaps. Documentation synchronization does not establish deployed API or installed-device acceptance.

## Local chat media

Private chat attachments use FFmpeg/ffprobe, GD/Zip and ClamAV. See [deployment/local media setup](docker/README.md#private-chat-media) and the [feature contract](docs/features/shared/chat-media/spec.md). Start `pnpm dev:media` alongside `pnpm dev` when media is enabled; the ordinary notification worker does not consume the media queue. Media defaults off.
