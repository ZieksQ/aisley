---
feature: customer-notifications
title: Customer Notifications
system: AISLEY
role: Customer
scope: Customer Web Application
implementation_reviewed_on: 2026-11-04
---

# Customer Notifications

## Purpose and existing contract

Authenticated Customers browse their persistent inbox at `/notifications`, its existing `/notifications/[id]` detail routes, and a five-item header-bell preview. Laravel Sanctum, active-role checks, recipient scoping, notification-type visibility, and destination authorization remain authoritative. Courier has no web interface. This specification records the existing Customer contract; it does not introduce new notification events or mobile requirements.

- Existing owner-scoped endpoints are `GET /api/v1/customer/notifications`, `GET /api/v1/customer/notifications/{notification}`, and `POST /api/v1/customer/notifications/{notification}/read`. No schema or wire-format change is part of this redesign.
- List queries accept `status=all|unread|read`, `category`, `page`, and `per_page`; filtering runs before pagination and ordering is newest first with ID tie-breaking. The web page retains 30 rows per page. Backend private/no-store responses remain unchanged.
- Categories are Orders, Support tickets, Promotions, Announcements, Questions & reviews, and Other. Display API-provided labels; use the shared role catalog for missing metadata and Other for unknown item categories.
- The Order event allow-list remains owned by [Order status](../order-status/spec.md#customer-notification-boundary). Support, campaign, announcement, Q&A, and review producers retain their existing eligibility and safe-payload rules.
- Rows render plain-text title/summary, category, creation time, and persisted read status. They never contain private attachment URLs or raw payload JSON.

## Web inbox and bell behavior

- Use `@aisley/ui/notifications` for shared center, row/list, filters, and bell-panel presentation. Customer composition, Next.js links, API access, authentication, and destination resolution remain in the storefront. Visual authority is [the web design contract](../../../design.md); Customer stays light-only.
- Status and category filters combine in the URL and reset pagination. Preserve unrelated parameters, browser history, and stale-response guards. Previous/Next use server pagination metadata; category filtering never changes the global bell count.
- The bell fills up to five entries with unread entries first, then read entries. Its count comes from the unread query's total, never the preview length; an unavailable count stays unknown. Refresh on opening, visible-tab focus/reconnect, read-success events, and every 60 seconds while visible. Dispose account-bound previews/listeners on account change or logout; reject obsolete requests.
- Opening the bell or list never marks notifications read. Existing list rows open notification details except support-ticket rows, which link to `/account/support-tickets?ticket=UUID` and attempt the existing read mutation. Preview rows retain the server-projected destination, with the same support-ticket override. Existing detail loading/read behavior stays unchanged.
- The bell is a labeled, nonmodal dialog anchored to its trigger, constrained within the viewport with an internally scrollable list. Keyboard opening focuses the panel; Escape and Close restore trigger focus. Outside pointer/focus dismisses without taking focus from the new target. View all opens `/notifications`.
- Distinguish loading, empty, filtered-empty, unavailable count, request failure, and mutation failure. Failed bell refreshes keep existing previews and expose retry; failures must not masquerade as a successful empty inbox. A 401/403 clears sensitive preview state and stops repeated polling for that mounted account.
- Preserve server route metadata and noindex behavior, marketplace header, and Back to store navigation. Existing detail screens and external Flutter apps are outside this presentation change.

## Acceptance

- All four web roles consume the same presentation, with role-owned transport/navigation and existing permissions intact.
- Page/bell browsing performs no read mutation; support destinations and existing detail routes are preserved.
- Combined filters, pagination, reload/history, superseded requests, errors/retry, and global versus filtered counts behave correctly.
- Keyboard dismissal/focus, 44px targets, plain text, missing dates, supported themes, and 320/390/768/1440px viewport containment are verified.
- See [web notification verification](../../../references/web-notifications-verification.md) for executed checks and remaining acceptance limits.
