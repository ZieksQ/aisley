# Voucher selection update — 2026-10-09

Contract source: AISLEY branch `feature/voucher-names-stacking-ux`, Laravel `/api/v1`.
This delta follows the historical 22b0a48 inspection; Buyer names/pairing adoption has [B09 source/synthetic evidence](../references/voucher-selection-verification.md). Live/device gates remain open (G26).

- `POST /customer/checkout/quote` adds non-null string `name` to each candidate and applied voucher.
- Placement and `GET /customer/checkout/{batch}` add non-null string `name` to frozen Order vouchers. Historical names fall back to the stored code; current definition edits never replace historical names.
- Names are customer-visible plain text. Show name, benefit, savings cap (`maximumDiscount`) and savings; retain code as a secondary identifier. Selection still sends distinct UUIDs and explicit target Shop UUIDs, without code entry. The later collection contract requires owned collection for claim-required App and all Shop vouchers.
- One discount and one shipping voucher combine by default per Shop Order. Two of the same benefit are rejected regardless of issuer or legacy flags. Allow at most one App discount plus one App shipping per batch; each has an explicit eligible Shop target. The two App vouchers may target different Shops.
- `stackableWith` lists the opposite benefit for App and Shop issuers. Empty historical stored policies no longer disable pairing. The client replaces only a same-benefit App selection globally and a same-benefit selection within the target Shop.
- `APP_VOUCHER_LIMIT` remains 422 with field `vouchers`, now meaning more than one App voucher of the same benefit. `VOUCHER_BENEFIT_LIMIT` remains the per-Shop gate. `VOUCHERS_NOT_STACKABLE` is no longer emitted.
- Caps, half-up integer-cent calculations, minimum spend, capacity, locking, stale quotes, exact placement retries and funding remain server-owned.

Update the typed repository/models and selection state, then verify quote/place/batch parsing, two opposite App benefits, same-benefit rejection/replacement, frozen names and both capped fixed/percentage savings. Backend and web verification do not complete Flutter acceptance or earlier G25 shipping adoption.

## Current source/client distinction — 2026-10-15

Quote candidates and applied vouchers plus Checkout Batch voucher snapshots carry names. Customer Order detail/history currently exposes code/terms without a voucher name; do not invent that field. Buyer parses candidate/applied/Batch names with historical code fallback and replaces same-benefit choices using current quote candidate/applied metadata. Deselection removes only the exact UUID/target pair; pending uncertain placement keeps its original immutable payload/key. Discovery/collection/wallet are implemented locally; see [collection contract](voucher-collection.md) and [current gaps](../references/integration-gaps.md).
