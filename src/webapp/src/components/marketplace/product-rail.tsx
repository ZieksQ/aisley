import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

import type { ProductSummary } from "@/lib/marketplace/types";

import { ProductCard } from "./product-card";

export function ProductRail({
  actionHref,
  actionLabel = "See all",
  id,
  products,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  id?: string;
  products: ProductSummary[];
  title: string;
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

      <div className="marketplace-scroll grid snap-x snap-mandatory grid-flow-col auto-cols-[44%] gap-3 overflow-x-auto pb-2 sm:auto-cols-[30%] lg:auto-cols-[19%] xl:auto-cols-[16%]">
        {products.map((product, index) => (
          <div key={product.id} className="snap-start">
            <ProductCard
              product={product}
              position={index + 1}
              section={id ?? title}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
