"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import {
  mergeRecentlyViewed,
  recordRecentlyViewedProduct,
  resolveRecentlyViewedProducts,
} from "@/lib/marketplace/client";
import {
  clearGuestRecentlyViewed,
  readGuestRecentlyViewed,
  recordGuestRecentlyViewed,
  removeGuestRecentlyViewed,
  replaceGuestRecentlyViewed,
} from "@/lib/marketplace/recently-viewed-storage";
import type { GuestRecentlyViewedEntry, ProductSummary } from "@/lib/marketplace/types";

type GuestStatus = "loading" | "ready" | "unavailable" | "error";
type MergeStatus = "idle" | "pending" | "failed";

type RecentlyViewedContextValue = {
  clearGuest: () => void;
  guestProducts: ProductSummary[];
  guestStatus: GuestStatus;
  mergeStatus: MergeStatus;
  notice: string;
  recordProduct: (productId: string) => Promise<void>;
  removeGuest: (productId: string) => void;
  retryGuestResolution: () => void;
  retryMerge: () => void;
};

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(null);

function signature(entries: GuestRecentlyViewedEntry[]) {
  return entries.map((item) => `${item.productId}:${item.viewedAt}`).join("|");
}

export function RecentlyViewedProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const [entries, setEntries] = useState<GuestRecentlyViewedEntry[]>([]);
  const [guestProducts, setGuestProducts] = useState<ProductSummary[]>([]);
  const [guestStatus, setGuestStatus] = useState<GuestStatus>("loading");
  const [mergeStatus, setMergeStatus] = useState<MergeStatus>("idle");
  const [notice, setNotice] = useState("");
  const [initialized, setInitialized] = useState(false);
  const lastResolved = useRef("");
  const mergeAttempt = useRef("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const stored = readGuestRecentlyViewed();
      setEntries(stored.entries);
      setGuestStatus(stored.available ? "ready" : "unavailable");
      setInitialized(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const resolveGuest = useCallback(async (force = false) => {
    if (!initialized || entries.length === 0) {
      setGuestProducts([]);
      if (guestStatus !== "unavailable") setGuestStatus("ready");
      return;
    }

    const currentSignature = signature(entries);
    if (!force && lastResolved.current === currentSignature) return;
    lastResolved.current = currentSignature;
    setGuestStatus("loading");

    try {
      const response = await resolveRecentlyViewedProducts(entries.map((item) => item.productId));
      const visibleIds = new Set(response.items.map((product) => product.id));
      const visibleEntries = entries.filter((item) => visibleIds.has(item.productId));
      setGuestProducts(response.items);
      setGuestStatus("ready");

      if (visibleEntries.length !== entries.length) {
        const result = replaceGuestRecentlyViewed(visibleEntries);
        setEntries(visibleEntries);
        lastResolved.current = signature(visibleEntries);
        setNotice("Some unavailable products were removed from your recent history.");
        if (!result.available) setGuestStatus("unavailable");
      }
    } catch {
      setGuestStatus("error");
    }
  }, [entries, guestStatus, initialized]);

  useEffect(() => {
    if (auth.status !== "guest") return;
    const timeout = window.setTimeout(() => void resolveGuest(), 0);
    return () => window.clearTimeout(timeout);
  }, [auth.status, resolveGuest]);

  const mergeGuest = useCallback(async (force = false) => {
    if (!initialized || auth.status !== "authenticated" || entries.length === 0) {
      setMergeStatus("idle");
      return;
    }

    const currentAttempt = `${auth.customer.id}:${signature(entries)}`;
    if (!force && mergeAttempt.current === currentAttempt) return;
    mergeAttempt.current = currentAttempt;
    setMergeStatus("pending");

    try {
      await mergeRecentlyViewed(entries);
      clearGuestRecentlyViewed();
      setEntries([]);
      setGuestProducts([]);
      setMergeStatus("idle");
      setNotice("Your guest history was added to this account.");
    } catch {
      setMergeStatus("failed");
    }
  }, [auth, entries, initialized]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const timeout = window.setTimeout(() => void mergeGuest(), 0);
    return () => window.clearTimeout(timeout);
  }, [auth.status, mergeGuest]);

  useEffect(() => {
    const retry = () => {
      if (auth.status === "authenticated" && mergeStatus === "failed") void mergeGuest(true);
      if (auth.status === "guest" && guestStatus === "error") void resolveGuest(true);
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
    };
  }, [auth.status, guestStatus, mergeGuest, mergeStatus, resolveGuest]);

  const recordProduct = useCallback(async (productId: string) => {
    if (auth.status === "authenticated") {
      try {
        await recordRecentlyViewedProduct(productId);
      } catch {
        setNotice("This view could not be added to your account history.");
      }
      return;
    }

    const result = recordGuestRecentlyViewed(productId);
    setEntries(result.entries);
    setGuestStatus(result.available ? "ready" : "unavailable");
    if (!result.available) setNotice("Recent history is unavailable in this browser.");
  }, [auth.status]);

  const removeGuest = useCallback((productId: string) => {
    const result = removeGuestRecentlyViewed(productId);
    setEntries(result.entries);
    setGuestProducts((current) => current.filter((product) => product.id !== productId));
    setGuestStatus(result.available ? "ready" : "unavailable");
    setNotice(result.available ? "Product removed from recent history." : "Recent history is unavailable in this browser.");
  }, []);

  const clearGuest = useCallback(() => {
    const available = clearGuestRecentlyViewed();
    setEntries([]);
    setGuestProducts([]);
    setGuestStatus(available ? "ready" : "unavailable");
    setNotice(available ? "Recent history cleared." : "Recent history is unavailable in this browser.");
  }, []);

  const value = useMemo<RecentlyViewedContextValue>(() => ({
    clearGuest,
    guestProducts,
    guestStatus,
    mergeStatus,
    notice,
    recordProduct,
    removeGuest,
    retryGuestResolution: () => void resolveGuest(true),
    retryMerge: () => void mergeGuest(true),
  }), [clearGuest, guestProducts, guestStatus, mergeGuest, mergeStatus, notice, recordProduct, removeGuest, resolveGuest]);

  return <RecentlyViewedContext.Provider value={value}>{children}</RecentlyViewedContext.Provider>;
}

export function useRecentlyViewed() {
  const context = useContext(RecentlyViewedContext);
  if (!context) throw new Error("useRecentlyViewed must be used within RecentlyViewedProvider.");
  return context;
}
