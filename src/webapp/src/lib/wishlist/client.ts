import { apiRequest, initializeCsrf } from "@/lib/api";

import type { WishlistPage } from "./types";

const wishlistPath = "/api/v1/customer/wishlist";

export function fetchWishlist(cursor?: string, signal?: AbortSignal) {
  const parameters = cursor
    ? `?${new URLSearchParams({ cursor }).toString()}`
    : "";
  return apiRequest<WishlistPage>(`${wishlistPath}${parameters}`, { signal });
}

export async function fetchWishlistStatus(productIds: string[], signal?: AbortSignal) {
  const parameters = new URLSearchParams();
  productIds.forEach((productId) => parameters.append("product_ids[]", productId));
  const response = await apiRequest<{ data: Record<string, boolean> }>(
    `${wishlistPath}/status?${parameters.toString()}`,
    { signal },
  );
  return response.data;
}

export async function saveWishlistProduct(productId: string) {
  await initializeCsrf();
  return apiRequest<{ data: { productId: string; saved: true; savedAt: string } }>(
    `${wishlistPath}/${encodeURIComponent(productId)}`,
    { method: "PUT" },
  );
}

export async function removeWishlistProduct(productId: string) {
  await initializeCsrf();
  return apiRequest<{ data: { productId: string; saved: false } }>(
    `${wishlistPath}/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
}
