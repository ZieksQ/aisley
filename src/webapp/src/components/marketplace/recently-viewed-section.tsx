"use client";

import { useEffect, useRef } from "react";
import { FiRefreshCw } from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { useRecentlyViewed } from "@/components/recently-viewed/recently-viewed-provider";

import { useHomeData } from "./home-data-provider";
import { ProductRail } from "./product-rail";

export function RecentlyViewedSection() {
  const { auth } = useAuth();
  const { data, refresh } = useHomeData();
  const {
    clearGuest,
    guestProducts,
    guestStatus,
    mergeStatus,
    notice,
    removeGuest,
    retryGuestResolution,
    retryMerge,
  } = useRecentlyViewed();
  const previousMergeStatus = useRef(mergeStatus);

  useEffect(() => {
    if (previousMergeStatus.current === "pending" && mergeStatus === "idle") {
      void refresh();
    }
    previousMergeStatus.current = mergeStatus;
  }, [mergeStatus, refresh]);

  if (auth.status === "guest" && guestStatus === "loading" && guestProducts.length === 0) {
    return (
      <section aria-labelledby="recently-viewed-loading-heading" aria-busy="true">
        <h2 id="recently-viewed-loading-heading" className="text-xl font-bold text-[#2A1C2E]">Recently viewed</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="aspect-[3/4] animate-pulse rounded-lg bg-[#EAE4EC]" />)}
        </div>
      </section>
    );
  }

  if (auth.status === "guest" && guestStatus === "error") {
    return (
      <section aria-labelledby="recently-viewed-error-heading" className="border-y border-[#DED7E1] py-5">
        <h2 id="recently-viewed-error-heading" className="text-xl font-bold text-[#2A1C2E]">Recently viewed</h2>
        <p className="mt-2 text-sm text-[#6B5F6F]">Your recent products could not be loaded.</p>
        <button type="button" onClick={retryGuestResolution} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
          <FiRefreshCw aria-hidden="true" /> Try again
        </button>
      </section>
    );
  }

  if (auth.status === "guest" && guestStatus === "unavailable") {
    return (
      <section aria-labelledby="recently-viewed-unavailable-heading" className="border-y border-[#DED7E1] py-5">
        <h2 id="recently-viewed-unavailable-heading" className="text-xl font-bold text-[#2A1C2E]">Recently viewed</h2>
        <p className="mt-2 text-sm text-[#6B5F6F]">Recent history is unavailable in this browser. You can continue shopping normally.</p>
      </section>
    );
  }

  const products = auth.status === "authenticated" ? data.recentlyViewed : guestProducts;

  return (
    <>
      {mergeStatus === "pending" ? <p className="mb-3 text-sm text-[#675B6B]" role="status">Adding your guest history to this account…</p> : null}
      {mergeStatus === "failed" ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-[#8C3E16]" role="status">
          <span>Your guest history has not synced yet.</span>
          <button type="button" onClick={retryMerge} className="font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">Try again</button>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">{notice}</p>
      <ProductRail
        id="recently-viewed"
        title="Recently viewed"
        actionHref="/account/recently-viewed"
        products={products}
        onClear={auth.status === "guest" ? () => {
          if (window.confirm("Clear all recently viewed products from this browser?")) clearGuest();
        } : undefined}
        onRemoveProduct={auth.status === "guest" ? removeGuest : undefined}
      />
    </>
  );
}
