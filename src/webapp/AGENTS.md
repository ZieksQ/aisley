<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AISLEY storefront design

- Follow the repository root `AGENTS.md` and read `../../docs/design.md` before changing frontend UI, layout, styling, accessibility, or client-side behavior. The design guide is mandatory alongside the matching Customer feature spec.
- Keep the storefront light-only and mobile-first, including account, auth, checkout, and shared feature screens. Use the existing layouts and compatible workspace UI primitives.
- Apply the guide's SSR/SSG/ISR and metadata guidance to public, indexable pages while retaining client components for interactive state.
- Keep project instructions outside the generated Next.js block above. The generated framework guidance does not replace AISLEY's design contract.
