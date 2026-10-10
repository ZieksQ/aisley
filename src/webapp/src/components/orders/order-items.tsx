"use client";

import { useState } from "react";

import { ProductImage } from "@/components/marketplace/product-image";
import { OrderItemReviewForm } from "@/components/reviews/order-item-review-form";
import { formatOrderMoney } from "@/lib/orders/format";
import type { OrderDetail } from "@/lib/orders/types";

export function OrderItems({ order }: { order: OrderDetail }) {
  const [reviewIds, setReviewIds] = useState<Record<string, string>>({});

  return (
    <section aria-labelledby="items-heading" className="border border-[#DED7E1] bg-white">
      <div className="border-b border-[#E9E3EB] px-4 py-4 sm:px-5">
        <h2 id="items-heading" className="text-base font-semibold text-[#2D2231]">
          Items from {order.shop.name}
        </h2>
      </div>
      <div className="divide-y divide-[#EEE9EF]">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
            <div className="relative size-14 shrink-0 overflow-hidden border border-[#E3DDE5] bg-[#F7F4F7] sm:size-16">
              <ProductImage
                src={item.imageUrl}
                alt={item.productName}
                sizes="64px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#302534]">{item.productName}</p>
              {item.selectedOptions.length > 0 ? (
                <p className="mt-1 text-xs text-[#746978]">
                  {item.selectedOptions
                    .map((option) => `${option.group}: ${option.value}`)
                    .join(" · ")}
                </p>
              ) : item.variantName ? (
                <p className="mt-1 text-xs text-[#746978]">{item.variantName}</p>
              ) : null}
              <p className="mt-1 text-xs text-[#817584]">
                Qty {item.quantity}{item.sku ? ` · SKU ${item.sku}` : ""}
              </p>
              <OrderItemReviewForm
                orderItemId={item.id}
                productName={item.productName}
                canReview={item.canReview}
                reviewId={reviewIds[item.id] ?? item.reviewId}
                onSubmitted={(reviewId) =>
                  setReviewIds((current) => ({ ...current, [item.id]: reviewId }))
                }
              />
            </div>
            <p className="shrink-0 text-sm font-semibold text-[#342838]">
              {formatOrderMoney(item.lineSubtotal, item.currency)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
