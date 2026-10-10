import type { ReactNode } from "react";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import {
  MarketplaceHeader,
  UtilityBar,
} from "@/components/marketplace/marketplace-header";
import { getPublicHomepage } from "@/lib/marketplace/server";
import { marketplaceConfig } from "@/lib/marketplace/config";
import "@/components/vouchers/vouchers.css";

export default async function VouchersLayout({
  children,
}: {
  children: ReactNode;
}) {
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);
  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="customer-vouchers voucher-public-container">
        {children}
      </main>
    </HomeDataProvider>
  );
}
