import Link from "next/link";
import { FiCheck, FiMapPin } from "react-icons/fi";

import type { CustomerAddress } from "@/lib/checkout/types";

function addressSummary(address: CustomerAddress) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.barangay,
    address.cityMunicipality,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

export function CheckoutDeliverySection({ address }: { address: CustomerAddress | undefined }) {
  return (
    <section className="border border-[#DED7E1] bg-white p-4 sm:p-5" aria-labelledby="delivery-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="delivery-heading" className="text-base font-semibold text-[#2D2231]">Delivery address</h2>
        <Link
          href="/account/addresses?returnTo=%2Fcheckout"
          className="inline-flex min-h-9 items-center rounded-md px-2 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          {address ? "Change address" : "Add address"}
        </Link>
      </div>
      {address ? (
        <div className="mt-4 flex gap-3 border border-[#DDD5E0] p-3.5">
          <FiMapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#E6007A]" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-[#302534]">
              {address.label || "Delivery address"}
              {address.isDefault ? <span className="ml-2 text-xs font-medium text-[#6D1748]">Default</span> : null}
            </p>
            <p className="mt-1 text-[#514656]">{address.recipientName} · {address.contactNumber}</p>
            <p className="mt-1 leading-5 text-[#746978]">{addressSummary(address)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#665A6A]">
          No shipping address is saved. Add one from your Address Book to continue.
        </p>
      )}
    </section>
  );
}

export function CheckoutPaymentSection() {
  return (
    <section className="border border-[#DED7E1] bg-white p-4 sm:p-5" aria-labelledby="payment-heading">
      <h2 id="payment-heading" className="text-base font-semibold text-[#2D2231]">Payment</h2>
      <div className="mt-3 flex items-start gap-3 border border-[#E6007A] bg-[#FFF7FB] p-3.5">
        <span className="mt-0.5 grid size-5 place-items-center rounded-full bg-[#E6007A] text-white">
          <FiCheck aria-hidden="true" className="size-3.5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#302534]">Cash on delivery</p>
          <p className="mt-1 text-xs leading-5 text-[#746978]">
            Pay when your order is delivered. Other payment methods are not available yet.
          </p>
        </div>
      </div>
    </section>
  );
}
