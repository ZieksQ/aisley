# Logistics Billing

## WHAT
- Show the organization's simulated payment method at `/settings/billing` in the dedicated [Settings workspace](../settings/spec.md). Legacy `/finance/billing` redirects there.
- The local gateway is a fake account, not a bank/card integration or real money.

## MUST
- Automatically provision one account per Logistics organization with zero initial PHP balance.
- Preserve existing accounts and balances. Display a generated masked account identifier, currency and active status.
- Never expose balance, raw account reference, full display identifier or gateway credentials to Logistics Billing.
- Courier cash receipts fund this account once; existing platform COD payments debit it and payouts credit it.
- Simulation remains controlled by the existing gateway environment switch; Admin keeps test balance/scenario controls.
- Logistics cannot edit arbitrary balances or create additional accounts.

## HOW
- GET `/api/v1/logistics/finance/billing` returns safe account metadata and simulator availability.
- Additive migration provisions existing organizations without resetting accounts; organization creation provisions future accounts.
- Account provisioning is also idempotent at the existing collection/payout entrypoints.
- Follow docs/design.md and Settings navigation, themes and shared UI. Courier cash and payment schedules remain linked Finance operations.
- Test zero funding, existing balance preservation, masking, ownership and disabled simulator behavior.
