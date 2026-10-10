import Link from "next/link";
import { FiChevronRight, FiTag } from "react-icons/fi";

import type {
  CheckoutLogisticsOptions,
  CheckoutQuote,
} from "@/lib/checkout/types";
import { ShippingProviderSelector } from "./shipping-provider-selector";

export function ShopCheckoutGroup({
  group,
  shippingOptions,
  selectedProviderId,
  onSelectProvider,
  disabled,
  formatAmount,
}: {
  group: CheckoutQuote["groups"][number];
  shippingOptions: CheckoutLogisticsOptions["groups"][number];
  selectedProviderId: string | undefined;
  onSelectProvider: (providerId: string) => void;
  disabled: boolean;
  formatAmount: (value: string) => string;
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
            className="flex items-start justify-between gap-4 px-4 py-4 text-sm sm:px-5"
          >
            <div className="min-w-0">
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
            <strong className="shrink-0 text-[#3A2E3E]">
              {formatAmount(item.lineSubtotal)}
            </strong>
          </div>
        ))}
      </div>

      {group.availableVouchers.length ? (
        <div className="border-t border-[#E6E0E8] px-4 py-3 sm:px-5">
          {disabled ? (
            <span
              aria-disabled="true"
              className="flex min-h-11 items-center gap-3 text-sm text-[#665A6A]"
            >
              <FiTag aria-hidden="true" /> Vouchers
            </span>
          ) : (
            <Link
              href={`/checkout/vouchers?shop=${encodeURIComponent(group.shop.id)}`}
              className="flex min-h-11 items-center gap-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
              aria-label={`Select vouchers for ${group.shop.name}`}
            >
              <FiTag aria-hidden="true" className="shrink-0 text-[#E6007A]" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[#4C1268]">
                  Vouchers
                </span>
                {group.appliedVouchers.length ? (
                  <span className="mt-0.5 block break-words text-xs text-[#665A6A]">
                    {group.appliedVouchers
                      .map((voucher) => voucher.name || voucher.code)
                      .join(" · ")}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 font-medium text-[#E6007A]">
                {group.appliedVouchers.length ? "Change" : "Select vouchers"}
              </span>
              <FiChevronRight
                aria-hidden="true"
                className="shrink-0 text-[#746978]"
              />
            </Link>
          )}
        </div>
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
