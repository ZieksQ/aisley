import type { Metadata } from "next";
import Link from "next/link";
import { HiChevronRight } from "react-icons/hi2";

import { CheckoutResult } from "@/components/checkout/checkout-result";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = {
  title: "Order confirmation",
  description: "Review the Shop orders placed in your Aisley checkout.",
  robots: { index: false, follow: false },
};

export default async function CheckoutResultPage({ params }: { params: Promise<{ batchId: string }> }) {
  const [{ batchId }, homepage] = await Promise.all([params, getPublicHomepage(marketplaceConfig.discoveryPageSize)]);
  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 pb-12 pt-5 sm:px-5 lg:px-8 lg:pb-16 lg:pt-7">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-[#746978]"><Link href="/" className="hover:text-[#E6007A]">Home</Link><HiChevronRight aria-hidden="true" className="size-3.5" /><span aria-current="page" className="text-[#4F4453]">Order confirmation</span></nav>
        <CheckoutResult batchId={batchId} />
      </main>
    </HomeDataProvider>
  );
}
