import Link from "next/link";
import { FiArrowRight, FiGrid } from "react-icons/fi";

import type { HomepageCategory } from "@/lib/marketplace/types";

import { ProductImage } from "./product-image";

export function CategorySection({ categories }: { categories: HomepageCategory[] }) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section id="categories" aria-labelledby="categories-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id="categories-heading"
          className="text-xl font-bold tracking-[-0.02em] text-[#2A1C2E]"
        >
          Categories
        </h2>
        <Link
          href="/categories"
          className="flex items-center gap-1 text-sm font-semibold text-[#4C1268] hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          See all
          <FiArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="marketplace-scroll grid snap-x snap-mandatory grid-flow-col auto-cols-[96px] gap-2 overflow-x-auto pb-2 sm:auto-cols-[112px] lg:grid-flow-row lg:grid-cols-10 lg:overflow-visible">
        {categories.slice(0, 20).map((category, index) => (
          <Link
            key={category.id}
            href={`/search?q=${encodeURIComponent(category.name)}&category=${encodeURIComponent(category.slug)}`}
            data-analytics-event="homepage_category_click"
            data-analytics-category-id={category.id}
            data-analytics-position={index + 1}
            className="group snap-start rounded-lg border border-[#E4DEE6] bg-white p-2 text-center transition-[border-color,box-shadow] hover:border-[#BDAFC2] hover:shadow-[0_2px_8px_rgba(49,18,63,0.06)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-md bg-[#F4EFF5]">
              {category.imageUrl ? (
                <ProductImage
                  src={category.imageUrl}
                  alt={category.name}
                  sizes="112px"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-[#73567D]">
                  <FiGrid aria-hidden="true" className="size-6" />
                </span>
              )}
            </div>
            <span className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-4 text-[#443849] group-hover:text-[#E6007A]">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
