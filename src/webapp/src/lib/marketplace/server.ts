import "server-only";

import type {
  HomepageData,
  ProductDetail,
  ProductSearchResponse,
  ShopBrowseResponse,
  ShopDetail,
  ShopDirectoryResponse,
} from "./types";

export type PublicApiResult<T> =
  | { status: "success"; data: T }
  | { status: "not_found" }
  | { status: "invalid"; message: string }
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

async function publicApiRequest<T>(path: string, noStore = false): Promise<T | null> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      ...(noStore ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function publicApiResult<T>(
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

    if (!response.ok) {
      return { status: "error" };
    }

    return { status: "success", data: (await response.json()) as T };
  } catch {
    return { status: "error" };
  }
}

export async function getPublicHomepage(pageSize: number) {
  const homepage = await publicApiRequest<HomepageData>(
    `/api/v1/customer/home?limit=${pageSize}`,
    true,
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
) {
  const parameters = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });
  if (category) parameters.set("category", category);

  return publicApiResult<ShopBrowseResponse>(
    `/api/v1/customer/shops/${encodeURIComponent(slug)}/products?${parameters.toString()}`,
  );
}
