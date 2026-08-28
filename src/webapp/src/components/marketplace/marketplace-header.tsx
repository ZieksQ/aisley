import Image from "next/image";
import Link from "next/link";

import { MarketplaceSearch } from "./marketplace-search";
import {
  DeliveryLocation,
  HeaderAccountControls,
  UtilityAccountControls,
} from "./viewer-controls";

const marketplaceLinks = [
  { label: "Categories", href: "/#categories" },
  { label: "Flash Deals", href: "/#flash-deals" },
  { label: "Vouchers", href: "/vouchers" },
  { label: "Top Products", href: "/#top-products" },
  { label: "New Arrivals", href: "/products?sort=newest" },
  { label: "Shops", href: "/shops" },
];

export function UtilityBar() {
  return (
    <div className="hidden border-b border-[#E9E4EB] bg-white text-xs text-[#5E5262] md:block">
      <div className="mx-auto flex h-8 max-w-[1400px] items-center justify-between px-5 lg:px-8">
        <nav aria-label="Marketplace resources" className="flex items-center gap-5">
          <Link href="/app" className="hover:text-[#E6007A]">
            Download Aisley App
          </Link>
          <Link href="/seller" className="hover:text-[#E6007A]">
            Sell on Aisley
          </Link>
        </nav>
        <nav aria-label="Customer resources" className="flex items-center gap-5">
          <Link href="/help" className="hover:text-[#E6007A]">
            Help Center
          </Link>
          <UtilityAccountControls />
        </nav>
      </div>
    </div>
  );
}

export function MarketplaceHeader({ initialQuery = "" }: { initialQuery?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#DED7E1] bg-white shadow-[0_2px_8px_rgba(49,18,63,0.06)]">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-5 lg:px-8">
        <div className="flex h-16 items-center gap-2 sm:gap-4 lg:h-[72px]">
          <Link
            href="/"
            aria-label="Aisley homepage"
            className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E6007A]"
          >
            <Image
              src="/aisley-logo-with-title.svg"
              alt="Aisley"
              width={132}
              height={42}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>

          <DeliveryLocation />

          <div className="hidden min-w-0 flex-1 md:block">
            <MarketplaceSearch
              id="marketplace-search-desktop"
              initialQuery={initialQuery}
            />
          </div>

          <HeaderAccountControls />
        </div>

        <div className="pb-3 md:hidden">
          <MarketplaceSearch
            id="marketplace-search-mobile"
            initialQuery={initialQuery}
          />
        </div>
      </div>

      <nav
        aria-label="Marketplace"
        className="hidden border-t border-[#EEE9EF] md:block"
      >
        <div className="mx-auto flex h-9 max-w-[1400px] items-center gap-7 overflow-x-auto px-5 text-xs font-medium text-[#514656] lg:px-8">
          {marketplaceLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="whitespace-nowrap transition-colors hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
