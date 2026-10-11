import type { Metadata } from "next";
import { MessagePageShell } from "@/components/messages/message-page-shell";
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
      <MarketplaceHeader compact />
      <MessagePageShell channel="shop" focusConversation>
        <MessageThreadContent id={conversation} />
      </MessagePageShell>
    </HomeDataProvider>
  );
}
