# Legacy Shop shipping voucher funding — 2026-10-10 (B06)

Contract source: AISLEY branch `feature/fix-legacy-voucher-funding`, Laravel `/api/v1`.
This adds server eligibility/error behavior; external Flutter adoption and existing release gates remain unverified.

- Current Seller authoring cannot create shipping vouchers. Persisted legacy Shop shipping terms remain eligible only when the target Shop can fund their entire saving after Seller merchandise discounts and rounded Seller commission. App funding and other Shops cannot cover this obligation. Equality permits zero Seller proceeds; the server never reduces advertised saving to fit capacity.
- Candidate DTO shape stays unchanged. An unaffordable legacy candidate has `eligible: false`, `reason: "VOUCHER_FUNDING_INSUFFICIENT"`, `saving: "0.00"`. Render a readable explanation such as “This Shop shipping voucher is unavailable for these items. Choose another voucher.” Keep it unselectable; do not calculate Seller funding in Flutter.
- Candidate eligibility considers the selected merchandise voucher, independent of submitted/UUID ordering. Existing unavailable/expired/item/capacity reasons take precedence. A successful quote still requires the entire selected pair to be eligible.
- `POST /api/v1/customer/checkout/quote` rejects an explicitly selected shortfall with HTTP 409 and field `vouchers`:

```json
{"code":"VOUCHER_FUNDING_INSUFFICIENT","message":"This Shop shipping voucher cannot fund its full saving for these items. Remove it or choose another voucher.","errors":{"vouchers":["This Shop shipping voucher cannot fund its full saving for these items. Remove it or choose another voucher."]}}
```

- `POST /api/v1/customer/checkout/place` revalidates under the existing transaction. An outstanding unfunded quote or new funding loss returns HTTP 409 `QUOTE_STALE`, field `vouchers`, with an actionable message and no batch, Orders, reservations, redemptions or Cart cleanup. Refresh, remove/change the offending choice and require reviewed Place; do not automatically place.
- Preserve the existing uncertain-placement rule: retain the original frozen payload/quote/key through transport failure and unrecognized errors. Only a confirmed refreshable quote rejection permits fresh review. A committed matching request still replays its original batch even if current voucher terms are now unfunded.
- Zero-shipping/zero-saving choices retain their existing redemption behavior. Request fields, success DTOs, bearer authentication, consent, ownership and currency rules stay the same.
- Already-placed shortfall Orders retain their immutable pricing and may still fail delivery recognition. Separate authorized remediation must determine funding; this fix creates no historical rewrite, platform-funded expense or Seller debt.

Validate candidate/rejection parsing, selected-pair refresh, placement `QUOTE_STALE`, exact uncertain replay and account cleanup in the external client. Backend SQLite and synthetic storefront checks are recorded in Progress; they do not certify Flutter adoption, PostgreSQL concurrency, live deployment or Android/device behavior.
