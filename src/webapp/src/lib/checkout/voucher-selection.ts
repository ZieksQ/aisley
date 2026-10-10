import type { CheckoutQuote, CheckoutVoucher, VoucherSelection } from "./types";

export function toggleVoucherSelection(
  selections: VoucherSelection[],
  voucher: CheckoutVoucher,
  shopId: string,
  groups: CheckoutQuote["groups"],
): VoucherSelection[] {
  const selected = selections.some(
    (item) => item.voucher_id === voucher.id && item.target_shop_id === shopId,
  );
  if (!selected && !voucher.eligible) return selections;
  if (selected) {
    return selections.filter(
      (item) =>
        item.voucher_id !== voucher.id || item.target_shop_id !== shopId,
    );
  }

  const remaining = selections.filter((item) => {
    const previous = groups
      .find((group) => group.shop.id === item.target_shop_id)
      ?.availableVouchers.find((candidate) => candidate.id === item.voucher_id);
    if (previous?.benefitType !== voucher.benefitType) return true;
    return (
      item.target_shop_id !== shopId &&
      !(voucher.issuerType === "app" && previous.issuerType === "app")
    );
  });
  return [...remaining, { voucher_id: voucher.id, target_shop_id: shopId }];
}
