# AISLEY Seller dashboard

Seller dashboard built with React, TypeScript, Vite, React Router and Tailwind. Role screens, routes and API access stay in this app; compatible presentation uses workspace packages, including `@aisley/ui` and `@aisley/ui/chat`.

## Development

Run commands from the monorepo root after workspace dependencies and the API environment are configured:

```sh
pnpm dev:seller
```

The local app runs at `http://localhost:5174`. Set `VITE_API_URL` from this app's `.env.example` to the API origin without `/api/v1`; the client uses versioned endpoint paths. Public frontend configuration must contain no server secrets.

Use root `pnpm dev` to start the API, queue worker, scheduler and all four web apps. PostgreSQL must already be available. Private chat media has a separate worker; see the [root setup](../../README.md#local-chat-media).

## Authentication and ownership

Browser authentication uses Laravel Sanctum stateful sessions, HttpOnly cookies and CSRF protection. The API enforces active, Admin-approved Seller access and Store ownership. Mobile bearer flows and Courier screens belong to their external Flutter projects.

## Design and contracts

Light and dark themes, mobile-first responsive layouts and accessible controls follow [the web design contract](../../docs/design.md). Read the matching [role feature specifications](../../docs/features/seller) before feature changes. Shared UI does not merge role navigation, permissions or tenant data.

## Checks

```sh
pnpm --dir src/seller lint
pnpm --dir src/seller build
pnpm --dir src/seller test:products:browser
pnpm --dir src/seller test:description:browser
```

Commands come from the committed package scripts. This documentation update did not run application checks; [Progress](../../docs/PROGRESS.md) records actual verification and [architecture](../../docs/architecture.md) describes deployment.

The product browser regression requires the production build and the existing Chromium installation. It starts and stops its own local preview on port 15174, uses synthetic HTTP without real accounts or database writes, and writes screenshots under `node_modules/.cache/seller-products`. Run it from the repository root with `node src/seller/tests/products-browser.mjs --serve` or use the package script above.

The description regression starts its own preview on port 15175 and checks Source/Rich text/Diff switching, the loaded-description comparison baseline, tables, image uploads, source save/recovery, caret and toolbar geometry, and both themes at narrow and wide widths. Run `node src/seller/tests/description-editor-browser.mjs --serve`; screenshots are written under `node_modules/.cache/seller-products/description-editor`.
