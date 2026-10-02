import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { CourierMessagesContent } from "@/components/courier-messages/courier-messages-content";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = {
  title: "Courier messages",
  description: "Coordinate your accepted final-mile delivery with its Courier.",
  robots: { index: false, follow: false },
};

export default async function CourierMessagesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [homepage, params] = await Promise.all([
    getPublicHomepage(marketplaceConfig.discoveryPageSize), searchParams,
  ]);
  const value = (field: string) => typeof params[field] === "string" ? params[field] as string : null;

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-7 sm:px-5 lg:px-8">
        <nav aria-label="Message channels" className="mb-5 flex flex-wrap gap-x-5 text-sm text-[#4C1268]">
          <Link className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2" href="/orders">Orders</Link>
          <Link className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2" href="/messages">Shop messages</Link>
          <Link className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2" href="/delivery-messages">Logistics messages</Link>
        </nav>
        <CourierMessagesContent conversationId={value("conversation")} orderId={value("order")} />
      </main>
    </HomeDataProvider>
  );
}
