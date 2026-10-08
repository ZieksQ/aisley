# Admin vouchers

## Contract

Follow the [shared voucher authoring specification](../../shared/voucher-authoring/spec.md) and [web design contract](../../../design.md).

Admin manages App vouchers only, funded by the platform, including merchandise and shipping benefits. Read permission is `vouchers.view`; all mutations also require `vouchers.manage`. Route and navigation: `/vouchers` under Platform. Read-only Admins see live/draft terms, history and savings without mutation controls.

The shared contract owns lifecycle, complete terms, revision/idempotency, privacy, UTC/Manila schedules, UI states, checkout preservation and verification criteria. No feature permits Customer targeting, code-entry, claiming or hard deletion.
