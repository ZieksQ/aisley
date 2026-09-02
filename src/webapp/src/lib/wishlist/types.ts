import type { ProductSummary } from "@/lib/marketplace/types";

export type WishlistItem = {
  id: string;
  savedAt: string;
  product: ProductSummary & { requiresVariantSelection: boolean };
};

export type WishlistPage = {
  data: WishlistItem[];
  links: { next: string | null; prev: string | null };
  meta: {
    next_cursor: string | null;
    path: string;
    per_page: number;
    prev_cursor: string | null;
  };
};
