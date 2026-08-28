import type { Metadata } from "next";

import { CategorySection } from "@/components/marketplace/category-section";
import { DiscoveryFeed } from "@/components/marketplace/discovery-feed";
import { FlashDealsSection } from "@/components/marketplace/flash-deals-section";
import { HeroCampaignWindow } from "@/components/marketplace/hero-campaign-window";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { HomepageAnalytics } from "@/components/marketplace/homepage-analytics";
import {
  MarketplaceHeader,
  UtilityBar,
} from "@/components/marketplace/marketplace-header";
import { ProductRail } from "@/components/marketplace/product-rail";
import { QuickActions } from "@/components/marketplace/quick-actions";
import { RecentlyViewedSection } from "@/components/marketplace/recently-viewed-section";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

const title = "Aisley | Shop Products, Deals & Local Marketplace Finds";
const description =
  "Discover products, current deals, and everyday marketplace finds from trusted Aisley sellers in the Philippines.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  keywords: [
    "Aisley marketplace",
    "online shopping Philippines",
    "local sellers",
    "marketplace deals",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Aisley",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const revalidate = 60;

export default async function Home() {
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Aisley",
        url: siteUrl,
        logo: `${siteUrl}/aisley-logo-with-title.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Aisley",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <HomeDataProvider initialData={homepage}>
      <HomepageAnalytics />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <UtilityBar />
      <MarketplaceHeader />

      <main className="flex-1">
        <h1 className="sr-only">
          Aisley marketplace products, deals, and local finds
        </h1>

        <div className="mx-auto max-w-[1400px] px-4 pb-5 pt-4 sm:px-5 sm:pt-5 lg:px-8">
          <HeroCampaignWindow
            heroCampaigns={homepage.campaigns.hero}
            sideCampaigns={homepage.campaigns.side}
          />
        </div>

        <QuickActions actions={homepage.quickActions} />

        <div className="mx-auto max-w-[1400px] space-y-9 px-4 py-8 sm:px-5 lg:space-y-11 lg:px-8 lg:py-10">
          <CategorySection categories={homepage.categories} />
          <FlashDealsSection />
          <ProductRail
            id="top-products"
            title="Top products"
            actionHref="/products?sort=top"
            products={homepage.topProducts}
          />
          <RecentlyViewedSection />
          <DiscoveryFeed />
        </div>
      </main>
    </HomeDataProvider>
  );
}
