import type { DiscoveryOwner } from "./homepage-session";
import type { HomepageRecommendations, ProductSummary } from "./types";

const prefix = "aisley:homepage-discovery:v3:";
const legacyKey = "aisley:homepage-discovery:v2";

export type SavedDiscovery = {
  owner: DiscoveryOwner;
  cursor: string | null;
  feedSignature: string;
  items: ProductSummary[];
  maxItems: number;
  pageSize: number;
  scrollY: number;
};

export function discoveryStorageKey(owner: DiscoveryOwner) {
  return `${prefix}${encodeURIComponent(owner)}`;
}

export function discoverySignature(feed: HomepageRecommendations) {
  return `${feed.items.map((product) => product.id).join(",")}|${feed.nextCursor ?? ""}`;
}

function isProductCard(value: unknown): value is ProductSummary {
  if (!value || typeof value !== "object") return false;
  const product = value as ProductSummary;
  return typeof product.id === "string" && typeof product.title === "string"
    && typeof product.price === "number" && Number.isFinite(product.price)
    && (product.thumbnailUrl === null || typeof product.thumbnailUrl === "string")
    && (product.averageRating === null || typeof product.averageRating === "number")
    && typeof product.reviewCount === "number" && typeof product.soldCount === "number"
    && product.shop !== null && typeof product.shop === "object"
    && typeof product.shop.id === "string" && typeof product.shop.name === "string"
    && Array.isArray(product.badges) && product.badges.every((badge) => typeof badge === "string");
}

export function readDiscovery(
  owner: DiscoveryOwner,
  signature: string,
  pageSize: number,
  maxItems: number,
): SavedDiscovery | null {
  try {
    const key = discoveryStorageKey(owner);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedDiscovery> | null;
    if (saved && saved.owner === owner && saved.feedSignature === signature
      && saved.pageSize === pageSize && saved.maxItems === maxItems
      && Array.isArray(saved.items) && saved.items.length > 0 && saved.items.length <= maxItems
      && saved.items.every(isProductCard)
      && (saved.cursor === null || (typeof saved.cursor === "string" && saved.cursor.length <= 2048))
      && typeof saved.scrollY === "number" && Number.isFinite(saved.scrollY) && saved.scrollY >= 0) {
      return saved as SavedDiscovery;
    }
    window.sessionStorage.removeItem(key);
  } catch {
    // Corrupt/blocked storage must not prevent fresh discovery.
  }
  return null;
}

export function saveDiscovery(saved: SavedDiscovery) {
  try {
    window.sessionStorage.setItem(discoveryStorageKey(saved.owner), JSON.stringify(saved));
  } catch {
    // Restoration is optional, never an authentication or shopping dependency.
  }
}

export function pruneDiscoveryStorage(owner: DiscoveryOwner | null) {
  try {
    const storage = window.sessionStorage;
    const keep = owner === null ? null : discoveryStorageKey(owner);
    const obsolete: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && (key === legacyKey || (key.startsWith(prefix) && key !== keep))) {
        obsolete.push(key);
      }
    }
    obsolete.forEach((key) => storage.removeItem(key));
  } catch {
    // The rendered session boundary remains effective without browser storage.
  }
}
