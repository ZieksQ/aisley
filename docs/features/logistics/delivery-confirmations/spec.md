---
feature: logistics-delivery-confirmations
title: Delivery Confirmations
system: AISLEY
type: Feature Specification
version: 1.3
status: Implemented queue, history, prepaid approval policy and Logistics review page
canonical: true
role: Logistics
scope: Laravel API and Logistics dashboard
---

# Delivery Confirmations

**Direct final-mile delivery revision — 2026-10-23 (`courier-direct-delivery-v2`):** Courier accepts a parcel, then submits private photo POD and the linked **Delivered** intent directly to Logistics Delivery confirmations. Hub pickup validation and transit actions are optional compatibility steps, not prerequisites. Existing `delivery_accepted`, `picked_up_from_hub`, `in_transit`, and `out_for_delivery` tasks are eligible. Submission preserves task/Shipment/Order/payment state; only the existing Logistics approval policy commits delivered. Skipped pickup/transit timestamps and evidence are not fabricated. External Flutter adoption of this revision remains open.

## WHAT

Give an approved Logistics account a hub-scoped queue for Courier final-mile delivery intents. Logistics previews the private photo POD, checks Courier and Order context, confirms COD collection where applicable, then finalizes the delivery or requests a reasoned correction.

Only the shared fulfillment finalization workflow may commit `delivered`; it serves manual review and authorized automatic prepaid review. Queue reads are paginated and private. Proof bytes remain available only through the existing private proof-photo endpoint.

## MUST

- Require authenticated active Logistics access and policy consent. Resolve the Logistics organization and sole hub from the authenticated account.
- Return only current-hub final-mile tasks in accepted delivery states (`delivery_accepted`, `picked_up_from_hub`, `in_transit`, `out_for_delivery`) with a matching awaiting-validation completion intent and awaiting-validation photo POD.
- Include task and Shipment revisions, Order reference/payment method/status, proof ID/status/submission time, Courier identity, intent state and timestamp, and server-generated COD declaration when the Order is COD.
- Keep proof bytes/storage metadata out of queue JSON. Preview only with `GET /api/v1/logistics/delivery-proofs/{proof}/photo`.
- Search by Order reference and paginate with bounded `per_page` (maximum 50); responses are `private, no-store`.
- Confirm delivery only through `POST /api/v1/logistics/update-status/transitions` with target `delivered`, Shipment revision, scoped Order/waybill reference, and selected proof ID. The transition rechecks current task, Shipment, proof storage/status, Courier intent and task revision inside one transaction.
- For COD, require a server declaration matching Order `payable_total` and currency, and require Logistics to confirm collection in the UI before approval. Set COD payment to `paid` only in the same successful delivery transaction.
- Preserve Logistics reviewer on manual decisions and system attribution on automatic prepaid decisions. A conflict or failed transaction leaves task, Shipment, Order, and payment unchanged.
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
- Pending reviews refresh on window focus/visibility return and every 30 seconds while the page is visible. Background reads preserve the workspace; pause refresh while a decision is submitting or has an uncertain result. Manual refresh remains available.
- Pending intent remains active Courier work. Completed history is populated only after authoritative Logistics approval.
- The search input keeps the available toolbar width while its submit action remains content-sized. The queue and review workspace stack on mobile, tablet, and iPad-sized viewports, then use a bounded two-column layout when wide desktop space is available.

## Acceptance

- [x] Queue is tenant/hub scoped and paginated.
- [x] COD declaration is server-derived and amount is not client-controlled.
- [x] Logistics confirmation is gated by proof, revisions, and explicit COD acknowledgment.
- [x] Delivery and COD payment commit atomically through the shared transition service.
- [x] Rejection records a reason without delivering or marking payment paid.
- [x] The review workspace is responsive across mobile, tablet/iPad, current-device, and wide desktop widths without horizontal overflow or undersizing the search input.
- [x] PostgreSQL concurrency and connected browser review verified for this revision; see the progress log for scope.

## Configurable prepaid approval revision (2026-10-05)
- Pending, History and Approval settings views improve the existing `/delivery-confirmations` frontend.
- Organization approval mode is manual by default; automatic mode applies only to prepaid deliveries.
- Snapshot mode and owning organization/hub at explicit Courier completion intent. Existing pending intents remain manual when settings change.
- Automatic mode requires a valid private photo and matching intent plus existing task/revision checks, without visual-quality assessment.
- Queue jobs use the shared finalization service and system attribution; periodic recovery retries lost jobs. Validation conflicts fall back to manual review.
- COD always requires manual review and explicit UI cash acknowledgment. Confirmed COD creates the separate Courier cash obligation.
- History records accepted/corrected proofs, reviewer/system, timestamps and reason; rejected proof never becomes delivery failure.
- Preserve retry identity after uncertain approval. Prevent stale photo responses crossing Order selection and revoke obsolete previews.
- Source: [Onfleet completion requirements](https://docs.onfleet.com/reference/completion-requirements), [Bringg delivery documentation](https://help.bringg.com/delivery-hub/docs/release-notes).

- Prepaid fulfillment does not create COD receivables or settlement entries. Prepaid payment capture/settlement remain outside this revision.

## Courier mockup submission clarification (2026-10-22)

The harness uses one **Delivered** action to upload the selected private photo then submit its matching intent. Photo upload alone does not create a pending confirmation entry. The queue continues to require both records and current hub/task scope; it must never fabricate an intent for an uploaded photo. The harness preserves upload/intent retry identities and reconciles uncertain results before reporting success.
