import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { StartConversationContent } from "@/components/messages/start-conversation-content";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = { title: "Message Seller", robots: { index: false, follow: false } };

export default async function StartConversationPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [homepage, params] = await Promise.all([getPublicHomepage(marketplaceConfig.discoveryPageSize), searchParams]);
  const value = (field: string) => typeof params[field] === "string" ? params[field] as string : null;

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[700px] flex-1 px-4 py-7 sm:px-5 lg:px-8">
        <Link className="text-sm font-semibold text-[#4C1268] hover:underline" href="/messages">← Messages</Link>
        <div className="mt-4"><StartConversationContent orderId={value("order")} productId={value("product")} shopId={value("shop") ?? ""} /></div>
      </main>
    </HomeDataProvider>
  );
}
