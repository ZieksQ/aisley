# AGENTS.md

## Overview

This repo is a multi-tenant e-commerce platform (in the spirit of Shopee/Amazon) with five user roles: **Customer**, **Seller**, **Admin**, **Logistics**, and **Courier** (rider, mobile-only).

Structure under `src/`:

- `api/` — Laravel API (Sanctum auth, Eloquent ORM). Backend for all five roles, including dedicated endpoints consumed by the courier mobile app (external, not part of this repo).
- `webapp/` — Customer-facing storefront. Next.js + TypeScript (SSR + CSR), Tailwind, react-icons.
- `seller/` — Seller dashboard. React + TypeScript, Tailwind, react-icons, React Router.
- `admin/` — Admin dashboard. React + TypeScript, Tailwind, react-icons, React Router.
- `logistics/` — Logistics dashboard. React + TypeScript, Tailwind, react-icons, React Router.

Shared workspace packages live at root `packages/`, including `@aisley/ui`, feature-specific React packages, and PSGC address data.

Database: Postgres (containerized)

## Git commit & branch rules

**Feature Branching & Commits**: When implementing a new feature, always create and switch to a new branch derived from the current active branch before making changes. Once the task is completed, automatically commit the changes using a descriptive conventional commit message formatted as feat: concise summary of changes, branch names formatted as ex. `feature/short-commit-title.

## Rules for every prompt

1. **Read `PROGRESS.md` first.** Check what's already built before starting new work, so you don't duplicate or contradict existing implementation.
2. **Stick to the declared tech stack** per component (see `docs/architecture.md`). Don't introduce new frameworks/libraries without explicit approval.
3. **Postgres enum workaround:** Postgres migrations error on native enum column types. Store the column as a `string` in migrations/DB, but keep it typed as an enum in the API layer (e.g. PHP enum + Eloquent cast). Apply this consistently to any new enum-like field.
4. **Respect role boundaries.** Customers, Sellers, Admins, and Logistics each have isolated web apps (`webapp/`, `seller/`, `admin/`, `logistics/`). Share compatible presentation primitives through `packages/` while keeping role screens, navigation, and authorization separate.
5. **Courier is mobile-only.** Do not build a web UI for couriers inside `src/`. Courier functionality = API endpoints only, meant for consumption by an external mobile app.
6. **Multi-tenancy.** Sellers only ever operate on data scoped to their own store. Enforce store-level data isolation at the API layer, not just in the UI.
7. **Auth.** Use Sanctum tokens across all API consumers. Enforce role-based access control (RBAC) on every endpoint — check role before executing role-specific logic.
8. **Approval gating.** Sellers may use the Seller dashboard only after Admin approval. Couriers may use the Courier mobile app only after approval by their associated Logistics organization. Enforce this at the API level, not just the UI.
9. **Update `PROGRESS.md`** with a short, dated summary after finishing a feature or meaningful change. This is mandatory. `PROGRESS.md` is a single running log for the **whole app**, not a per-prompt file — always **append** a new dated entry, never rewrite or delete existing entries. Skim existing entries first so you don't log a duplicate of something already recorded.
10. **Archive the progress log at 150 lines.** After adding a progress entry, if `docs/PROGRESS.md` exceeds 150 physical lines, create `docs/logs/` if it does not exist, move the complete current file to `docs/logs/PROGRESS-YYYY-MM-DD.md` using a unique suffix when that date already has an archive, and create a fresh `docs/PROGRESS.md` with the standard header plus a concise archive entry. Never delete or rewrite an archived log.
11. **Stay in scope.** Only touch files relevant to the current task. Don't refactor, rename, reformat, or "clean up" unrelated code/files without being explicitly asked — this includes files outside `src/` and other docs. If a task seems to need out-of-scope changes, flag it and ask before doing it.
12. **Follow the web design contract.** For Customer, Seller, Admin, or Logistics frontend work — including UI, styling, layout, accessibility, and client-side behavior — read and follow `docs/design.md` before making changes. This rule also covers shared components used by those apps; `couriermockup` and external Flutter design are excluded from this web design contract.
13. **Read the matching feature specification before implementation.** Before implementing or changing a role feature, read its applicable `docs/features/<role>/<feature>/spec.md` or `specs.md`, using the existing filename. If the work spans multiple features, read every affected spec. When no matching spec exists, flag the gap before inventing feature behavior.
14. **Read applicable reference policies before implementation.** For any file/image upload work, read `docs/references/file-upload-requirements.md`. For Customer, Seller, or Courier registration/approval work, read `docs/references/user-registration-requirements.md`. Apply both when registration includes document/image uploads.
15. Run all commands from within this directory. Do not run commands that modify files, directories, packages, services, or system settings outside this directory, including commands requiring sudo, unless explicitly instructed to do so.
16. **Database Migrations**: Never modify existing or previously executed migration files. Always create a new migration file to apply schema changes, table updates, or data alterations.
17. **Shared frontend packages.** Declare workspace packages explicitly and reuse `@aisley/ui` components when compatible; avoid duplicate UI primitives.
18. **PSGC addresses.** For Philippine address fields, use `@aisley/psgc-address-data` and follow the webapp's cascading Region → Province → City/Municipality → Barangay flow.

## Web frontend design rules

- `docs/design.md` owns the visual and interaction rules for `src/webapp`, `src/admin`, `src/seller`, `src/logistics`, and shared UI consumed by these apps. Feature specs own workflows, content, permissions, and role-specific navigation; they must follow the shared design rules.
- Build mobile-first: make the smallest supported layout usable, then enhance it for tablet and desktop. Keep primary actions, forms, dialogs, and navigation usable at narrow widths; contain table overflow within the table region.
- Customer storefront is light-only. Admin, Seller, and Logistics support both light and dark themes through their existing theme controls. Check all changed states in the app's supported themes.
- Reuse the app's existing layout, typography, spacing, and compatible `packages/` components. Follow the documented brand colors and restrained 60/30/10 balance; do not create another design system inside a feature.
- If an older feature spec or template README contradicts the design guide, reconcile its web-design wording within the task scope. An explicit user-requested design change should update the applicable guide as part of the work.
- Verify the affected frontend's responsive behavior, keyboard/focus handling, and loading/empty/error states alongside its normal type/lint/build checks. Record what was actually checked; a documentation revision alone does not certify existing screens.
- These rules do not revise `src/couriermockup`, Courier feature contracts, Flutter design/rules, or copied Flutter documentation.

## Modularity and code organization

- Keep each hand-written source file focused on one cohesive responsibility.
- Keep React/Next.js pages responsible for composition and navigation; extract independent sections, forms, tables, dialogs, upload flows, and status views into separate components.
- Keep Laravel controllers thin. Put validation in Form Requests, authorization in Policies/middleware, serialization in Resources/DTOs, and domain workflows in focused Services.
- Keep API calls in client/repository modules, parsing in typed models or DTOs, state transitions in hooks/services, and rendering in components.
- Separate independent workflows such as authentication, profile editing, password changes, photo uploads, vehicle management, notifications, and order operations.
- Use these as review thresholds:
  - UI page: review around 400 lines.
  - Reusable component: review around 250 lines.
  - Controller, Request, Resource, or model: review around 250 lines.
  - Service/use-case class: review around 500 lines.
  - Test file: review around 600 lines.
- Split files when they exceed the relevant threshold, contain multiple independent workflows, or become difficult to test in isolation.
- Do not split code mechanically into tiny files; use meaningful feature and responsibility boundaries.
- Before adding a feature, check whether the files being changed should be modularized instead of extending an already overloaded file.
- Apply modularization to the feature or files in scope; do not refactor unrelated areas solely to satisfy line-count guidelines.
- Use the formatter and linter configured for the relevant package. Do not compress PHP, TypeScript, TSX, JSX, or CSS into unreadable one-line blocks.
- Evaluate complexity, nesting, coupling, responsibilities, and testability in addition to physical line count.
- Apply these rules to hand-written application code only. Exclude generated files, `vendor/`, `node_modules/`, `.next/`, build output, fixtures, and specification documents.
- When a feature grows into several closely related files, group them in a feature directory within the component’s existing structure. Keep shared utilities in their established shared locations. Do not create a directory for a single file or move unrelated files solely to satisfy this rule.

## Where to look

| If the task involves...                                                           | Read                                                |
| --------------------------------------------------------------------------------- | --------------------------------------------------- |
| What a feature/role is supposed to do, scope, acceptance criteria                 | `docs/requirements.md`                              |
| Folder structure, tech stack, DB, auth, environment setup, how components connect | `docs/architecture.md`                              |
| Step-by-step user flows, state transitions, approval logic, order lifecycle       | `docs/workspace.md` and the applicable shared/role feature specifications |
| What's already built, to avoid re-doing or conflicting work                       | `docs/PROGRESS.md`                                  |
| domain design, context about users role                                           | `docs/domains/*`                                    |
| Customer/Admin/Seller/Logistics UI, styling, layout, accessibility, or client behavior | `docs/design.md` (mandatory web design contract) |
| Role feature implementation or change                                             | Matching `docs/features/<role>/<feature>/spec.md` or `specs.md` |
| Address, location, geocoding, GPS, coordinates, maps, or map pins                 | `docs/maps-location-api.md`                         |
| File or image upload                                                              | `docs/references/file-upload-requirements.md`       |
| Customer, Seller, or Courier registration/approval                                | `docs/references/user-registration-requirements.md` |
