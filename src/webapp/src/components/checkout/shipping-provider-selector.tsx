import type { CheckoutLogisticsOptions } from "@/lib/checkout/types";

type ShopOptions = CheckoutLogisticsOptions["groups"][number];

export function ShippingProviderSelector({
  disabled,
  options,
  selectedProviderId,
  selectedShippingFee,
  onSelect,
  formatAmount,
}: {
  disabled: boolean;
  options: ShopOptions | undefined;
  selectedProviderId: string | undefined;
  selectedShippingFee?: string;
  onSelect: (providerId: string) => void;
  formatAmount: (value: string) => string;
}) {
  return (
    <fieldset className="border-t border-[#E6E0E8] px-4 py-4 sm:px-5" disabled={disabled}>
      <legend className="mb-3 text-sm font-semibold text-[#302534]">
        Shipping option
      </legend>
      {!options ? (
        <p className="text-sm text-[#665A6A]" role="status">
          Loading shipping options…
        </p>
      ) : options.options.length === 0 ? (
        <p className="border-l-2 border-[#FF8800] pl-3 text-sm leading-5 text-[#765226]" role="status">
          No shipping provider can quote this Shop order right now. Refresh checkout to try again.
        </p>
      ) : (
        <div className="space-y-2">
          {options.options.map((provider) => {
            const selected = provider.organizationId === selectedProviderId;
            const inputId = `${options.shop.id}-${provider.organizationId}`;

            return (
              <label
                key={provider.organizationId}
                htmlFor={inputId}
                className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 border px-3 py-2.5 text-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#4C1268] ${
                  selected
                    ? "border-[#E6007A] bg-[#FFF7FB]"
                    : "border-[#DDD5E0] bg-white hover:border-[#A99BAC]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    id={inputId}
                    type="radio"
                    name={`shipping-provider-${options.shop.id}`}
                    value={provider.organizationId}
                    checked={selected}
                    onChange={() => onSelect(provider.organizationId)}
                    className="size-4 shrink-0 accent-[#E6007A]"
                  />
                  <span className="min-w-0 break-words font-medium text-[#302534]">{provider.businessName}</span>
                </span>
                <span className="shrink-0 font-semibold text-[#3A2E3E]">
                  {formatAmount(
                    selected && selectedShippingFee
                      ? selectedShippingFee
                      : provider.shippingFee,
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
