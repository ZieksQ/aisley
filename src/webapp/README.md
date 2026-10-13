# AISLEY Customer storefront

Customer storefront built with Next.js, React, TypeScript and Tailwind. Role screens, routes and API access stay in this app; compatible presentation uses workspace packages, including `@aisley/ui` and `@aisley/ui/chat`.

## Development

Run commands from the monorepo root after workspace dependencies and the API environment are configured:

```sh
pnpm dev:webapp
```

The local app runs at `http://localhost:3000`. Set `NEXT_PUBLIC_API_URL` from this app's `.env.example` to the API origin without `/api/v1`; the client uses versioned endpoint paths. Public frontend configuration must contain no server secrets.

Use root `pnpm dev` to start the API, queue worker, scheduler and all four web apps. PostgreSQL must already be available. Private chat media has a separate worker; see the [root setup](../../README.md#local-chat-media).

## Authentication and ownership

Browser authentication uses Laravel Sanctum stateful sessions, HttpOnly cookies and CSRF protection. The API enforces active Customer identity and required policy consent on protected shopping/account actions. Mobile bearer flows and Courier screens belong to their external Flutter projects.

## Design and contracts

Light-only, mobile-first responsive layouts and accessible controls follow [the web design contract](../../docs/design.md). Read the matching [role feature specifications](../../docs/features/customer) before feature changes. Shared UI does not merge role navigation, permissions or tenant data.

## Checks

```sh
pnpm --dir src/webapp lint
pnpm --dir src/webapp build
```

Checkout and Orders regressions: `pnpm --dir src/webapp test:checkout` and `pnpm --dir src/webapp test:orders`. Browser checks have their own documented fixture/server prerequisites.

Commands come from the committed package scripts. This documentation update did not run application checks; [Progress](../../docs/PROGRESS.md) records actual verification and [architecture](../../docs/architecture.md) describes deployment.
