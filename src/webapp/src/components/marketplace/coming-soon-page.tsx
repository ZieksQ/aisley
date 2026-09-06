import Link from "next/link";
import type { ReactNode } from "react";

import { HomeDataProvider } from "./home-data-provider";
import { MarketplaceHeader, UtilityBar } from "./marketplace-header";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export async function ComingSoonPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-5 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[#726776]">
          <Link href="/" className="hover:text-[#4C1268] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]">
            Home
          </Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold text-[#2A1C2E]">{title}</h1>
          <h2 className="mt-6 text-xl font-semibold text-[#4C1268]">Coming soon</h2>
          <div className="mt-3 space-y-4 text-base leading-7 text-[#5E5262]">
            {children}
          </div>
          <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-md border border-[#CFC4D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]">
            Continue shopping
          </Link>
        </div>
      </main>
    </HomeDataProvider>
  );
}
