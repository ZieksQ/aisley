"use client";

import Link from "next/link";
import { FiArrowRight, FiTrash2 } from "react-icons/fi";

import type { ProductSummary } from "@/lib/marketplace/types";

import { ProductCard } from "./product-card";

export function ProductRail({
  actionHref,
  actionLabel = "See all",
  id,
  products,
  title,
  onClear,
  onRemoveProduct,
}: {
  actionHref?: string;
  actionLabel?: string;
  id?: string;
  products: ProductSummary[];
  title: string;
  onClear?: () => void;
  onRemoveProduct?: (productId: string) => void;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section id={id} aria-labelledby={`${id ?? title}-heading`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id={`${id ?? title}-heading`}
          className="text-xl font-bold tracking-[-0.02em] text-[#2A1C2E]"
        >
          {title}
        </h2>
        <div className="flex items-center gap-4">
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-semibold text-[#675B6B] hover:text-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              Clear
            </button>
          ) : null}
          {actionHref ? (
            <Link
              href={actionHref}
              className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-[#4C1268] hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              {actionLabel}
              <FiArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="marketplace-scroll grid snap-x snap-mandatory grid-flow-col auto-cols-[44%] gap-3 overflow-x-auto pb-2 sm:auto-cols-[30%] lg:auto-cols-[19%] xl:auto-cols-[16%]">
        {products.map((product, index) => (
          <div key={product.id} className="snap-start">
            <ProductCard
              product={product}
              position={index + 1}
              section={id ?? title}
            />
            {onRemoveProduct ? (
              <button
                type="button"
                onClick={() => onRemoveProduct(product.id)}
                className="mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[#D8CFDA] bg-white px-3 text-xs font-semibold text-[#5E5262] hover:border-[#BDAFC2] hover:text-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
                aria-label={`Remove ${product.title} from recently viewed`}
              >
                <FiTrash2 aria-hidden="true" />
                Remove
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
