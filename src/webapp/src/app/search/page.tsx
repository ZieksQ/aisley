import type { Metadata } from "next";
import Link from "next/link";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { HomepageAnalytics } from "@/components/marketplace/homepage-analytics";
import {
  MarketplaceHeader,
  UtilityBar,
} from "@/components/marketplace/marketplace-header";
import { ProductCard } from "@/components/marketplace/product-card";
import { marketplaceConfig } from "@/lib/marketplace/config";
import {
  getPublicHomepage,
  searchPublicProducts,
} from "@/lib/marketplace/server";

type SearchPageProps = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

function normalizedPage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 10_000
    ? parsed
    : 1;
}

function searchHref(query: string, page: number) {
  const parameters = new URLSearchParams({ q: query, page: String(page) });
  return `/search?${parameters.toString()}`;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const parameters = await searchParams;
  const query = parameters.q?.trim().slice(0, 100) ?? "";

  return {
    title: query ? `Search results for “${query}”` : "Search products",
    description: query
      ? `Browse Aisley marketplace products matching ${query}.`
      : "Search products, categories, and shops on Aisley.",
    robots: { index: false, follow: true },
    alternates: { canonical: "/search" },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const parameters = await searchParams;
  const query = parameters.q?.trim().slice(0, 100) ?? "";
  const page = normalizedPage(parameters.page);
  const [homepage, results] = await Promise.all([
    getPublicHomepage(marketplaceConfig.discoveryPageSize),
    query ? searchPublicProducts(query, page, 20) : Promise.resolve(null),
  ]);

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <HomepageAnalytics />
      <UtilityBar />
      <MarketplaceHeader initialQuery={query} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-7 sm:px-5 lg:px-8 lg:py-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-[#726776]">
          <Link
            href="/"
            className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            Home
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span aria-current="page">Search</span>
        </nav>

        <div className="mb-6 border-b border-[#DED7E1] pb-5">
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-[#2A1C2E] sm:text-3xl">
            {query ? `Search results for “${query}”` : "Search the marketplace"}
          </h1>
          {results ? (
            <p className="mt-2 text-sm text-[#6B5F6F]">
              {results.pagination.total.toLocaleString("en-PH")} result
              {results.pagination.total === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        {!query ? (
          <div className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
            <p className="font-semibold text-[#3E3242]">
              Enter a product, category, or shop in the search bar.
            </p>
          </div>
        ) : results ? (
          results.items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {results.items.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    position={index + 1}
                    section="search_results"
                    priority={index < 6}
                  />
                ))}
              </div>

              {results.pagination.lastPage > 1 ? (
                <nav
                  aria-label="Search result pages"
                  className="mt-8 flex items-center justify-center gap-3"
                >
                  {results.pagination.currentPage > 1 ? (
                    <Link
                      href={searchHref(query, results.pagination.currentPage - 1)}
                      className="flex min-h-10 items-center gap-1 rounded-md border border-[#CFC4D2] bg-white px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
                    >
                      <FiChevronLeft aria-hidden="true" />
                      Previous
                    </Link>
                  ) : null}
                  <span className="text-sm text-[#675B6B]">
                    Page {results.pagination.currentPage} of {results.pagination.lastPage}
                  </span>
                  {results.pagination.currentPage < results.pagination.lastPage ? (
                    <Link
                      href={searchHref(query, results.pagination.currentPage + 1)}
                      className="flex min-h-10 items-center gap-1 rounded-md border border-[#CFC4D2] bg-white px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
                    >
                      Next
                      <FiChevronRight aria-hidden="true" />
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </>
          ) : (
            <div className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
              <p className="font-semibold text-[#3E3242]">
                No products matched “{query}”.
              </p>
              <p className="mt-2 text-sm text-[#726776]">
                Try a broader product name, category, or shop.
              </p>
            </div>
          )
        ) : (
          <div className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
            <p className="font-semibold text-[#3E3242]">
              Search is temporarily unavailable.
            </p>
            <p className="mt-2 text-sm text-[#726776]">
              Please try again in a moment.
            </p>
          </div>
        )}
      </main>
    </HomeDataProvider>
  );
}
