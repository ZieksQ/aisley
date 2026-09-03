"use client";

import { useEffect, useRef } from "react";

import { useRecentlyViewed } from "./recently-viewed-provider";

export function ProductViewRecorder({ productId }: { productId: string }) {
  const { recordProduct } = useRecentlyViewed();
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    if (recorded.current === productId) return;
    recorded.current = productId;
    void recordProduct(productId);
  }, [productId, recordProduct]);

  return null;
}
