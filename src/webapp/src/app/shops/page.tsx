import type { Metadata } from "next";
import Link from "next/link";

import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { BrowsePagination, CategoryFilter, RetryButton } from "@/components/shops/browse-controls";
import { ShopCard } from "@/components/shops/shop-card";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage, getPublicShopDirectory } from "@/lib/marketplace/server";

export const metadata: Metadata = {
  title: "Browse shops",
  description: "Browse active seller shops and their products on Aisley.",
  alternates: { canonical: "/shops" },
  openGraph: {
    type: "website",
    url: "/shops",
    title: "Browse shops",
    description: "Browse active seller shops and their products on Aisley.",
  },
  twitter: {
    card: "summary",
    title: "Browse shops",
    description: "Browse active seller shops and their products on Aisley.",
  },
};

type ShopsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function singleParameter(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function pageParameter(value: string | string[] | undefined) {
  if (value === undefined) return { page: 1, invalid: false };
  if (typeof value !== "string") return { page: 1, invalid: true };
  const page = Number(value);

  return {
    page: Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
    invalid: !Number.isSafeInteger(page) || page < 1 || page > 10_000,
  };
}

export default async function ShopsPage({ searchParams }: ShopsPageProps) {
  const parameters = await searchParams;
  const category = singleParameter(parameters.shop_category);
  const requestedPage = pageParameter(parameters.page);
  const hasUnknownParameter = Object.keys(parameters).some(
    (key) => !["shop_category", "page"].includes(key),
  );
  const [homepage, result] = await Promise.all([
    getPublicHomepage(marketplaceConfig.discoveryPageSize),
    requestedPage.invalid || hasUnknownParameter
      ? Promise.resolve({ status: "invalid" as const, message: "The shop directory URL contains an unsupported filter." })
      : getPublicShopDirectory(category, requestedPage.page, 20),
  ]);

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-7 sm:px-5 lg:px-8 lg:py-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-[#726776]">
          <Link href="/" className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
            Home
          </Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span aria-current="page">Shops</span>
        </nav>

        <div className="mb-6 flex flex-col gap-4 border-b border-[#DED7E1] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 id="shop-directory-heading" tabIndex={-1} className="text-2xl font-bold tracking-[-0.025em] text-[#2A1C2E] outline-none sm:text-3xl">
              Browse shops
            </h1>
            {result.status === "success" ? (
              <p className="mt-2 text-sm text-[#6B5F6F]">
                {result.data.pagination.total.toLocaleString("en-PH")} active shop{result.data.pagination.total === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          {result.status === "success" ? (
            <CategoryFilter
              categories={result.data.categories}
              label="Shop category"
              parameter="shop_category"
              selected={category}
              targetId="shop-directory-heading"
            />
          ) : null}
        </div>

        {result.status === "success" ? (
          result.data.items.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {result.data.items.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
              </div>
              <BrowsePagination
                pagination={result.data.pagination}
                label="Shop directory pages"
                targetId="shop-directory-heading"
              />
            </>
          ) : (
            <section className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
              <h2 className="font-semibold text-[#3E3242]">No shops found</h2>
              <p className="mt-2 text-sm text-[#726776]">
                {category ? "There are no public shops in this category right now." : "There are no public shops to show right now."}
              </p>
              {category ? (
                <Link href="/shops" className="mt-4 inline-flex min-h-10 items-center rounded-md border border-[#CFC4D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
                  View all shops
                </Link>
              ) : null}
            </section>
          )
        ) : result.status === "invalid" ? (
          <section className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
            <h2 className="font-semibold text-[#3E3242]">This shop filter is not available</h2>
            <p className="mt-2 text-sm text-[#726776]">{result.message}</p>
            <Link href="/shops" className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
              Clear filters
            </Link>
          </section>
        ) : (
          <section className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
            <h2 className="font-semibold text-[#3E3242]">Shops are temporarily unavailable</h2>
            <p className="mt-2 text-sm text-[#726776]">Please try again in a moment.</p>
            <RetryButton />
          </section>
        )}
      </main>
    </HomeDataProvider>
  );
}
