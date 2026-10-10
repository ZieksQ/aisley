import "server-only";

import type {
  HomepageData,
  ProductDetail,
  ProductSearchResponse,
  ShopBrowseResponse,
  ShopDetail,
  ShopDirectoryResponse,
  ShopSearchResponse,
} from "./types";

export type PublicApiResult<T> =
  | { status: "success"; data: T }
  | { status: "not_found" }
  | { status: "invalid"; message: string }
  | { status: "throttled"; retryAfter: number; retryAt: number }
  | { status: "timeout" }
  | { status: "error" };

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const emptyHomepage: HomepageData = {
  viewer: {
    isAuthenticated: false,
    displayName: null,
    email: null,
    deliveryLocation: null,
    cartItemCount: 0,
  },
  campaigns: { hero: [], side: [] },
  advertisementLayer: null,
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
      signal: AbortSignal.timeout(15000),
      credentials: "omit",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function publicApiResult<T>(
  path: string,
  revalidate = 60,
): Promise<PublicApiResult<T>> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      next: { revalidate },
      signal: AbortSignal.timeout(15000),
      credentials: "omit",
    });

    if (response.status === 404) {
      return { status: "not_found" };
    }

    if (response.status === 422) {
      const payload = (await response.json().catch(() => null)) as {
        errors?: Record<string, string[]>;
        message?: string;
      } | null;
      const fieldMessage = payload?.errors
        ? Object.values(payload.errors).flat()[0]
        : undefined;

      return {
        status: "invalid",
        message: fieldMessage ?? payload?.message ?? "The selected filter is not available.",
      };
    }

    if (response.status === 429) {
      const header = response.headers.get("Retry-After");
      const seconds = header && /^\d+$/.test(header) ? Number(header)
        : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : 60;
      const retryAfter = Number.isFinite(seconds) ? Math.min(3600, Math.max(1, seconds)) : 60;
      return { status: "throttled", retryAfter, retryAt: Date.now() + retryAfter * 1000 };
    }

    if (!response.ok) {
      return { status: "error" };
    }

    return { status: "success", data: (await response.json()) as T };
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) return { status: "timeout" };
    return { status: "error" };
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

  return publicApiResult<ProductSearchResponse>(
    `/api/v1/customer/products/search?${parameters.toString()}`,
  );
}

export function searchPublicShops(query: string, page: number, pageSize: number) {
  const parameters = new URLSearchParams({ q: query, page: String(page), limit: String(pageSize) });
  return publicApiResult<ShopSearchResponse>(`/api/v1/customer/search/shops?${parameters}`);
}

export async function getPublicProduct(id: string): Promise<ProductDetail | null> {
  const response = await fetch(
    `${apiBaseUrl}/api/v1/products/${encodeURIComponent(id)}`,
    {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      next: { revalidate: 30 },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Product detail request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { data: ProductDetail };
  return payload.data;
}

export function getPublicShopDirectory(
  category: string | null,
  page: number,
  pageSize: number,
) {
  const parameters = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });
  if (category) parameters.set("shop_category", category);

  return publicApiResult<ShopDirectoryResponse>(
    `/api/v1/customer/shops?${parameters.toString()}`,
  );
}

export async function getPublicShop(slug: string): Promise<PublicApiResult<ShopDetail>> {
  const result = await publicApiResult<{ data: ShopDetail }>(
    `/api/v1/customer/shops/${encodeURIComponent(slug)}`,
  );

  return result.status === "success"
    ? { status: "success", data: result.data.data }
    : result;
}

export function getPublicShopProducts(
  slug: string,
  category: string | null,
  page: number,
  pageSize: number,
  query = "",
) {
  const parameters = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });
  if (category) parameters.set("category", category);
  if (query) parameters.set("q", query);

  return publicApiResult<ShopBrowseResponse>(
    `/api/v1/customer/shops/${encodeURIComponent(slug)}/products?${parameters.toString()}`,
  );
}
