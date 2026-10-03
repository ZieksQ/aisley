"use client";

import { marketplaceConfig } from "@/lib/marketplace/config";

import { useHomeData } from "./home-data-provider";
import { ProductCard } from "./product-card";
import { useDiscoveryFeed } from "./use-discovery-feed";

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
  const { sessionKey } = useHomeData();
  return <DiscoveryResults key={sessionKey} />;
}

function DiscoveryResults() {
  const { data, isRefreshing, refresh, refreshFailed } = useHomeData();
  const { items, nextCursor, requestState, loadNext, sentinelRef } = useDiscoveryFeed();

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
