# AGENTS.md

## Overview

This repo is a multi-tenant e-commerce platform (in the spirit of Shopee/Amazon) with four user roles: **Customer**, **Seller**, **Admin**, and **Courier** (rider, mobile-only).

Structure under `src/`:

- `api/` — Laravel API (Sanctum auth, Eloquent ORM). Backend for all four roles, including dedicated endpoints consumed by the courier mobile app (external, not part of this repo).
- `webapp/` — Customer-facing storefront. Next.js + TypeScript (SSR + CSR), Tailwind, react-icons.
- `seller/` — Seller dashboard. React + TypeScript, Tailwind, react-icons, React Router.
- `admin/` — Admin dashboard. React + TypeScript, Tailwind, react-icons, React Router.

- `root/shared` - sharable reusable codes.

Database: Postgres (containerized)

## Git commit & branch rules
**Feature Branching & Commits**: When implementing a new feature, always create and switch to a new branch derived from the current active branch before making changes. Once the task is completed, automatically commit the changes using a descriptive conventional commit message formatted as feat: concise summary of changes, branch names formatted as ex. `feature/short-commit-title.

## Rules for every prompt

1. **Read `PROGRESS.md` first.** Check what's already built before starting new work, so you don't duplicate or contradict existing implementation.
2. **Stick to the declared tech stack** per component (see `docs/architecture.md`). Don't introduce new frameworks/libraries without explicit approval.
3. **Postgres enum workaround:** Postgres migrations error on native enum column types. Store the column as a `string` in migrations/DB, but keep it typed as an enum in the API layer (e.g. PHP enum + Eloquent cast). Apply this consistently to any new enum-like field.
4. **Respect role boundaries.** Customers, Sellers, and Admins each have isolated dashboards/apps (`webapp/`, `seller/`, `admin/`). Don't leak one role's screens or logic into another's component.
5. **Courier is mobile-only.** Do not build a web UI for couriers inside `src/`. Courier functionality = API endpoints only, meant for consumption by an external mobile app.
6. **Multi-tenancy.** Sellers only ever operate on data scoped to their own store. Enforce store-level data isolation at the API layer, not just in the UI.
7. **Auth.** Use Sanctum tokens across all API consumers. Enforce role-based access control (RBAC) on every endpoint — check role before executing role-specific logic.
8. **Approval gating.** Sellers and Couriers cannot use their dashboards/apps until Admin approves them. Enforce this at the API level, not just the UI.
9. **Update `PROGRESS.md`** with a short, dated summary after finishing a feature or meaningful change. This is mandatory. `PROGRESS.md` is a single running log for the **whole app**, not a per-prompt file — always **append** a new dated entry, never rewrite or delete existing entries. Skim existing entries first so you don't log a duplicate of something already recorded.
10. **Stay in scope.** Only touch files relevant to the current task. Don't refactor, rename, reformat, or "clean up" unrelated code/files without being explicitly asked — this includes files outside `src/` and other docs. If a task seems to need out-of-scope changes, flag it and ask before doing it.
11. **Read the relevant docs file** before writing code, per the table below.
12. Run all commands from within this directory. Do not run commands that modify files, directories, packages, services, or system settings outside this directory, including commands requiring sudo, unless explicitly instructed to do so.
13. **Database Migrations**: Never modify existing or previously executed migration files. Always create a new migration file to apply schema changes, table updates, or data alterations.

## Where to look

| If the task involves...                                                           | Read                   |
| --------------------------------------------------------------------------------- | ---------------------- |
| What a feature/role is supposed to do, scope, acceptance criteria                 | `docs/requirements.md` |
| Folder structure, tech stack, DB, auth, environment setup, how components connect | `docs/architecture.md` |
| Step-by-step user flows, state transitions, approval logic, order lifecycle       | `docs/workflows.md`    |
| What's already built, to avoid re-doing or conflicting work                       | `docs/PROGRESS.md`     |
| domain design, context about users role                                           | `docs/domains/*`       |
| frontend desgin rules and color scheme                                            | `docs/design.md`       |
