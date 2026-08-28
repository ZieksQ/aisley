"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fetchHomepage } from "@/lib/marketplace/client";
import { trackMarketplaceEvent } from "@/lib/marketplace/analytics";
import type { HomepageData } from "@/lib/marketplace/types";

type HomeDataContextValue = {
  data: HomepageData;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  refreshFailed: boolean;
};

const HomeDataContext = createContext<HomeDataContextValue | null>(null);

export function HomeDataProvider({
  children,
  initialData,
  trackView = true,
}: {
  children: ReactNode;
  initialData: HomepageData;
  trackView?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const nextData = await fetchHomepage();
      setData(nextData);
      setRefreshFailed(false);
    } catch {
      setRefreshFailed(true);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (trackView) {
      trackMarketplaceEvent("homepage_view", {
        is_authenticated: initialData.viewer.isAuthenticated,
      });
    }

    fetchHomepage(controller.signal)
      .then((nextData) => {
        setData(nextData);
        setRefreshFailed(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRefreshFailed(true);
        }
      })
      .finally(() => setIsRefreshing(false));

    return () => controller.abort();
  }, [initialData.viewer.isAuthenticated, trackView]);

  const value = useMemo(
    () => ({ data, isRefreshing, refresh, refreshFailed }),
    [data, isRefreshing, refresh, refreshFailed],
  );

  return (
    <HomeDataContext.Provider value={value}>
      {children}
    </HomeDataContext.Provider>
  );
}

export function useHomeData() {
  const context = useContext(HomeDataContext);

  if (!context) {
    throw new Error("useHomeData must be used within HomeDataProvider.");
  }

  return context;
}
