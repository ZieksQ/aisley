"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { marketplaceConfig } from "@/lib/marketplace/config";
import { fetchRecommendations } from "@/lib/marketplace/client";
import type { ProductSummary } from "@/lib/marketplace/types";

import { useHomeData } from "./home-data-provider";
import { ProductCard } from "./product-card";

const storageKey = "aisley:homepage-discovery:v1";

type SavedDiscovery = {
  cursor: string | null;
  items: ProductSummary[];
  scrollY: number;
};

function ProductGridSkeleton() {
  return (
    <div
      aria-label="Loading products"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-[#E7E1E8] bg-white"
        >
          <div className="aspect-square animate-pulse bg-[#EEE9EF]" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-full animate-pulse rounded-sm bg-[#EEE9EF]" />
            <div className="h-3 w-3/4 animate-pulse rounded-sm bg-[#EEE9EF]" />
            <div className="mt-4 h-4 w-1/2 animate-pulse rounded-sm bg-[#E5D7E8]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DiscoveryFeed() {
  const { data, isRefreshing, refresh, refreshFailed } = useHomeData();
  const [items, setItems] = useState(data.recommendations.items);
  const [nextCursor, setNextCursor] = useState(data.recommendations.nextCursor);
  const [requestState, setRequestState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [restoreComplete, setRestoreComplete] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const loadedMoreRef = useRef(false);
  const hasSessionStateRef = useRef(false);

  useEffect(() => {
    let savedState: SavedDiscovery | null = null;

    try {
      const stored = window.sessionStorage.getItem(storageKey);

      if (stored) {
        const saved = JSON.parse(stored) as SavedDiscovery;

        if (Array.isArray(saved.items) && saved.items.length > 0) {
          hasSessionStateRef.current = true;
          savedState = saved;
        }
      }
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }

    const frame = window.requestAnimationFrame(() => {
      if (savedState) {
        setItems(
          savedState.items.slice(0, marketplaceConfig.discoveryMaxItems),
        );
        setNextCursor(savedState.cursor ?? null);
        window.scrollTo({
          top: Math.max(0, Number(savedState.scrollY) || 0),
        });
      }

      setRestoreComplete(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (loadedMoreRef.current || hasSessionStateRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setItems(data.recommendations.items);
      setNextCursor(data.recommendations.nextCursor);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [data.recommendations]);

  useEffect(() => {
    if (!restoreComplete) {
      return;
    }

    const save = () => {
      const state: SavedDiscovery = {
        cursor: nextCursor,
        items,
        scrollY: window.scrollY,
      };
      window.sessionStorage.setItem(storageKey, JSON.stringify(state));
    };

    save();
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [items, nextCursor, restoreComplete]);

  const loadNext = useCallback(async () => {
    if (
      loadingRef.current ||
      !nextCursor ||
      items.length >= marketplaceConfig.discoveryMaxItems
    ) {
      return;
    }

    loadingRef.current = true;
    loadedMoreRef.current = true;
    setRequestState("loading");

    try {
      const response = await fetchRecommendations(nextCursor);
      const uniqueProducts = new Map(items.map((product) => [product.id, product]));

      for (const product of response.recommendations.items) {
        uniqueProducts.set(product.id, product);
      }

      const nextItems = Array.from(uniqueProducts.values()).slice(
        0,
        marketplaceConfig.discoveryMaxItems,
      );

      setItems(nextItems);
      setNextCursor(
        nextItems.length >= marketplaceConfig.discoveryMaxItems
          ? null
          : response.recommendations.nextCursor,
      );
      setRequestState("idle");
    } catch {
      setRequestState("error");
    } finally {
      loadingRef.current = false;
    }
  }, [items, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (
      !sentinel ||
      !nextCursor ||
      items.length >= marketplaceConfig.discoveryMaxItems ||
      requestState === "error"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadNext();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, loadNext, nextCursor, requestState]);

  const reachedCap = items.length >= marketplaceConfig.discoveryMaxItems;
  const reachedEnd = items.length > 0 && !nextCursor && requestState !== "loading";

  return (
    <section id="discover" aria-labelledby="discover-heading">
      <div className="mb-4 border-b-2 border-[#4C1268] pb-3">
        <h2
          id="discover-heading"
          className="text-xl font-bold tracking-[-0.02em] text-[#2A1C2E]"
        >
          {data.viewer.isAuthenticated ? "Just for you" : "Discover on Aisley"}
        </h2>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              position={index + 1}
              section="discovery"
            />
          ))}
        </div>
      ) : isRefreshing ? (
        <ProductGridSkeleton />
      ) : (
        <div className="border border-[#E2DCE4] bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-[#3E3242]">
            {refreshFailed
              ? "We couldn't load marketplace products."
              : "More marketplace finds are coming soon."}
          </p>
          {refreshFailed ? (
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 rounded-md border border-[#BFAFC4] px-3 py-2 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              Try again
            </button>
          ) : null}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      {requestState === "loading" ? (
        <p role="status" className="py-6 text-center text-sm text-[#675B6B]">
          Loading more products…
        </p>
      ) : requestState === "error" ? (
        <div className="py-6 text-center">
          <p className="text-sm text-[#675B6B]">
            We couldn&apos;t load the next products. Your current results are still here.
          </p>
          <button
            type="button"
            onClick={() => void loadNext()}
            className="mt-3 rounded-md border border-[#BFAFC4] px-3 py-2 text-sm font-semibold text-[#4C1268] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            Retry
          </button>
        </div>
      ) : reachedCap ? (
        <p className="py-7 text-center text-sm text-[#675B6B]">
          You&apos;ve reached the current discovery limit.
        </p>
      ) : reachedEnd ? (
        <p className="py-7 text-center text-sm text-[#675B6B]">
          You&apos;ve seen all current marketplace finds.
        </p>
      ) : null}
    </section>
  );
}
