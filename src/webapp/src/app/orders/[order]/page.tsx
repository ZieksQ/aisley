import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HiChevronRight } from "react-icons/hi2";

import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { OrderDetailContent } from "@/components/orders/order-detail-content";
import { getServerAuthState } from "@/lib/auth/server";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";

export const metadata: Metadata = {
  title: "Order details",
  description: "View your Aisley order summary and tracking history.",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ order: string }>;
}) {
  const [{ order }, auth, homepage] = await Promise.all([
    params,
    getServerAuthState(),
    getPublicHomepage(marketplaceConfig.discoveryPageSize),
  ]);
  const path = `/orders/${order}`;

  if (auth.status === "guest") {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pb-12 pt-5 sm:px-5 lg:px-8 lg:pb-16 lg:pt-7">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-1.5 text-xs text-[#746978]"
        >
          <Link
            href="/"
            className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            Home
          </Link>
          <HiChevronRight aria-hidden="true" className="size-3.5" />
          <Link
            href="/orders"
            className="hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            Orders
          </Link>
          <HiChevronRight aria-hidden="true" className="size-3.5" />
          <span aria-current="page" className="max-w-48 truncate text-[#4F4453]">
            Order details
          </span>
        </nav>
        <OrderDetailContent orderId={order} />
      </main>
    </HomeDataProvider>
  );
}
