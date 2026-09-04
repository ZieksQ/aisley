import { apiRequest, initializeCsrf } from "@/lib/api";

import { marketplaceConfig } from "./config";
import type {
  GuestRecentlyViewedEntry,
  HomepageData,
  HomepageRecommendations,
  ProductDetail,
  ProductSummary,
  RecentlyViewedPage,
} from "./types";

export function fetchHomepage(signal?: AbortSignal) {
  return apiRequest<HomepageData>(
    `/api/v1/customer/home?limit=${marketplaceConfig.discoveryPageSize}`,
    { signal, cache: "no-store" },
  );
}

export function fetchRecommendations(cursor: string, signal?: AbortSignal) {
  const parameters = new URLSearchParams({
    cursor,
    limit: String(marketplaceConfig.discoveryPageSize),
  });

  return apiRequest<{ recommendations: HomepageRecommendations }>(
    `/api/v1/customer/home/recommendations?${parameters.toString()}`,
    { signal },
  );
}

export async function fetchProductDetail(id: string, signal?: AbortSignal) {
  const response = await apiRequest<{ data: ProductDetail }>(
    `/api/v1/products/${encodeURIComponent(id)}`,
    { signal },
  );

  return response.data;
}

const recentlyViewedPath = "/api/v1/customer/recently-viewed";

export function fetchRecentlyViewed(cursor?: string, signal?: AbortSignal) {
  const parameters = new URLSearchParams({ limit: "20" });
  if (cursor) parameters.set("cursor", cursor);

  return apiRequest<RecentlyViewedPage>(
    `${recentlyViewedPath}?${parameters.toString()}`,
    { signal, cache: "no-store" },
  );
}

export async function recordRecentlyViewedProduct(productId: string) {
  await initializeCsrf();

  return apiRequest<{ data: { productId: string; lastViewedAt: string } }>(
    `${recentlyViewedPath}/${encodeURIComponent(productId)}`,
    { method: "PUT", cache: "no-store" },
  );
}

export async function mergeRecentlyViewed(entries: GuestRecentlyViewedEntry[]) {
  await initializeCsrf();

  return apiRequest<{ data: { mergedProductIds: string[]; mergedCount: number } }>(
    `${recentlyViewedPath}/merge`,
    { method: "POST", body: JSON.stringify({ items: entries }), cache: "no-store" },
  );
}

export async function removeRecentlyViewedProduct(productId: string) {
  await initializeCsrf();

  return apiRequest<{ data: { productId: string; removed: boolean } }>(
    `${recentlyViewedPath}/${encodeURIComponent(productId)}`,
    { method: "DELETE", cache: "no-store" },
  );
}

export async function clearRecentlyViewed() {
  await initializeCsrf();

  return apiRequest<{ data: { cleared: true; removedCount: number } }>(
    recentlyViewedPath,
    { method: "DELETE", cache: "no-store" },
  );
}

export async function resolveRecentlyViewedProducts(
  productIds: string[],
  signal?: AbortSignal,
) {
  await initializeCsrf();

  return apiRequest<{ items: ProductSummary[] }>(
    "/api/v1/customer/products/resolve",
    {
      method: "POST",
      body: JSON.stringify({ productIds }),
      signal,
    },
  );
}
