import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiChevronRight } from "react-icons/hi2";

import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { ProductCard } from "@/components/marketplace/product-card";
import { BrowsePagination, CategoryFilter, RetryButton } from "@/components/shops/browse-controls";
import { ShopHeader } from "@/components/shops/shop-header";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage, getPublicShop, getPublicShopProducts } from "@/lib/marketplace/server";

type ShopPageProps = {
  params: Promise<{ slug: string }>;
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

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShop(slug);

  if (result.status !== "success") {
    return { title: "Shop not found", robots: { index: false, follow: false } };
  }

  const description = result.data.description ?? `Browse products from ${result.data.name} on Aisley.`;

  return {
    title: result.data.name,
    description,
    alternates: { canonical: `/shops/${result.data.slug}` },
    openGraph: {
      type: "website",
      url: `/shops/${result.data.slug}`,
      title: result.data.name,
      description,
      images: result.data.bannerUrl ? [{ url: result.data.bannerUrl, alt: `${result.data.name} shop banner` }] : undefined,
    },
    twitter: {
      card: result.data.bannerUrl ? "summary_large_image" : "summary",
      title: result.data.name,
      description,
      images: result.data.bannerUrl ? [result.data.bannerUrl] : undefined,
    },
  };
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const [{ slug }, parameters] = await Promise.all([params, searchParams]);
  const category = singleParameter(parameters.category);
  const requestedPage = pageParameter(parameters.page);
  const hasUnknownParameter = Object.keys(parameters).some((key) => !["category", "page"].includes(key));
  const [homepage, shopResult, productsResult] = await Promise.all([
    getPublicHomepage(marketplaceConfig.discoveryPageSize),
    getPublicShop(slug),
    requestedPage.invalid || hasUnknownParameter
      ? Promise.resolve({ status: "invalid" as const, message: "The shop URL contains an unsupported product filter." })
      : getPublicShopProducts(slug, category, requestedPage.page, 20),
  ]);

  if (shopResult.status === "not_found" || productsResult.status === "not_found") notFound();

  if (shopResult.status !== "success") {
    return (
      <HomeDataProvider initialData={homepage} trackView={false}>
        <UtilityBar />
        <MarketplaceHeader />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-10 text-center sm:px-5 lg:px-8">
          <h1 className="text-2xl font-bold text-[#2A1C2E]">Shop temporarily unavailable</h1>
          <p className="mt-2 text-sm text-[#726776]">Please try again in a moment.</p>
          <RetryButton />
        </main>
      </HomeDataProvider>
    );
  }

  const shop = shopResult.data;

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-12 pt-4 sm:px-5 lg:px-8 lg:pb-16">
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 overflow-hidden text-xs text-[#746978]">
          <Link href="/" className="shrink-0 hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-[#E6007A]">Home</Link>
          <HiChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
          <Link href="/shops" className="shrink-0 hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-[#E6007A]">Shops</Link>
          <HiChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
          <span aria-current="page" className="truncate text-[#4F4453]">{shop.name}</span>
        </nav>

        <ShopHeader shop={shop} />

        <section className="mt-7" aria-labelledby="shop-products-heading">
          <div className="mb-5 flex flex-col gap-4 border-b border-[#DED7E1] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="shop-products-heading" tabIndex={-1} className="text-xl font-bold text-[#2A1C2E] outline-none sm:text-2xl">Products</h2>
              {productsResult.status === "success" ? (
                <p className="mt-1 text-sm text-[#6B5F6F]">
                  {productsResult.data.pagination.total.toLocaleString("en-PH")} product{productsResult.data.pagination.total === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            {productsResult.status === "success" && productsResult.data.categories.length > 0 ? (
              <CategoryFilter
                categories={productsResult.data.categories}
                label="Product category"
                parameter="category"
                selected={category}
                targetId="shop-products-heading"
              />
            ) : null}
          </div>

          {productsResult.status === "success" ? (
            productsResult.data.items.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {productsResult.data.items.map((product, index) => (
                    <ProductCard key={product.id} product={product} position={index + 1} section="shop_storefront" priority={index < 5} />
                  ))}
                </div>
                <BrowsePagination pagination={productsResult.data.pagination} label={`${shop.name} product pages`} targetId="shop-products-heading" />
              </>
            ) : (
              <div className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
                <h3 className="font-semibold text-[#3E3242]">No products to show</h3>
                <p className="mt-2 text-sm text-[#726776]">
                  {category ? "This category has no available products right now." : "This shop has not published any products yet."}
                </p>
                {category ? (
                  <Link href={`/shops/${encodeURIComponent(shop.slug)}`} className="mt-4 inline-flex min-h-10 items-center rounded-md border border-[#CFC4D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">View all products</Link>
                ) : null}
              </div>
            )
          ) : productsResult.status === "invalid" ? (
            <div className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
              <h3 className="font-semibold text-[#3E3242]">This product filter is not available</h3>
              <p className="mt-2 text-sm text-[#726776]">{productsResult.message}</p>
              <Link href={`/shops/${encodeURIComponent(shop.slug)}`} className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">Clear filters</Link>
            </div>
          ) : (
            <div className="border border-[#E2DCE4] bg-white px-6 py-10 text-center">
              <h3 className="font-semibold text-[#3E3242]">Products are temporarily unavailable</h3>
              <p className="mt-2 text-sm text-[#726776]">Please try again in a moment.</p>
              <RetryButton />
            </div>
          )}
        </section>
      </main>
    </HomeDataProvider>
  );
}
