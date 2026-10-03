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

import { fetchHomepage } from "@/lib/marketplace/client";
import { useAuth } from "@/components/auth/auth-provider";
import { sessionRevision } from "@/lib/auth/session-events";
import {
  createHomepageRequestGuard,
  discoveryOwner,
  publicHomepageData,
  type DiscoveryOwner,
} from "@/lib/marketplace/homepage-session";
import { pruneDiscoveryStorage } from "@/lib/marketplace/discovery-storage";
import { trackMarketplaceEvent } from "@/lib/marketplace/analytics";
import type { HomepageData } from "@/lib/marketplace/types";

type HomeDataContextValue = {
  data: HomepageData;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  refreshFailed: boolean;
  sessionKey: string;
  revision: number;
  owner: DiscoveryOwner | null;
  isSessionReady: boolean;
};

type HomepageSnapshot = {
  sessionKey: string;
  data: HomepageData;
  isRefreshing: boolean;
  refreshFailed: boolean;
  isSessionReady: boolean;
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
  const { auth } = useAuth();
  const owner = discoveryOwner(auth);
  const revision = sessionRevision();
  const sessionKey = `${owner ?? "checking"}:${revision}`;
  const publicData = useMemo(() => publicHomepageData(initialData), [initialData]);
  const requests = useMemo(() => createHomepageRequestGuard(revision, sessionRevision), [revision]);
  const previousOwner = useRef<DiscoveryOwner | null>(null);
  const [snapshot, setSnapshot] = useState<HomepageSnapshot>(() => ({
    sessionKey,
    data: publicData,
    isRefreshing: true,
    refreshFailed: false,
    isSessionReady: false,
  }));

  // Mask old state during render, not one effect later. Auth's revision also
  // closes the response race before React processes the new identity.
  const current = useMemo(() => snapshot.sessionKey === sessionKey ? snapshot : {
    sessionKey,
    data: publicData,
    isRefreshing: true,
    refreshFailed: false,
    isSessionReady: false,
  }, [snapshot, sessionKey, publicData]);

  const refresh = useCallback(async () => {
    if (owner === null) return;
    const ticket = requests.start();
    if (!ticket) return;
    setSnapshot((state) => ({
      ...(state.sessionKey === sessionKey ? state : {
        sessionKey,
        data: publicData,
        isSessionReady: false,
      }),
      isRefreshing: true,
      refreshFailed: false,
    }));

    try {
      const response = await fetchHomepage(ticket.signal);
      if (!ticket.isCurrent()) return;
      const data = owner === "guest" && response.viewer.isAuthenticated ? publicData : response;
      setSnapshot({
        sessionKey,
        data,
        isRefreshing: false,
        refreshFailed: false,
        isSessionReady: true,
      });
    } catch {
      if (ticket.isCurrent()) {
        setSnapshot((state) => ({ ...state, isRefreshing: false, refreshFailed: true }));
      }
    } finally {
      ticket.finish();
    }
  }, [owner, publicData, requests, sessionKey]);

  useEffect(() => {
    if (owner !== null || previousOwner.current !== null) pruneDiscoveryStorage(owner);
    previousOwner.current = owner;
    const frame = window.requestAnimationFrame(() => {
      if (owner === null) {
        setSnapshot({
          sessionKey,
          data: publicData,
          isRefreshing: true,
          refreshFailed: false,
          isSessionReady: false,
        });
      } else {
        void refresh();
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      requests.cancel();
    };
  }, [owner, publicData, refresh, requests, sessionKey]);

  useEffect(() => {
    if (trackView) {
      trackMarketplaceEvent("homepage_view", {
        is_authenticated: initialData.viewer.isAuthenticated,
      });
    }
  }, [initialData.viewer.isAuthenticated, trackView]);

  const value = useMemo(
    () => ({ ...current, refresh, revision, owner }),
    [current, refresh, revision, owner],
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
