import { apiRequest } from "@/lib/api";

import { marketplaceConfig } from "./config";
import type {
  HomepageData,
  HomepageRecommendations,
  ProductDetail,
} from "./types";

export function fetchHomepage(signal?: AbortSignal) {
  return apiRequest<HomepageData>(
    `/api/v1/customer/home?limit=${marketplaceConfig.discoveryPageSize}`,
    { signal },
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
