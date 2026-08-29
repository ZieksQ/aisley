import type { Metadata } from "next";
import Link from "next/link";
import { HiChevronRight } from "react-icons/hi2";

import { CartPageContent } from "@/components/cart/cart-page-content";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import {
  MarketplaceHeader,
  UtilityBar,
} from "@/components/marketplace/marketplace-header";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = {
  title: "Shopping cart",
  description: "Review and update the products in your Aisley shopping cart.",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-12 pt-5 sm:px-5 lg:px-8 lg:pb-16 lg:pt-7">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-1.5 text-xs text-[#746978]"
        >
          <Link
            href="/"
            className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            Home
          </Link>
          <HiChevronRight aria-hidden="true" className="size-3.5" />
          <span aria-current="page" className="text-[#4F4453]">
            Cart
          </span>
        </nav>

        <h1 className="mb-5 text-2xl font-semibold text-[#281E2C] sm:text-3xl">
          Shopping cart
        </h1>
        <CartPageContent />
      </main>
    </HomeDataProvider>
  );
}
