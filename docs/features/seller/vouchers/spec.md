# Seller vouchers

## Contract

Follow the [shared voucher authoring specification](../../shared/voucher-authoring/spec.md) and [web design contract](../../../design.md).

Seller manages merchandise vouchers for their own Shop only. Shop identity is derived from the approved active Seller session. Foreign definitions return 404; shipping authoring is rejected. Discounts reduce merchandise proceeds before commission, with no second settlement deduction. Route and navigation: `/vouchers` under Shop.

The shared contract owns lifecycle, complete terms, revision/idempotency, privacy, UTC/Manila schedules, UI states, checkout preservation and verification criteria. No feature permits Customer targeting, code-entry, claiming or hard deletion.
