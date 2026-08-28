import Link from "next/link";
import { HiStar } from "react-icons/hi2";

import type { ProductSummary } from "@/lib/marketplace/types";

import { ProductImage } from "./product-image";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const countFormatter = new Intl.NumberFormat("en-PH", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const badgeLabels: Record<string, string> = {
  best_seller: "Best seller",
  free_shipping: "Free shipping",
  new_arrival: "New arrival",
  top_product: "Top product",
  top_rated: "Top rated",
};

export function ProductCard({
  position,
  priority = false,
  product,
  section,
}: {
  position: number;
  priority?: boolean;
  product: ProductSummary;
  section: string;
}) {
  const badge = product.badges
    .map((value) => badgeLabels[value])
    .find(Boolean);
  const unavailable = product.stockStatus === "out_of_stock";

  return (
    <Link
      href={`/products/${product.slug}`}
      aria-label={`${product.title}, ${moneyFormatter.format(product.price)}`}
      data-analytics-event="homepage_product_click"
      data-analytics-product-id={product.id}
      data-analytics-shop-id={product.shop.id}
      data-analytics-section={section}
      data-analytics-position={position}
      className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#E4DEE6] bg-white transition-[border-color,box-shadow] duration-150 hover:border-[#BDAFC2] hover:shadow-[0_2px_8px_rgba(49,18,63,0.08)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
    >
      <div className="relative aspect-square overflow-hidden bg-[#F4F1F5]">
        <ProductImage
          src={product.thumbnailUrl}
          alt={product.title}
          sizes="(max-width: 639px) 46vw, (max-width: 1023px) 30vw, (max-width: 1279px) 20vw, 210px"
          priority={priority}
        />

        {product.discountPercent ? (
          <span className="absolute left-2 top-2 rounded-md bg-[#E6007A] px-1.5 py-1 text-[11px] font-bold text-white">
            {product.discountPercent}% off
          </span>
        ) : badge ? (
          <span className="absolute left-2 top-2 rounded-md bg-[#4C1268] px-1.5 py-1 text-[11px] font-semibold text-white">
            {badge}
          </span>
        ) : null}

        {unavailable ? (
          <span className="absolute inset-x-0 bottom-0 bg-[#231429]/85 px-2 py-1.5 text-center text-xs font-semibold text-white">
            Out of stock
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-[#2B202E]">
          {product.title}
        </h3>

        <div className="mt-2 flex min-h-10 flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold text-[#E6007A]">
            {moneyFormatter.format(product.price)}
          </span>
          {product.originalPrice ? (
            <span className="text-xs text-[#8B808F] line-through">
              {moneyFormatter.format(product.originalPrice)}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-center gap-1.5 text-[11px] text-[#675B6B]">
          {product.averageRating !== null ? (
            <span className="flex items-center gap-0.5 text-[#4A3E4E]">
              <HiStar aria-hidden="true" className="size-3.5 text-[#FF8800]" />
              {product.averageRating.toFixed(1)}
            </span>
          ) : (
            <span>New</span>
          )}
          {product.soldCount > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{countFormatter.format(product.soldCount)} sold</span>
            </>
          ) : null}
        </div>

        {product.deal ? (
          <div className="mt-2" aria-label={`${product.deal.progressPercent}% sold`}>
            <div className="h-1.5 overflow-hidden rounded-sm bg-[#F0E5EB]">
              <div
                className="h-full bg-[#E6007A]"
                style={{ width: `${product.deal.progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-[#6D616F]">
              {product.deal.remainingStock <= 5
                ? `Only ${product.deal.remainingStock} left`
                : `${product.deal.soldCount} sold`}
            </p>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
