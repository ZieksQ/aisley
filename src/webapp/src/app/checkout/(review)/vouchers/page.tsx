import type { Metadata } from "next";
import { VoucherSelectionContent } from "@/components/checkout/voucher-selection-content";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import {
  MarketplaceHeader,
  UtilityBar,
} from "@/components/marketplace/marketplace-header";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = {
  title: "Select vouchers",
  robots: { index: false, follow: false },
};

export default async function CheckoutVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string | string[] }>;
}) {
  const parameters = await searchParams;
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);
  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-12 pt-5 sm:px-5 lg:px-8 lg:pt-7">
        <VoucherSelectionContent
          shopId={
            typeof parameters.shop === "string" ? parameters.shop : undefined
          }
        />
      </main>
    </HomeDataProvider>
  );
}
