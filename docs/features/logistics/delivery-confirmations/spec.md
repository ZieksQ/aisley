---
feature: logistics-delivery-confirmations
title: Delivery Confirmations
system: AISLEY
type: Feature Specification
version: 1.0
status: Implemented API queue and Logistics review page
canonical: true
role: Logistics
scope: Laravel API and Logistics dashboard
---

# Delivery Confirmations

## WHAT

Give an approved Logistics account a hub-scoped queue for Courier final-mile delivery intents. Logistics previews the private photo POD, checks Courier and Order context, confirms COD collection where applicable, then finalizes the delivery or requests a reasoned correction.

Only the shared fulfillment transition may commit `delivered`. Queue reads are paginated and private. Proof bytes remain available only through the existing private proof-photo endpoint.

## MUST

- Require authenticated active Logistics access and policy consent. Resolve the Logistics organization and sole hub from the authenticated account.
- Return only current-hub final-mile tasks in `out_for_delivery` with a matching awaiting-validation completion intent and awaiting-validation photo POD.
- Include task and Shipment revisions, Order reference/payment method/status, proof ID/status/submission time, Courier identity, intent state and timestamp, and server-generated COD declaration when the Order is COD.
- Keep proof bytes/storage metadata out of queue JSON. Preview only with `GET /api/v1/logistics/delivery-proofs/{proof}/photo`.
- Search by Order reference and paginate with bounded `per_page` (maximum 50); responses are `private, no-store`.
- Confirm delivery only through `POST /api/v1/logistics/update-status/transitions` with target `delivered`, Shipment revision, scoped Order/waybill reference, and selected proof ID. The transition rechecks current task, Shipment, proof storage/status, Courier intent and task revision inside one transaction.
- For COD, require a server declaration matching Order `payable_total` and currency, and require Logistics to confirm collection in the UI before approval. Set COD payment to `paid` only in the same successful delivery transaction.
- Preserve Logistics reviewer on completion intent and event. A conflict or failed transaction leaves task, Shipment, Order, and payment unchanged.
- Request correction through `POST /api/v1/logistics/delivery-proofs/{proof}/reject` with current task revision and a reason. Rejection leaves delivery and payment pending and allows fresh POD.
- Keep tenant/hub boundaries at the API layer; a foreign proof or Shipment never becomes visible by guessing its UUID/reference.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/logistics/delivery-confirmations?search=&page=1&per_page=20` | Paginated current-hub pending confirmation queue |
| GET | `/api/v1/logistics/delivery-proofs/{proof}/photo` | Private proof preview |
| POST | `/api/v1/logistics/update-status/transitions` | Revision-checked delivery approval |
| POST | `/api/v1/logistics/delivery-proofs/{proof}/reject` | Reasoned correction request |

COD completion intent accepts only `cod_collected: true`; the declaration amount, currency, and timestamp come from the Order on the server. The Logistics queue exposes these values to the authorized reviewer.

## UI

- The protected dashboard route is `/delivery-confirmations` and appears in Logistics navigation.
- A reviewer selects a pending row, loads the private image, checks Courier and Order context, and confirms COD collection explicitly before approving COD delivery.
- A reviewer may request correction with a reason; the task remains assigned and pending at the current delivery state.
- Pending intent remains active Courier work. Completed history is populated only after authoritative Logistics approval.

## Acceptance

- [x] Queue is tenant/hub scoped and paginated.
- [x] COD declaration is server-derived and amount is not client-controlled.
- [x] Logistics confirmation is gated by proof, revisions, and explicit COD acknowledgment.
- [x] Delivery and COD payment commit atomically through the shared transition service.
- [x] Rejection records a reason without delivering or marking payment paid.
- [ ] PostgreSQL concurrency and connected browser review are release verification items.
