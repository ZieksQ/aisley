import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { MessagesInboxContent } from "@/components/messages/messages-inbox-content";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };

export default async function MessagesPage() {
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);
  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-7 sm:px-5 lg:px-8">
        <Link className="text-sm font-semibold text-[#4C1268] hover:underline" href="/">← Back to store</Link>
        <h1 className="mb-5 mt-4 text-2xl font-semibold text-[#281E2C]">Messages</h1>
        <MessagesInboxContent />
      </main>
    </HomeDataProvider>
  );
}
