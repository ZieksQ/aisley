export type DiscoveryParameters = Record<string, string | string[] | undefined>;
export type SearchMode = "products" | "shops";

function invalidScalars(parameters: DiscoveryParameters, allowed: string[]) {
  return Object.entries(parameters).some(([key, value]) => !allowed.includes(key) || (value !== undefined && typeof value !== "string"));
}

function pageValue(value: string | string[] | undefined) {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d{0,4}$/.test(value)) return null;
  const page = Number(value);
  return page <= 10000 ? page : null;
}

export function parseSearchParameters(parameters: DiscoveryParameters) {
  const query = typeof parameters.q === "string" ? parameters.q.trim() : "";
  const mode: SearchMode = parameters.type === "shops" ? "shops" : "products";
  const page = pageValue(parameters.page);
  const invalid = invalidScalars(parameters, ["q", "page", "type"])
    || (parameters.type !== undefined && !["products", "shops"].includes(String(parameters.type)))
    || Array.from(query).length > 100 || page === null;
  return { query, mode, page: page ?? 1, error: invalid ? "Use one query (up to 100 characters), Products or Shops, and a page from 1 to 10000." : null };
}

export function parseShopParameters(parameters: DiscoveryParameters) {
  const query = typeof parameters.q === "string" ? parameters.q.trim() : "";
  const category = typeof parameters.category === "string" ? parameters.category : null;
  const page = pageValue(parameters.page);
  const invalid = invalidScalars(parameters, ["q", "category", "page"])
    || Array.from(query).length > 100 || (category !== null && (!category || Array.from(category).length > 100)) || page === null;
  return { query, category, page: page ?? 1, error: invalid ? "Use one Shop keyword (up to 100 characters), a valid category, and a page from 1 to 10000." : null };
}

export function parseShopDirectoryParameters(parameters: DiscoveryParameters) {
  const category = typeof parameters.shop_category === "string" ? parameters.shop_category : null;
  const page = pageValue(parameters.page);
  const invalid = invalidScalars(parameters, ["shop_category", "page"])
    || (category !== null && (!category || Array.from(category).length > 100)) || page === null;
  return { category, page: page ?? 1, error: invalid ? "Use one Shop category and a page from 1 to 10000." : null };
}

export function searchHref(query: string, mode: SearchMode, page = 1) {
  const parameters = new URLSearchParams({ type: mode });
  if (query) parameters.set("q", query);
  if (page !== 1) parameters.set("page", String(page));
  return `/search?${parameters}`;
}

export function shopProductsHref(slug: string, query: string, category: string | null, page = 1) {
  const parameters = new URLSearchParams();
  if (query) parameters.set("q", query);
  if (category) parameters.set("category", category);
  if (page !== 1) parameters.set("page", String(page));
  return `/shops/${encodeURIComponent(slug)}${parameters.size ? `?${parameters}` : ""}`;
}
