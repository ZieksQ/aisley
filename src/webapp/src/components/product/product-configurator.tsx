"use client";

import { useState } from "react";

import type { ProductDetail } from "@/lib/marketplace/types";

import { ProductGallery } from "./product-gallery";
import { ProductPurchasePanel } from "./product-purchase-panel";

export function ProductConfigurator({ product }: { product: ProductDetail }) {
  const [preferredMediaId, setPreferredMediaId] = useState<string | null>(null);

  return (
    <div className="grid gap-7 md:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:gap-10">
      <ProductGallery
        key={preferredMediaId ?? "product-default-media"}
        media={product.media}
        preferredMediaId={preferredMediaId}
        productTitle={product.title}
      />
      <ProductPurchasePanel
        product={product}
        onSelectedVariantChange={(variant) => setPreferredMediaId(variant?.primaryMediaId ?? null)}
      />
    </div>
  );
}
