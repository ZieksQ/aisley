import Link from "next/link";
import { FiMapPin } from "react-icons/fi";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

export const voucherReasons: Record<string, string> = {
  VOUCHER_CUSTOMER_INELIGIBLE: "This voucher is not available for your account.",
  VOUCHER_CUSTOMER_LIMIT: "You have already used this voucher.",
  VOUCHER_EXHAUSTED: "This voucher has reached its usage limit.",
  VOUCHER_EXPIRED: "This voucher has expired.",
  VOUCHER_INACTIVE: "This voucher is currently inactive.",
  VOUCHER_ITEMS_INELIGIBLE: "The selected products are not eligible.",
  VOUCHER_MINIMUM_SPEND: "This Shop order does not meet the minimum spend.",
  VOUCHER_NOT_STARTED: "This voucher is not available yet.",
  VOUCHER_PAYMENT_INELIGIBLE: "This voucher is not available for COD.",
  VOUCHER_TERMS_INVALID: "This voucher is temporarily unavailable.",
};

export function amount(value: string) {
  return money.format(Number(value));
}

export function CheckoutLoading() {
  return (
    <div aria-label="Loading checkout" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {[180, 130, 260].map((height) => (
          <div key={height} style={{ height }} className="animate-pulse border border-[#DED7E1] bg-white" />
        ))}
      </div>
      <div className="h-72 animate-pulse border border-[#DED7E1] bg-white" />
    </div>
  );
}

export function MissingIntent({ message }: { message: string | null }) {
  return (
    <div className="border border-[#DED7E1] bg-white px-5 py-12 text-center">
      <FiMapPin aria-hidden="true" className="mx-auto size-9 text-[#8B7D90]" />
      <h2 className="mt-4 text-lg font-semibold text-[#2D2231]">Checkout could not be started</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#665A6A]">{message}</p>
      <div className="mt-5 flex justify-center gap-3">
        <Link href="/cart" className="rounded-md bg-[#E6007A] px-4 py-2.5 text-sm font-semibold text-white">Return to cart</Link>
        <Link href="/" className="rounded-md border border-[#CFC6D2] bg-white px-4 py-2.5 text-sm font-semibold text-[#4C1268]">Browse products</Link>
      </div>
    </div>
  );
}
