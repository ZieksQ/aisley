import "server-only";

import type {
  HomepageData,
  ProductSearchResponse,
} from "./types";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const emptyHomepage: HomepageData = {
  viewer: {
    isAuthenticated: false,
    displayName: null,
    deliveryLocation: null,
    cartItemCount: 0,
  },
  campaigns: { hero: [], side: [] },
  quickActions: [],
  categories: [],
  flashDeals: null,
  topProducts: [],
  recentlyViewed: [],
  recommendations: { items: [], nextCursor: null, pageSize: 20 },
};

async function publicApiRequest<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getPublicHomepage(pageSize: number) {
  const homepage = await publicApiRequest<HomepageData>(
    `/api/v1/customer/home?limit=${pageSize}`,
  );

  if (homepage) {
    return homepage;
  }

  return {
    ...emptyHomepage,
    recommendations: {
      ...emptyHomepage.recommendations,
      pageSize,
    },
  };
}

export async function searchPublicProducts(
  query: string,
  page: number,
  pageSize: number,
) {
  const parameters = new URLSearchParams({
    q: query,
    page: String(page),
    limit: String(pageSize),
  });

  return publicApiRequest<ProductSearchResponse>(
    `/api/v1/customer/products/search?${parameters.toString()}`,
  );
}
