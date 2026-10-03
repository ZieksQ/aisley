import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiChevronRight } from "react-icons/hi2";

import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { PublicReadFailure } from "@/components/search/public-read-failure";
import { ShopProductsContent } from "@/components/shops/shop-products-content";
import { ShopHeader } from "@/components/shops/shop-header";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { parseShopParameters } from "@/lib/marketplace/discovery-url";
import { getPublicHomepage, getPublicShop, getPublicShopProducts } from "@/lib/marketplace/server";

type ShopPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
  const { query, category, page, error } = parseShopParameters(parameters);
  const [homepage, shopResult, productsResult] = await Promise.all([
    getPublicHomepage(marketplaceConfig.discoveryPageSize),
    getPublicShop(slug),
    error
      ? Promise.resolve({ status: "invalid" as const, message: error })
      : getPublicShopProducts(slug, category, page, 20, query),
  ]);

  if (shopResult.status === "not_found" || productsResult.status === "not_found") notFound();

  if (shopResult.status !== "success") {
    return (
      <HomeDataProvider initialData={homepage} trackView={false}>
        <UtilityBar />
        <MarketplaceHeader />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-10 text-center sm:px-5 lg:px-8">
          <h1 className="text-2xl font-bold text-[#2A1C2E]">Shop unavailable</h1>
          <PublicReadFailure key={JSON.stringify(shopResult)} result={shopResult} subject="Shop" />
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

        <ShopProductsContent slug={shop.slug} name={shop.name} query={query} category={category} result={productsResult} />
      </main>
    </HomeDataProvider>
  );
}
