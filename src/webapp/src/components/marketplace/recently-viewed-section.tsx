"use client";

import { useHomeData } from "./home-data-provider";
import { ProductRail } from "./product-rail";

export function RecentlyViewedSection() {
  const { data } = useHomeData();

  return (
    <ProductRail
      id="recently-viewed"
      title="Recently viewed"
      actionHref="/account/recently-viewed"
      products={data.recentlyViewed}
    />
  );
}
