import { FiShield } from "react-icons/fi";

import type { CheckoutQuote } from "@/lib/checkout/types";

export function CheckoutSummary({
  quote,
  message,
  status,
  onPlaceOrder,
  formatAmount,
}: {
  quote: CheckoutQuote | null;
  message: string | null;
  status: "loading" | "ready" | "quoting" | "placing" | "uncertain" | "error";
  onPlaceOrder: () => void;
  formatAmount: (value: string) => string;
}) {
  return (
    <aside className="border border-[#DED7E1] bg-white p-5 lg:sticky lg:top-32" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="text-base font-semibold text-[#2D2231]">Order summary</h2>
      {quote ? (
        <>
          <dl className="mt-4 space-y-3 text-sm">
            <SummaryRow label="Merchandise" value={formatAmount(quote.summary.merchandiseSubtotal)} />
            <SummaryRow label="Shipping" value={formatAmount(quote.summary.shippingFee)} />
            {Number(quote.summary.discount) > 0 ? (
              <SummaryRow label="Voucher discount" value={`−${formatAmount(quote.summary.discount)}`} saving />
            ) : null}
            {Number(quote.summary.shippingDiscount) > 0 ? (
              <SummaryRow label="Shipping discount" value={`−${formatAmount(quote.summary.shippingDiscount)}`} saving />
            ) : null}
            <div className="flex items-end justify-between gap-4 border-t border-[#E6E0E8] pt-4">
              <dt className="font-semibold text-[#2D2231]">Total COD</dt>
              <dd className="text-xl font-semibold text-[#E6007A]">{formatAmount(quote.summary.payable)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-[#746978]">
            {quote.summary.orderCount} {quote.summary.orderCount === 1 ? "order" : "orders"} will be created, one per Shop.
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#746978]">
          {status === "uncertain" || status === "placing"
            ? "Confirming the original checkout with its reviewed items, shipping and totals."
            : "Choose a delivery address and shipping option for each Shop to calculate your totals."}
        </p>
      )}

      {message ? (
        <p role="alert" className="mt-4 border-l-2 border-[#FF3B30] pl-3 text-sm leading-5 text-[#B42318]">
          {message}
        </p>
      ) : null}
      {status === "quoting" ? (
        <p role="status" className="mt-4 text-sm text-[#665A6A]">
          Checking shipping options and refreshing checkout totals…
        </p>
      ) : null}

      <button
        type="button"
        disabled={status !== "uncertain" && (!quote || status !== "ready")}
        onClick={onPlaceOrder}
        className="mt-5 min-h-12 w-full rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] disabled:cursor-not-allowed disabled:bg-[#CFC6D2]"
      >
        {status === "placing" ? "Placing order…" : status === "uncertain" ? "Retry original order" : "Place order"}
      </button>
      <p className="mt-3 flex gap-2 text-xs leading-5 text-[#746978]">
        <FiShield aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Stock and vouchers are reserved only after the complete order is accepted.
      </p>
    </aside>
  );
}

function SummaryRow({ label, saving = false, value }: { label: string; saving?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#665A6A]">{label}</dt>
      <dd className={saving ? "font-medium text-[#3F6846]" : "text-[#3A2E3E]"}>{value}</dd>
    </div>
  );
}
