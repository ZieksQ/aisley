import Link from "next/link";
import type { IconType } from "react-icons";
import {
  FiGift,
  FiGrid,
  FiPackage,
  FiPercent,
  FiShoppingBag,
  FiTag,
  FiTruck,
} from "react-icons/fi";

import type { HomepageQuickAction } from "@/lib/marketplace/types";

const actionIcons: Record<string, IconType> = {
  vouchers: FiTag,
  flash_deals: FiPercent,
  free_shipping: FiTruck,
  top_products: FiGift,
  new_arrivals: FiPackage,
  shops: FiShoppingBag,
  categories: FiGrid,
};

export function QuickActions({ actions }: { actions: HomepageQuickAction[] }) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Marketplace shortcuts" className="border-b border-[#E7E1E8] bg-white">
      <div className="marketplace-scroll mx-auto grid max-w-[1400px] snap-x snap-mandatory grid-flow-col auto-cols-[88px] justify-start gap-2 overflow-x-auto px-4 py-4 sm:auto-cols-[104px] sm:gap-4 sm:px-5 lg:auto-cols-fr lg:grid-cols-7 lg:justify-stretch lg:px-8">
        {actions.slice(0, 8).map((action, index) => {
          const Icon = actionIcons[action.key] ?? FiGift;

          return (
            <Link
              key={action.key}
              href={action.destinationUrl}
              data-analytics-event="homepage_quick_action_click"
              data-analytics-section={action.key}
              data-analytics-position={index + 1}
              className="flex snap-start flex-col items-center gap-2 rounded-md px-2 py-1.5 text-center text-xs font-medium leading-4 text-[#493E4D] transition-colors hover:bg-[#F7F3F8] hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              <span className="flex size-11 items-center justify-center rounded-lg border border-[#E1D7E4] bg-[#F7F1F8] text-[#4C1268]">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span>{action.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
