---
feature: customer_verify_auth
role: Customer
platform: Flutter / Dart
phase: 1
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Auth-aware navigation

Backend: /me role/status and policy guards implemented; storefront session UX has its own separate implementation.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

App load → one deduplicated secure-token restoration → /me → guest/active/denied/retry → consent → private route.

- One session controller owns verified identity and session generation. Do not issue a new /me from every screen/render or persist a trusted login flag.
- Public discovery/Shop/Product/policies stay available. Cart/checkout/Orders/account/messages/notifications/tickets need active Customer plus server-required consent. Validate internal return destinations and require deliberate mutation retry after login.
- POLICY_CONSENT_REQUIRED opens consent while preserving auth; resource-specific denial clears its data. Logout/account switching rejects all delayed private successes/errors and clears caches/drafts/uploads/quotes/keys/read markers.

## Existing API

- `GET /api/v1/customer/auth/me`
- `GET /api/v1/policy-consent/status`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] No private-content flash occurs at boot or denial; safe return and Android/browser Back remain predictable.
- [ ] A→B→A switching and delayed replies cannot restore previous private state; consent never loops or repeats writes.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G04, G05, G18 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/customer_verify_auth/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
