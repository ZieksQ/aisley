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
  fetchWishlistStatus,
  removeWishlistProduct,
  saveWishlistProduct,
} from "@/lib/wishlist/client";

type WishlistContextValue = {
  ensureStatus: (productId: string) => void;
  isPending: (productId: string) => boolean;
  isSaved: (productId: string) => boolean | undefined;
  reconcile: (statuses: Record<string, boolean>) => void;
  toggle: (productId: string) => Promise<boolean>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const customerId = auth.status === "authenticated" ? auth.customer.id : null;
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const requestedIds = useRef(new Set<string>());
  const registeredIds = useRef(new Set<string>());
  const queuedIds = useRef(new Set<string>());
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCustomerId = useRef(customerId);

  const reconcile = useCallback((next: Record<string, boolean>) => {
    Object.keys(next).forEach((productId) => requestedIds.current.add(productId));
    setStatuses((current) => ({ ...current, ...next }));
  }, []);

  const flushStatusQueue = useCallback(async () => {
    batchTimer.current = null;
    const ids = [...queuedIds.current];
    queuedIds.current.clear();
    if (!customerId || ids.length === 0) return;

    try {
      const batches = Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) =>
        ids.slice(index * 50, (index + 1) * 50),
      );
      const results = await Promise.all(batches.map((batch) => fetchWishlistStatus(batch)));
      results.forEach(reconcile);
    } catch {
      ids.forEach((id) => requestedIds.current.delete(id));
    }
  }, [customerId, reconcile]);

  const queueStatus = useCallback((productId: string, force = false) => {
    registeredIds.current.add(productId);
    if (!customerId || (!force && requestedIds.current.has(productId))) return;
    requestedIds.current.add(productId);
    queuedIds.current.add(productId);
    if (!batchTimer.current) {
      batchTimer.current = setTimeout(() => void flushStatusQueue(), 0);
    }
  }, [customerId, flushStatusQueue]);

  useEffect(() => {
    if (activeCustomerId.current === customerId) return;
    activeCustomerId.current = customerId;
    setStatuses({});
    setPendingIds(new Set());
    requestedIds.current.clear();
    queuedIds.current.clear();
    registeredIds.current.forEach((productId) => queueStatus(productId, true));
  }, [customerId, queueStatus]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (!customerId) return;
      registeredIds.current.forEach((productId) => queueStatus(productId, true));
    };
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [customerId, queueStatus]);

  useEffect(() => () => {
    if (batchTimer.current) clearTimeout(batchTimer.current);
  }, []);

  const toggle = useCallback(async (productId: string) => {
    const previous = statuses[productId] ?? false;
    const next = !previous;
    setPendingIds((current) => new Set(current).add(productId));
    setStatuses((current) => ({ ...current, [productId]: next }));

    try {
      if (next) await saveWishlistProduct(productId);
      else await removeWishlistProduct(productId);
      return next;
    } catch (error) {
      setStatuses((current) => ({ ...current, [productId]: previous }));
      throw error;
    } finally {
      setPendingIds((current) => {
        const updated = new Set(current);
        updated.delete(productId);
        return updated;
      });
    }
  }, [statuses]);

  const value = useMemo<WishlistContextValue>(() => ({
    ensureStatus: queueStatus,
    isPending: (productId) => pendingIds.has(productId),
    isSaved: (productId) => statuses[productId],
    reconcile,
    toggle,
  }), [pendingIds, queueStatus, reconcile, statuses, toggle]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider.");
  return context;
}
