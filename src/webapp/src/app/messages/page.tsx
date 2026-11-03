import { UnifiedMessagesContent } from "@/components/messages/unified-messages-content";
import type { Metadata } from "next";
import { MessagePageShell } from "@/components/messages/message-page-shell";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = { title: "Messages", robots: { index: false, follow: false } };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize);
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : null;
  const selected = Boolean(value("shop") || value("conversation") || value("order"));
  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader compact />
      <MessagePageShell channel="shop" focusConversation={selected}>
        <UnifiedMessagesContent />
      </MessagePageShell>
    </HomeDataProvider>
  );
}
