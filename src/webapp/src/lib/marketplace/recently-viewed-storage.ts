import type { GuestRecentlyViewedEntry } from "./types";

const storageKey = "aisley.recently-viewed.v1";
const storageVersion = 1;
export const guestRecentlyViewedLimit = 12;

type StorageResult = {
  available: boolean;
  entries: GuestRecentlyViewedEntry[];
};

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeEntries(value: unknown): GuestRecentlyViewedEntry[] {
  if (!value || typeof value !== "object") return [];
  const payload = value as { version?: unknown; items?: unknown };
  if (payload.version !== storageVersion || !Array.isArray(payload.items)) return [];

  const seen = new Set<string>();
  const entries: GuestRecentlyViewedEntry[] = [];
  for (const candidate of payload.items) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as { productId?: unknown; viewedAt?: unknown };
    if (!validUuid(item.productId) || typeof item.viewedAt !== "string") continue;
    const timestamp = Date.parse(item.viewedAt);
    if (!Number.isFinite(timestamp) || timestamp > Date.now() || seen.has(item.productId)) continue;
    seen.add(item.productId);
    entries.push({ productId: item.productId, viewedAt: new Date(timestamp).toISOString() });
    if (entries.length === guestRecentlyViewedLimit) break;
  }

  return entries;
}

function storageAvailable() {
  try {
    const probe = `${storageKey}.probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readGuestRecentlyViewed(): StorageResult {
  if (typeof window === "undefined" || !storageAvailable()) {
    return { available: false, entries: [] };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { available: true, entries: [] };
    const entries = normalizeEntries(JSON.parse(raw));
    if (entries.length === 0) window.localStorage.removeItem(storageKey);
    return { available: true, entries };
  } catch {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      return { available: false, entries: [] };
    }
    return { available: true, entries: [] };
  }
}

export function writeGuestRecentlyViewed(entries: GuestRecentlyViewedEntry[]) {
  if (typeof window === "undefined" || !storageAvailable()) return false;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify({
      version: storageVersion,
      items: entries.slice(0, guestRecentlyViewedLimit),
    }));
    return true;
  } catch {
    return false;
  }
}

export function recordGuestRecentlyViewed(productId: string): StorageResult {
  const current = readGuestRecentlyViewed();
  if (!current.available) return current;
  const entries = [
    { productId, viewedAt: new Date().toISOString() },
    ...current.entries.filter((item) => item.productId !== productId),
  ].slice(0, guestRecentlyViewedLimit);

  return { available: writeGuestRecentlyViewed(entries), entries };
}

export function removeGuestRecentlyViewed(productId: string): StorageResult {
  const current = readGuestRecentlyViewed();
  if (!current.available) return current;
  const entries = current.entries.filter((item) => item.productId !== productId);

  return { available: writeGuestRecentlyViewed(entries), entries };
}

export function replaceGuestRecentlyViewed(entries: GuestRecentlyViewedEntry[]): StorageResult {
  return { available: writeGuestRecentlyViewed(entries), entries };
}

export function clearGuestRecentlyViewed() {
  if (typeof window === "undefined" || !storageAvailable()) return false;
  try {
    window.localStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}
