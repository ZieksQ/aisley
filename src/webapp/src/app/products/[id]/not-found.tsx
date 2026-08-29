import Link from "next/link";

import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";

export default function ProductNotFound() {
  return (
    <>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <section className="w-full max-w-lg rounded-lg border border-[#DED7E1] bg-white p-7 text-center">
          <h1 className="text-2xl font-semibold text-[#2D2231]">Product not found</h1>
          <p className="mt-3 text-sm leading-6 text-[#675B6B]">
            This product may no longer be available, or the shop may be taking a break.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#E6007A] px-5 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]"
          >
            Browse products
          </Link>
        </section>
      </main>
    </>
  );
}
