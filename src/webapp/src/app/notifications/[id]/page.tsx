import { redirect } from "next/navigation";
import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { NotificationDetail } from "@/components/notifications/notification-detail";
import { getServerAuthState } from "@/lib/auth/server";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";
export default async function NotificationPage({ params }: { params: Promise<{ id: string }> }) { const [{ id }, auth, homepage] = await Promise.all([params, getServerAuthState(), getPublicHomepage(marketplaceConfig.discoveryPageSize)]); if (auth.status === "guest") redirect(`/login?next=${encodeURIComponent(`/notifications/${id}`)}`); return <HomeDataProvider initialData={homepage} trackView={false}><UtilityBar /><MarketplaceHeader /><main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-7 sm:px-5 lg:px-8"><NotificationDetail id={id} /></main></HomeDataProvider>; }
