"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { sessionRevision } from "@/lib/auth/session-events";
import { fetchRecommendations } from "@/lib/marketplace/client";
import { marketplaceConfig } from "@/lib/marketplace/config";
import {
  discoverySignature,
  readDiscovery,
  saveDiscovery,
} from "@/lib/marketplace/discovery-storage";
import { createHomepageRequestGuard } from "@/lib/marketplace/homepage-session";
import type { ProductSummary } from "@/lib/marketplace/types";

import { useHomeData } from "./home-data-provider";

type FeedState = {
  signature: string;
  items: ProductSummary[];
  nextCursor: string | null;
  requestState: "idle" | "loading" | "error";
  restoreComplete: boolean;
};

export function useDiscoveryFeed() {
  const { data, revision, owner, isSessionReady, isRefreshing } = useHomeData();
  const signature = discoverySignature(data.recommendations);
  const initialFeed = useMemo<FeedState>(() => ({
    signature,
    items: data.recommendations.items,
    nextCursor: data.recommendations.nextCursor,
    requestState: "idle",
    restoreComplete: false,
  }), [signature, data.recommendations]);
  const [state, setState] = useState(initialFeed);
  const current = state.signature === signature ? state : initialFeed;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const restoredSignature = useRef<string | null>(null);
  const requests = useMemo(() => createHomepageRequestGuard(revision, sessionRevision), [revision]);

  useEffect(() => {
    if (!owner || !isSessionReady || isRefreshing) return () => requests.cancel();
    const restoring = restoredSignature.current !== signature;
    const saved = restoring ? readDiscovery(
      owner, signature, marketplaceConfig.discoveryPageSize, marketplaceConfig.discoveryMaxItems,
    ) : null;
    const frame = window.requestAnimationFrame(() => {
      if (sessionRevision() !== revision) return;
      setState((previous) => previous.signature === signature && previous.restoreComplete ? {
        ...previous,
        requestState: "idle",
      } : {
        ...initialFeed,
        items: saved?.items ?? initialFeed.items,
        nextCursor: saved ? saved.cursor : initialFeed.nextCursor,
        restoreComplete: true,
      });
      restoredSignature.current = signature;
      if (restoring && saved) window.scrollTo({ top: saved.scrollY });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      requests.cancel();
    };
  }, [initialFeed, isRefreshing, isSessionReady, owner, requests, revision, signature]);

  useEffect(() => {
    if (!owner || !isSessionReady || isRefreshing || !current.restoreComplete) return;
    const save = () => {
      if (sessionRevision() !== revision) return;
      saveDiscovery({
        owner,
        cursor: current.nextCursor,
        feedSignature: signature,
        items: current.items,
        maxItems: marketplaceConfig.discoveryMaxItems,
        pageSize: marketplaceConfig.discoveryPageSize,
        scrollY: window.scrollY,
      });
    };
    save();
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [current, isRefreshing, isSessionReady, owner, revision, signature]);

  const loadNext = useCallback(async () => {
    if (!isSessionReady || isRefreshing || !current.restoreComplete || requests.pending()
      || !current.nextCursor || current.items.length >= marketplaceConfig.discoveryMaxItems) {
      return;
    }
    const ticket = requests.start();
    if (!ticket) return;
    setState((previous) => ({ ...previous, requestState: "loading" }));
    try {
      const response = await fetchRecommendations(current.nextCursor, ticket.signal);
      if (!ticket.isCurrent()) return;
      const unique = new Map(current.items.map((product) => [product.id, product]));
      response.recommendations.items.forEach((product) => unique.set(product.id, product));
      const items = Array.from(unique.values()).slice(0, marketplaceConfig.discoveryMaxItems);
      setState({
        ...current,
        items,
        nextCursor: items.length >= marketplaceConfig.discoveryMaxItems ? null : response.recommendations.nextCursor,
        requestState: "idle",
      });
    } catch {
      if (ticket.isCurrent()) {
        setState((previous) => ({ ...previous, requestState: "error" }));
      }
    } finally {
      ticket.finish();
    }
  }, [current, isRefreshing, isSessionReady, requests]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !isSessionReady || isRefreshing || !current.restoreComplete || !current.nextCursor
      || current.items.length >= marketplaceConfig.discoveryMaxItems || current.requestState !== "idle") {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadNext();
    }, { rootMargin: "600px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [current, isRefreshing, isSessionReady, loadNext]);

  return { ...current, loadNext, sentinelRef };
}
