import Link from "next/link";
import { ProductCard } from "@/components/marketplace/product-card";
import { PublicReadFailure } from "@/components/search/public-read-failure";
import type { ShopBrowseResponse } from "@/lib/marketplace/types";
import type { PublicApiResult } from "@/lib/marketplace/server";
import { shopProductsHref } from "@/lib/marketplace/discovery-url";
import { BrowsePagination, CategoryFilter } from "./browse-controls";
import { ShopSearch } from "./shop-search";

export function ShopProductsContent({ slug, name, query, category, result }: {
  slug: string;
  name: string;
  query: string;
  category: string | null;
  result: PublicApiResult<ShopBrowseResponse>;
}) {
  const data = result.status === "success" ? result.data : null;
  return <section className="mt-7" aria-labelledby="shop-products-heading">
    <div className="mb-5 flex flex-col gap-4 border-b border-[#DED7E1] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id="shop-products-heading" tabIndex={-1} className="text-xl font-bold text-[#2A1C2E] focus-visible:outline-2 focus-visible:outline-[#E6007A] sm:text-2xl">Products</h2>
        {data && <p className="mt-1 text-sm text-[#6B5F6F]" role="status">{data.pagination.total.toLocaleString("en-PH")} product{data.pagination.total === 1 ? "" : "s"}{query || category ? " matching your filters" : ""}</p>}
      </div>
      {data && data.categories.length > 0 && <CategoryFilter categories={data.categories} label="Product category" parameter="category" selected={category} targetId="shop-products-heading" />}
    </div>
    <ShopSearch key={`${slug}:${query}:${category}`} slug={slug} query={query} category={category} />
    {data ? <>
      {data.items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data.items.map((product, index) => <ProductCard key={product.id} product={product} position={index + 1} section="shop_storefront" priority={index < 5} />)}
      </div> : <div className="rounded-lg border border-[#E2DCE4] bg-white px-5 py-7">
        <h3 className="font-semibold text-[#3E3242]">{data.pagination.total > 0 ? "No products on this page" : query || category ? "No products matched these Shop filters" : "This Shop has no published products yet"}</h3>
        <p className="mt-2 text-sm text-[#726776]">{query || category ? "Change or clear the filters to search this Shop again." : "Check back for new products."}</p>
      </div>}
      <BrowsePagination pagination={data.pagination} label={`${name} product pages`} targetId="shop-products-heading" />
    </> : result.status !== "success" && <PublicReadFailure key={JSON.stringify(result)} result={result} subject="Shop products">
      {result.status === "invalid" && <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[#4C1268] underline focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={shopProductsHref(slug, "", null)}>Reset Shop filters</Link>}
    </PublicReadFailure>}
  </section>;
}
