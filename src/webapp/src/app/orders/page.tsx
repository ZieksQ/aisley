import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HiChevronRight } from "react-icons/hi2";

import { MarketplaceHeader, UtilityBar } from "@/components/marketplace/marketplace-header";
import { HomeDataProvider } from "@/components/marketplace/home-data-provider";
import { OrdersPageContent } from "@/components/orders/orders-page-content";
import { getServerAuthState } from "@/lib/auth/server";
import { marketplaceConfig } from "@/lib/marketplace/config";
import { getPublicHomepage } from "@/lib/marketplace/server";
import {
  isCustomerOrderGroup,
  type CustomerOrderGroup,
} from "@/lib/orders/types";

export const metadata: Metadata = {
  title: "My orders",
  description: "Review and track orders placed with your Aisley account.",
  robots: { index: false, follow: false },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string | string[]; page?: string | string[] }>;
}) {
  const [{ group, page }, auth, homepage] = await Promise.all([
    searchParams,
    getServerAuthState(),
    getPublicHomepage(marketplaceConfig.discoveryPageSize),
  ]);

  if (auth.status === "guest") {
    redirect(`/login?next=${encodeURIComponent("/orders")}`);
  }

  const groupValue = Array.isArray(group) ? group[0] : group;
  const selectedGroup: CustomerOrderGroup | null = isCustomerOrderGroup(groupValue)
    ? groupValue
    : null;
  const pageValue = Number(Array.isArray(page) ? page[0] : page);
  const selectedPage =
    Number.isInteger(pageValue) && pageValue > 0 && pageValue <= 10000
      ? pageValue
      : 1;

  return (
    <HomeDataProvider initialData={homepage} trackView={false}>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-12 pt-5 sm:px-5 lg:px-8 lg:pb-16 lg:pt-7">
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
          <span aria-current="page" className="text-[#4F4453]">
            Orders
          </span>
        </nav>
        <h1 className="mb-5 text-2xl font-semibold text-[#281E2C] sm:text-3xl">
          My orders
        </h1>
        <OrdersPageContent initialGroup={selectedGroup} initialPage={selectedPage} />
      </main>
    </HomeDataProvider>
  );
}
