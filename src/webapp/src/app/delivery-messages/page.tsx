import type { Metadata } from "next";
import { MessagePageShell } from "@/components/messages/message-page-shell";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { DeliveryMessagesContent } from "@/components/delivery-messages/delivery-messages-content";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = { title: "Delivery messages", robots: { index: false, follow: false } };

export default async function DeliveryMessagesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [homepage, params] = await Promise.all([getPublicHomepage(marketplaceConfig.discoveryPageSize), searchParams]);
  const value = (field: string) => typeof params[field] === "string" ? params[field] as string : null;

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader compact />
      <MessagePageShell channel="logistics" focusConversation={Boolean(value("conversation") || value("order"))}>
        <DeliveryMessagesContent conversationId={value("conversation")} orderId={value("order")} />
      </MessagePageShell>
    </HomeDataProvider>
  );
}
