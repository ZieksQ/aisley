import { apiRequest } from "@/lib/api";

import { marketplaceConfig } from "./config";
import type { HomepageData, HomepageRecommendations } from "./types";

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
