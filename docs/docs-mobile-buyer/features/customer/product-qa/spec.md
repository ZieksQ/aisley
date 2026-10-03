---
feature: product-qa
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Public Product questions

Backend: Public Product Q&A, active-Customer ask, owning Seller official answer and after-commit alerts implemented.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Visible Product questions → ask after auth/consent → committed question → official answer/allowed notification.

- Public read is Product-visibility-gated and bounded page/limit. Asking does not need purchase proof.
- Create accepts question (not question_text), normalized plain text ≤1000 and UUID key; no owner/Seller/answer/attachment fields. Exact retries preserve one logical question and after-commit alert.
- Display one official Seller answer without Customer answer/edit permissions; render escaped text. Q&A is public Product knowledge distinct from private chat/verified Review. Hidden Products never leak their historical Q&A; answer notification maps to the allowed Product anchor.

## Existing API

- `GET /api/v1/products/{product}/questions`
- `POST /api/v1/products/{product}/questions`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Public visibility and Customer question/key/role/consent/limits match Requests.
- [ ] Retry/throttle/error and official answer/notification rendering retain safe drafts and omit private identities.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G19 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/product-qa/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
