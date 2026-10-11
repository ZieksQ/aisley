import { StartConversationContent } from "@/components/messages/start-conversation-content";
import type { Metadata } from "next";
import { MessagePageShell } from "@/components/messages/message-page-shell";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { MessagesInboxContent } from "@/components/messages/messages-inbox-content";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : null;
  const shop = value("shop");
  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader compact />
      <MessagePageShell channel="shop" focusConversation={Boolean(shop)}>
        {shop ? <StartConversationContent shopId={shop} productId={value("product")} orderId={value("order")} /> : <MessagesInboxContent />}
      </MessagePageShell>
    </HomeDataProvider>
  );
}
