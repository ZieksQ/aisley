import Image from "next/image";
import { FiShoppingBag } from "react-icons/fi";

import type { ShopDetail } from "@/lib/marketplace/types";

export function ShopHeader({ shop }: { shop: ShopDetail }) {
  return (
    <header className="overflow-hidden rounded-lg border border-[#DED7E1] bg-white">
      <div className="relative aspect-[4/1] min-h-28 max-h-56 border-b border-[#E7E1E9] bg-[#F2EEF3]">
        {shop.bannerUrl ? (
          <Image
            src={shop.bannerUrl}
            alt={`${shop.name} shop banner`}
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#A092A5]">
            <FiShoppingBag aria-hidden="true" className="size-10" />
          </div>
        )}
      </div>
      <div className="flex items-start gap-4 px-4 py-5 sm:px-6">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#D9CFDC] bg-[#F7F4F8] text-2xl font-bold text-[#4C1268] sm:size-20">
          {shop.logoUrl ? (
            <Image
              src={shop.logoUrl}
              alt={`${shop.name} logo`}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span aria-hidden="true">{shop.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 pt-1">
          <h1
            id="shop-page-heading"
            tabIndex={-1}
            className="text-2xl font-bold tracking-[-0.025em] text-[#2A1C2E] outline-none sm:text-3xl"
          >
            {shop.name}
          </h1>
          {shop.category ? (
            <p className="mt-1 text-sm font-medium text-[#785B7E]">{shop.category.name}</p>
          ) : null}
          {shop.description ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#655969] sm:text-base">
              {shop.description}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
