import Link from "next/link";
import { FiChevronDown } from "react-icons/fi";

import type {
  CheckoutLogisticsOptions,
  CheckoutQuote,
  CheckoutVoucher,
  VoucherSelection,
} from "@/lib/checkout/types";
import { ProductImage } from "@/components/marketplace/product-image";
import { ShippingProviderSelector } from "./shipping-provider-selector";

export function ShopCheckoutGroup({
  group,
  shippingOptions,
  selectedProviderId,
  onSelectProvider,
  disabled,
  onToggleVoucher,
  selectedVouchers,
  formatAmount,
  voucherReasons,
}: {
  group: CheckoutQuote["groups"][number];
  shippingOptions: CheckoutLogisticsOptions["groups"][number];
  selectedProviderId: string | undefined;
  onSelectProvider: (providerId: string) => void;
  disabled: boolean;
  onToggleVoucher: (voucher: CheckoutVoucher, shopId: string) => Promise<void>;
  selectedVouchers: VoucherSelection[];
  formatAmount: (value: string) => string;
  voucherReasons: Record<string, string>;
}) {
  return (
    <section
      className="border border-[#DED7E1] bg-white"
      aria-labelledby={`shop-${group.shop.id}`}
    >
      <h2
        id={`shop-${group.shop.id}`}
        className="border-b border-[#E6E0E8] px-4 py-3.5 text-base font-semibold text-[#2D2231] sm:px-5"
      >
        {group.shop.name}
      </h2>
      <div className="divide-y divide-[#EEE9EF]">
        {group.items.map((item) => (
          <div
            key={`${item.productId}:${item.variantId ?? "base"}`}
            className="flex items-start gap-3 px-4 py-4 text-sm sm:gap-4 sm:px-5"
          >
            <div className="relative size-14 shrink-0 overflow-hidden border border-[#E3DDE5] bg-[#F7F4F7]">
              <ProductImage src={item.imageUrl} alt={item.productName} sizes="56px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[#302534]">{item.productName}</p>
              {item.selectedOptions.length ? (
                <p className="mt-1 text-xs text-[#746978]">
                  {item.selectedOptions
                    .map((option) => `${option.group}: ${option.value}`)
                    .join(" · ")}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-[#887D8B]">
                Qty {item.quantity} · SKU {item.sku}
              </p>
            </div>
            <strong className="shrink-0 text-right text-[#3A2E3E]">
              {formatAmount(item.lineSubtotal)}
            </strong>
          </div>
        ))}
      </div>

      {group.availableVouchers.length ? (
        <details className="border-t border-[#E6E0E8] px-4 py-4 sm:px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#4C1268] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
            Shop and Aisley vouchers <FiChevronDown aria-hidden="true" />
          </summary>
          <div className="mt-3 space-y-2">
            {group.availableVouchers.map((voucher) => {
              const selected = selectedVouchers.some(
                (item) =>
                  item.voucher_id === voucher.id &&
                  item.target_shop_id === group.shop.id,
              );

              return (
                <div key={voucher.id}>
                  <button
                    type="button"
                    disabled={disabled || !voucher.eligible}
                    onClick={() => void onToggleVoucher(voucher, group.shop.id)}
                    aria-pressed={selected}
                    className={`w-full border p-3 text-left disabled:cursor-not-allowed ${selected ? "border-[#E6007A] bg-[#FFF7FB]" : "border-[#DDD5E0] bg-white"} disabled:bg-[#F5F2F5] disabled:text-[#8B808F]`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-sm font-semibold">
                          {voucher.name ?? voucher.code} ·{" "}
                          {voucher.issuerType === "app" ? "Aisley" : "Shop"}{" "}
                          {voucher.benefitType}
                        </span>
                        <span className="mt-1 block text-xs leading-5">
                          Code: {voucher.code}
                        </span>
                        <span className="mt-1 block text-xs leading-5">
                          {voucher.termsSummary ||
                            `${voucher.valueType === "percent" ? `${voucher.value}%` : formatAmount(voucher.value)} savings`}
                        </span>
                        {voucher.maximumDiscount ? (
                          <span className="mt-1 block text-xs leading-5">
                            Capped at {formatAmount(voucher.maximumDiscount)}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs font-semibold">
                        {voucher.eligible
                          ? `Save ${formatAmount(voucher.saving)}`
                          : "Unavailable"}
                      </span>
                    </span>
                    {!voucher.eligible && voucher.reason ? (
                      <span className="mt-2 block text-xs text-[#765226]">
                        {voucherReasons[voucher.reason] ??
                          "This voucher is not eligible for this Shop order."}
                      </span>
                    ) : null}
                    {voucher.issuerType === "app" ? (
                      <span className="mt-2 block text-xs text-[#746978]">
                        Applies only to {group.shop.name} when selected here.
                      </span>
                    ) : null}
                  </button>
                  {voucher.reason === "VOUCHER_NOT_CLAIMED" &&
                  voucher.collectionUrl &&
                  !disabled ? (
                    <Link
                      href={voucher.collectionUrl}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-[#4C1268] underline focus-visible:outline-2 focus-visible:outline-[#E6007A]"
                    >
                      Collect this voucher
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      <ShippingProviderSelector
        disabled={disabled}
        options={shippingOptions}
        selectedProviderId={selectedProviderId}
        selectedShippingFee={group.shippingQuote.shippingFee}
        onSelect={onSelectProvider}
        formatAmount={formatAmount}
      />

      <dl className="space-y-2 border-t border-[#E6E0E8] bg-[#FCFAFC] px-4 py-4 text-sm sm:px-5">
        <SummaryRow
          label="Merchandise"
          value={formatAmount(group.totals.merchandiseSubtotal)}
        />
        <SummaryRow
          label={`Shipping · ${group.shippingQuote.logisticsBusinessName}`}
          value={formatAmount(group.shippingQuote.shippingFee)}
        />
        {Number(group.totals.discount) > 0 ? (
          <SummaryRow
            label="Voucher discount"
            value={`−${formatAmount(group.totals.discount)}`}
            saving
          />
        ) : null}
        {Number(group.totals.shippingDiscount) > 0 ? (
          <SummaryRow
            label="Shipping discount"
            value={`−${formatAmount(group.totals.shippingDiscount)}`}
            saving
          />
        ) : null}
        <div className="flex justify-between gap-4 border-t border-[#E6E0E8] pt-2 font-semibold">
          <dt>COD for this order</dt>
          <dd className="text-[#E6007A]">
            {formatAmount(group.totals.payable)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function SummaryRow({
  label,
  saving = false,
  value,
}: {
  label: string;
  saving?: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#665A6A]">{label}</dt>
      <dd className={saving ? "font-medium text-[#3F6846]" : "text-[#3A2E3E]"}>
        {value}
      </dd>
    </div>
  );
}
