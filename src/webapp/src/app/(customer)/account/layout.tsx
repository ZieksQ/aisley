import type { ReactNode } from "react";

import { AccountNavigation } from "@/components/account/account-navigation";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-5 lg:px-8 lg:py-8">
        <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <AccountNavigation />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </HomeDataProvider>
  );
}
