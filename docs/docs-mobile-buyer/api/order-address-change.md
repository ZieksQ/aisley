# Reviewed Order address changes — 2026-11-04

Backend/storefront contract revision; external Buyer Flutter adoption and live/device acceptance remain unverified. Existing Flutter contact-only behavior remains supported. This adds no Courier API or client requirement.

Only Customer-owned `placed` Orders with pending COD, existing items/address and no downstream pickup, waybill, parcel or first-mile task can change. Seller approval closes the window. Use Sanctum bearer authentication for the external Buyer; storefront sessions use cookies and CSRF. Consent/RBAC/ownership gates remain authoritative. Every response on modification routes, including failures, is private/no-store.

## Quote and confirm

1. Fetch saved addresses through the existing Address Book API. Offer shipping/both rows without editing them. Mark an unchanged current address and require a different selection.
2. `POST /api/v1/customer/orders/{order}/modification/quote` with `{address_id: UUID, expected_revision: integer >= 1}`. No idempotency header is required: this creates only a short-lived review, not an Order mutation.
3. Success: HTTP 200 `{data:OrderAddressQuote}`. `quoteId` is a UUID; `expiresAt` is an ISO UTC timestamp ten minutes in the future; `expectedRevision` is an integer. `address` is the saved-address DTO returned by the server, and `shippingProvider` contains `id` and `businessName`. Both `previous` and `proposed` contain decimal-string `shippingFee`, `shippingDiscount`, `payable`, and string `currency`.
4. Show the **server-returned** recipient/address, provider and current/new fee, saving and COD. Explicit confirmation is required even if the total is unchanged. Changing the draft selection invalidates the reviewed quote.
5. `PATCH /api/v1/customer/orders/{order}/modification` sends `{address_id, expected_revision, quote_id}` with a UUID `Idempotency-Key`. Success is HTTP 200 `{data:Order}` with the current committed address/version, totals, capabilities, timeline and effective voucher savings.

The provider stays the same. Shipping uses stored parcel measurements/quantities/origin/category and current complete-route tariffs; merchandise prices and discounts stay unchanged. The current shipping saving is capped at the new fee with its original issuer funding. Vouchers are not redeemed again or revalidated for expiry; capacity and original redemption/snapshot facts remain unchanged. An address change cannot increase an already capped saving later. Original commission policies remain; revised shipping funding must balance.

The backend appends address and pricing versions atomically, updates current COD, records one history event and notifies both active owners after commit. Customer type `customer-order.address-changed` uses the existing Orders category and DTO, safe reference-only copy and `/orders/{order}` destination; it contains no full address or recipient. Original snapshots remain historical. Later fulfillment, Seller, finance and Customer/Batch projections use the latest committed terms. No arbitrary item/quantity/provider/voucher/status/payment edits are permitted.

## Failures and retry

- `401` unauthenticated; `403` role/account/consent denial; `404` Order outside Customer scope. Retain existing identity/consent handling.
- `422 ADDRESS_NOT_FOUND`, `ADDRESS_NOT_SHIPPING`, `ADDRESS_INCOMPLETE`: explain the saved-address problem on `address_id`. Do not offer inline Address Book editing in the Order flow.
- `409 ADDRESS_UNCHANGED`, `ORDER_REVISION_STALE`, `ORDER_NOT_MODIFIABLE`: refetch current detail/capabilities and require renewed review; remove actions after Seller processing.
- `409 SHIPPING_COVERAGE_UNAVAILABLE`: current provider cannot deliver; keep the original Order and ask for another saved address. Provider enablement/rate/parcel-limit failures also block review without substitution or fallback.
- `409 ORDER_PRICING_UNAVAILABLE`: historical parcel/pricing inputs are insufficient; destination changes are unavailable. Legacy contact-only correction remains supported.
- `409 MODIFICATION_QUOTE_EXPIRED` / `MODIFICATION_QUOTE_STALE` on `quote_id`: refresh the review and obtain explicit confirmation. Same-second saved-address edits, Order/address revisions and material route/rate changes invalidate review.
- Freeze quote/address/revision/key before confirmation. Transport errors, `429`, `5xx`, unknown failures and `409 IDEMPOTENCY_KEY_REUSED` preserve that exact request for reconciliation; block draft edits while unresolved. Committed same-key replay resolves before quote expiry/source deletion/current status checks and creates no duplicate revisions, reservations or redemptions. Changed payload under the same key conflicts.
- Quote transport failure is safe to retry as a new review because it has no Order effects. Cancellation/Back before confirmation leaves the Order untouched. Ignore late replies after logout/account departure. No optimistic success or offline queued mutation.

## Compatibility and verification

PATCH without `quote_id` retains the previous contact-only contract: optional nullable `expected_revision`, same trimmed destination/pin, and `422 ADDRESS_LOCATION_CHANGE_NOT_ALLOWED` for geographic differences. Old clients are not silently switched to repricing. Their adoption status stays unchanged until external source/device evidence exists.

Backend tests cover scoping, frozen inputs, cap/funding, immutable history, rollback, exact replay and PostgreSQL races. Storefront checks cover selection/review/confirmation, narrow/short dialogs, keyboard focus, quote errors and uncertain retry. These do not prove Flutter adoption, live API deployment or assistive-technology acceptance. Deploy the additive migration before the API and storefront. Committed pricing history requires forward-migration recovery rather than rollback that would collapse revisions.
