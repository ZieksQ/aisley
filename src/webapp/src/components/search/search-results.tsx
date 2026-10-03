import { ProductCard } from "@/components/marketplace/product-card";
import { BrowsePagination } from "@/components/shops/browse-controls";
import { ShopCard } from "@/components/shops/shop-card";
import type { ProductSearchResponse, ShopSearchResponse } from "@/lib/marketplace/types";
import type { PublicApiResult } from "@/lib/marketplace/server";
import { PublicReadFailure } from "./public-read-failure";

export type SearchSelection =
  | { mode: "products"; result: PublicApiResult<ProductSearchResponse> }
  | { mode: "shops"; result: PublicApiResult<ShopSearchResponse> };

export function SearchResults({ selection, query }: { selection: SearchSelection; query: string }) {
  if (selection.result.status !== "success") {
    return <PublicReadFailure key={JSON.stringify(selection.result)} result={selection.result} subject="Search" />;
  }
  const { items, pagination } = selection.result.data;
  return (
    <>
      <p className="mb-5 text-sm text-[#6B5F6F]" role="status">
        {pagination.total.toLocaleString("en-PH")} {selection.mode === "shops" ? "shop" : "product"}{pagination.total === 1 ? "" : "s"}
      </p>
      {!items.length ? (
        <section className="rounded-lg border border-[#E2DCE4] bg-white px-5 py-7">
          <h2 className="font-semibold text-[#3E3242]">
            {pagination.total > 0 ? `No ${selection.mode} on this page` : `No ${selection.mode} matched “${query}”.`}
          </h2>
          <p className="mt-2 text-sm text-[#726776]">
            {pagination.total > 0 ? "Return to an earlier page to see the matching results." : "Try another query."}
          </p>
        </section>
      ) : selection.mode === "shops" && selection.result.status === "success" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selection.result.data.items.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
        </div>
      ) : selection.mode === "products" && selection.result.status === "success" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {selection.result.data.items.map((product, index) => (
            <ProductCard key={product.id} product={product} position={index + 1} section="search_results" priority={index < 6} />
          ))}
        </div>
      ) : null}
      <BrowsePagination pagination={pagination} label="Search result pages" targetId="search-results-heading" />
    </>
  );
}
