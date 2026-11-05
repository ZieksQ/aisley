import Link from "next/link";

import { searchHref } from "@/lib/marketplace/discovery-url";
import type { HomepageCategory } from "@/lib/marketplace/types";

import { categoryIcon } from "./category-icons";

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
      </div>

      <div className="marketplace-scroll grid snap-x snap-mandatory grid-flow-col auto-cols-[96px] gap-2 overflow-x-auto pb-2 sm:auto-cols-[112px] lg:grid-flow-row lg:grid-cols-10 lg:overflow-visible">
        {categories.slice(0, 20).map((category, index) => {
          const Icon = categoryIcon(category.slug);
          return (
            <Link
              key={category.id}
              href={searchHref(category.name, "products")}
              data-analytics-event="homepage_category_click"
              data-analytics-category-id={category.id}
              data-analytics-position={index + 1}
              className="group snap-start rounded-lg border border-[#E4DEE6] bg-white p-2 text-center transition-colors hover:border-[#BDAFC2] hover:bg-[#F1EAF4] motion-reduce:transition-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]"
            >
              <div className="mx-auto flex h-16 items-center justify-center text-[#4C1268] sm:h-20">
                <Icon aria-hidden="true" className="size-9 sm:size-10" />
              </div>
              <span className="mt-2 block min-h-12 text-xs font-medium leading-4 text-[#443849] group-hover:text-[#4C1268]">
                {category.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
