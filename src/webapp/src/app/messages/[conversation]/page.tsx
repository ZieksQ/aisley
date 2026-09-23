import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { MessageThreadContent } from "@/components/messages/message-thread-content";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = { title: "Conversation", robots: { index: false, follow: false } };

export default async function ConversationPage({ params }: { params: Promise<{ conversation: string }> }) {
  const [homepage, { conversation }] = await Promise.all([getPublicHomepage(marketplaceConfig.discoveryPageSize), params]);
  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-7 sm:px-5 lg:px-8">
        <Link className="text-sm font-semibold text-[#4C1268] hover:underline" href="/messages">← Messages</Link>
        <div className="mt-4"><MessageThreadContent id={conversation} /></div>
      </main>
    </HomeDataProvider>
  );
}
