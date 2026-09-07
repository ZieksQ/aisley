import type { Metadata } from "next";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { NotificationBackLink } from "@/components/notifications/notification-back-link";
import { NotificationsPageContent } from "@/components/notifications/notifications-page-content";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";
export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };
export default async function NotificationsPage() { const homepage = await getPublicHomepage(marketplaceConfig.discoveryPageSize); return <HomeDataProvider initialData={homepage} trackView={false}><UtilityBar /><MarketplaceHeader /><main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-7 sm:px-5 lg:px-8"><NotificationBackLink href="/" label="Back to store" /><h1 className="mb-5 mt-4 text-2xl font-semibold text-[#281E2C]">Notifications</h1><NotificationsPageContent /></main></HomeDataProvider>; }
