import type { Metadata } from "next";
import Link from "next/link";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { HomepageAnalytics } from "@/components/marketplace/homepage-analytics";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { PublicReadFailure } from "@/components/search/public-read-failure";
import { SearchResults, type SearchSelection } from "@/components/search/search-results";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { parseSearchParameters, searchHref, type DiscoveryParameters } from "@/lib/marketplace/discovery-url";
import { getPublicHomepage, searchPublicProducts, searchPublicShops } from "@/lib/marketplace/server";

type SearchPageProps = { searchParams: Promise<DiscoveryParameters> };

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { query, mode, error } = parseSearchParameters(await searchParams);
  return {
    title: error ? "Check your search" : query ? `Search results for “${query}”` : `Search ${mode}`,
    description: "Search public products and shops on Aisley.",
    robots: { index: false, follow: true },
    alternates: { canonical: "/search" },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { query, mode, page, error } = parseSearchParameters(await searchParams);
  const [homepage, selection] = await Promise.all([
    getPublicHomepage(marketplaceConfig.discoveryPageSize),
    error || !query ? Promise.resolve(null) : mode === "shops"
      ? searchPublicShops(query, page, 20).then((result): SearchSelection => ({ mode: "shops", result }))
      : searchPublicProducts(query, page, 20).then((result): SearchSelection => ({ mode: "products", result })),
  ]);

  return <HomeDataProvider initialData={homepage} trackView={false}>
    <HomepageAnalytics />
    <UtilityBar />
    <MarketplaceHeader initialQuery={query} searchMode={mode} />
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-7 sm:px-5 lg:px-8 lg:py-10">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-[#726776]">
        <Link href="/" className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-[#E6007A]">Home</Link>
        <span aria-hidden="true" className="mx-2">/</span><span aria-current="page">Search</span>
      </nav>
      <div className="mb-5 border-b border-[#DED7E1] pb-4">
        <h1 id="search-results-heading" tabIndex={-1} className="break-words text-2xl font-bold text-[#2A1C2E] focus-visible:outline-2 focus-visible:outline-[#E6007A] sm:text-3xl">
          {error ? "Check your search" : query ? `Search results for “${query}”` : "Search the marketplace"}
        </h1>
        <nav aria-label="Search result type" className="mt-4 flex gap-6">
          {(["products", "shops"] as const).map((type) => <Link key={type} href={searchHref(query, type)}
            aria-current={mode === type ? "page" : undefined} prefetch={false}
            className="inline-flex min-h-11 items-center border-b-2 border-transparent text-sm font-semibold text-[#726776] underline-offset-4 hover:text-[#4C1268] focus-visible:outline-2 focus-visible:outline-[#E6007A] aria-[current=page]:border-[#E6007A] aria-[current=page]:text-[#4C1268]">
            {type === "products" ? "Products" : "Shops"}
          </Link>)}
        </nav>
      </div>
      {error ? <PublicReadFailure result={{ status: "invalid", message: error }} subject="Search" />
        : selection ? <SearchResults selection={selection} query={query} />
          : <p className="rounded-lg border border-[#E2DCE4] bg-white px-5 py-7">Enter {mode === "shops" ? "a Shop name" : "a product, category, or Shop name"} in the search bar.</p>}
    </main>
  </HomeDataProvider>;
}
