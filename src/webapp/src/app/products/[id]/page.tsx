import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HiChevronRight } from "react-icons/hi2";

import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { ProductConfigurator } from "@/components/product/product-configurator";
import {
  ProductDescription,
  ProductSpecifications,
  RatingSummary,
  ShopSummary,
} from "@/components/product/product-detail-sections";
import { getPublicProduct } from "@/lib/marketplace/server";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getPublicProduct(id);

  if (!product) {
    return { title: "Product not found", robots: { index: false, follow: false } };
  }

  const description = product.shortDescription ?? `View ${product.title} from ${product.shop.name} on Aisley.`;
  const image = product.media[0]?.url;

  return {
    title: product.title,
    description,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: {
      type: "website",
      url: `/products/${product.id}`,
      title: product.title,
      description,
      images: image ? [{ url: image, alt: product.media[0]?.altText ?? product.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getPublicProduct(id);
  if (!product) notFound();

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription ?? undefined,
    image: product.media.map((item) => item.url),
    sku: product.variants.length === 0 ? product.id : undefined,
    brand: { "@type": "Brand", name: product.shop.name },
    aggregateRating:
      product.reviewCount > 0 && product.averageRating !== null
        ? { "@type": "AggregateRating", ratingValue: product.averageRating, reviewCount: product.reviewCount }
        : undefined,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/products/${product.id}`,
      priceCurrency: "PHP",
      price: product.price,
      availability: product.availability.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: product.shop.name },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <UtilityBar />
      <MarketplaceHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-4 sm:px-5 lg:px-8 lg:pb-16">
          <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 overflow-hidden text-xs text-[#746978]">
            <Link href="/" className="shrink-0 hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-[#E6007A]">Home</Link>
            <HiChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
            <Link href={product.shop.storefrontUrl} className="max-w-40 truncate hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-[#E6007A]">{product.shop.name}</Link>
            <HiChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
            <span aria-current="page" className="truncate text-[#4F4453]">{product.title}</span>
          </nav>

          <div className="rounded-lg border border-[#DED7E1] bg-white p-4 sm:p-5 lg:p-7">
            <ProductConfigurator product={product} />
          </div>

          <div className="mt-7 rounded-lg border border-[#DED7E1] bg-white px-5 py-6 sm:px-7 lg:px-9">
            <ShopSummary shop={product.shop} />
            <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
              <div className="space-y-10">
                <ProductDescription markdown={product.descriptionMarkdown} />
                <ProductSpecifications specifications={product.specifications} />
              </div>
              <RatingSummary
                averageRating={product.averageRating}
                reviewCount={product.reviewCount}
                soldCount={product.soldCount}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
