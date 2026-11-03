---
feature: customer-page-not-found
title: Customer Page Not Found
system: AISLEY
type: Feature Specification
version: 1.0
status: Implemented
canonical: true
role: Customer
scope: Customer Next.js storefront
reviewed: 2026-11-03
---

# Customer Page Not Found

## Purpose

Give visitors a clear recovery path when a storefront URL does not match an
available route.

## Requirements

- The root Next.js `not-found.tsx` handles unmatched storefront URLs and uses
  the standard storefront layout, including its marketplace header and policy
  footer.
- Show a clear 404 status, an explanatory heading and short message, and a
  keyboard-accessible link to `/`.
- Use the light-only Customer palette, Geist typography, responsive spacing,
  visible focus, and a minimum 44px action target from `docs/design.md`.
- Export page-specific metadata. Next.js supplies `noindex` for not-found
  responses.
- Existing feature-specific missing-resource pages keep their own recovery
  actions and copy. Unknown URLs under protected route prefixes continue to
  pass through the existing authentication and policy-consent gates.
- Do not fetch marketplace data or expose private data to render this page.

## Acceptance

- An unknown public URL renders the branded 404 and returns not-found status.
- The home link navigates to `/`; the page remains readable and operable at
  phone, tablet, and desktop widths.
- Existing Product, Shop, and other resource-specific not-found behavior is
  unchanged.
