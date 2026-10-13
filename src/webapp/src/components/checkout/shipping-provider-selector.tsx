import Link from "next/link";
import { FiChevronRight, FiTruck } from "react-icons/fi";
import type { CheckoutLogisticsOptions } from "@/lib/checkout/types";

type ShopOptions = CheckoutLogisticsOptions["groups"][number];

export function ShippingProviderSelector({
  disabled, options, selectedProviderId, selectedShippingFee, formatAmount,
}: {
  disabled: boolean;
  options: ShopOptions | undefined;
  selectedProviderId: string | undefined;
  selectedShippingFee?: string;
  formatAmount: (value: string) => string;
}) {
  const provider = options?.options.find((item) => item.organizationId === selectedProviderId);
  const content = (
    <>
      <FiTruck aria-hidden="true" className="size-5 shrink-0 text-[#4C1268]" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[#302534]">Delivery provider</span>
        <span className="mt-1 block break-words text-[#665A6A]">
          {provider?.businessName ?? "Select a delivery provider"}
        </span>
      </span>
      {provider ? <span className="shrink-0 font-semibold text-[#3A2E3E]">{formatAmount(selectedShippingFee ?? provider.shippingFee)}</span> : null}
      {!disabled ? <><span className="shrink-0 font-medium text-[#E6007A]">{provider ? "Change" : "Select"}</span><FiChevronRight aria-hidden="true" className="shrink-0" /></> : null}
    </>
  );
  return (
    <div className="border-t border-[#E6E0E8] px-4 py-4 text-sm sm:px-5">
      {!options ? <p role="status">Loading delivery providers…</p> : !options.options.length ? (
        <p className="border-l-2 border-[#FF8800] pl-3 leading-5 text-[#765226]" role="status">
          Delivery is unavailable for this Shop at your address. Change your delivery address or refresh shipping options to try again.
        </p>
      ) : disabled ? (
        <div aria-disabled="true" className="flex min-h-11 flex-wrap items-center gap-3">{content}</div>
      ) : (
        <Link href={`/checkout/delivery?shop=${encodeURIComponent(options.shop.id)}`} aria-label={`Change delivery provider for ${options.shop.name}`} className="flex min-h-11 flex-wrap items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
          {content}
        </Link>
      )}
    </div>
  );
}
