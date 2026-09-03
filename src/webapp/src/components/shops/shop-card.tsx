import Image from "next/image";
import Link from "next/link";
import { FiShoppingBag } from "react-icons/fi";

import type { ShopSummary } from "@/lib/marketplace/types";

export function ShopCard({ shop }: { shop: ShopSummary }) {
  return (
    <article className="overflow-hidden rounded-lg border border-[#E2DCE4] bg-white transition-[border-color,box-shadow] duration-150 hover:border-[#BDAFC2] hover:shadow-[0_2px_8px_rgba(49,18,63,0.08)]">
      <Link
        href={`/shops/${encodeURIComponent(shop.slug)}`}
        className="block h-full focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-[#E6007A]"
      >
        <div className="relative aspect-[5/2] border-b border-[#E7E1E9] bg-[#F2EEF3]">
          {shop.bannerUrl ? (
            <Image
              src={shop.bannerUrl}
              alt={`${shop.name} shop banner`}
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[#9B8EA0]">
              <FiShoppingBag aria-hidden="true" className="size-8" />
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4">
          <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#DDD4E0] bg-[#F7F4F8] text-lg font-bold text-[#4C1268]">
            {shop.logoUrl ? (
              <Image
                src={shop.logoUrl}
                alt={`${shop.name} logo`}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <span aria-hidden="true">{shop.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-[#2A1C2E]">{shop.name}</h2>
            {shop.category ? (
              <p className="mt-0.5 text-xs font-medium text-[#785B7E]">
                {shop.category.name}
              </p>
            ) : null}
            {shop.description ? (
              <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#6D616F]">
                {shop.description}
              </p>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
