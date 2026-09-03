"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiClock, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";

import { ProductCard } from "@/components/marketplace/product-card";
import { useRecentlyViewed } from "@/components/recently-viewed/recently-viewed-provider";
import { ApiError } from "@/lib/api";
import {
  clearRecentlyViewed,
  fetchRecentlyViewed,
  removeRecentlyViewedProduct,
} from "@/lib/marketplace/client";
import type { RecentlyViewedItem } from "@/lib/marketplace/types";

const viewedAtFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function RecentlyViewedPageContent() {
  const { mergeStatus, notice: mergeNotice, retryMerge } = useRecentlyViewed();
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState("");
  const clearCancelRef = useRef<HTMLButtonElement>(null);
  const previousMergeStatus = useRef(mergeStatus);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const page = await fetchRecentlyViewed(undefined, signal);
    setItems(page.data);
    setNextCursor(page.meta.next_cursor);
    setStatus("ready");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchRecentlyViewed(undefined, controller.signal)
      .then((page) => {
        setItems(page.data);
        setNextCursor(page.meta.next_cursor);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const refreshHistory = () => void refresh().catch(() => {
      setMessage("Recent history could not be refreshed.");
    });
    window.addEventListener("focus", refreshHistory);
    window.addEventListener("online", refreshHistory);
    return () => {
      window.removeEventListener("focus", refreshHistory);
      window.removeEventListener("online", refreshHistory);
    };
  }, [refresh]);

  useEffect(() => {
    if (confirmClear) clearCancelRef.current?.focus();
  }, [confirmClear]);

  useEffect(() => {
    if (!confirmClear) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !clearing) setConfirmClear(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [clearing, confirmClear]);

  useEffect(() => {
    const merged = previousMergeStatus.current === "pending" && mergeStatus === "idle";
    previousMergeStatus.current = mergeStatus;
    if (!merged) return;

    const timeout = window.setTimeout(() => {
      void refresh().catch(() => setMessage("Your merged history could not be refreshed yet."));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [mergeStatus, refresh]);

  async function removeItem(item: RecentlyViewedItem) {
    setPendingProductId(item.product.id);
    setMessage("");
    setItems((current) => current.filter((entry) => entry.id !== item.id));

    try {
      await removeRecentlyViewedProduct(item.product.id);
      setMessage(`${item.product.title} was removed from your recent history.`);
      document.getElementById("recently-viewed-page-heading")?.focus();
    } catch (error) {
      setItems((current) => current.some((entry) => entry.id === item.id) ? current : [item, ...current]);
      setMessage(error instanceof ApiError ? error.message : "This product could not be removed. Try again.");
    } finally {
      setPendingProductId(null);
    }
  }

  async function clearAll() {
    setClearing(true);
    setMessage("");
    try {
      await clearRecentlyViewed();
      setItems([]);
      setNextCursor(null);
      setConfirmClear(false);
      setMessage("Your recent history was cleared.");
      document.getElementById("recently-viewed-page-heading")?.focus();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Recent history could not be cleared. Try again.");
    } finally {
      setClearing(false);
    }
  }

  if (status === "loading") return <RecentlyViewedLoading />;

  if (status === "error") {
    return (
      <section className="border border-[#DED7E1] bg-white px-5 py-10 text-center" aria-labelledby="recently-viewed-error-heading">
        <h1 id="recently-viewed-error-heading" className="text-xl font-semibold text-[#2D2231]">Recently viewed could not be loaded</h1>
        <p className="mt-2 text-sm text-[#6B5F6F]">Check your connection and try again.</p>
        <button type="button" onClick={() => { setStatus("loading"); void refresh().catch(() => setStatus("error")); }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
          <FiRefreshCw aria-hidden="true" /> Try again
        </button>
      </section>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#DED7E1] pb-4">
        <div>
          <h1 id="recently-viewed-page-heading" tabIndex={-1} className="text-2xl font-semibold text-[#281E2C] outline-none">Recently viewed</h1>
          <p className="mt-1 text-sm text-[#675B6B]">Products you opened recently, newest first.</p>
        </div>
        {items.length > 0 ? (
          <button type="button" onClick={() => setConfirmClear(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D8CFDA] bg-white px-4 text-sm font-semibold text-[#6A4058] hover:border-[#C9A9B9] hover:text-[#B30060] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
            <FiTrash2 aria-hidden="true" /> Clear history
          </button>
        ) : null}
      </div>

      {mergeStatus === "pending" ? <p className="mt-4 text-sm text-[#675B6B]" role="status">Adding history from this browser to your account…</p> : null}
      {mergeStatus === "failed" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 border border-[#E8C9B7] bg-[#FFF8F3] px-4 py-3 text-sm text-[#7D3614]" role="status">
          <span>Your guest history has not synced yet.</span>
          <button type="button" onClick={retryMerge} className="font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">Try again</button>
        </div>
      ) : null}
      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-[#6D1748]" role="status">{message || mergeNotice}</p>

      {items.length === 0 ? (
        <section className="mt-2 border border-[#DED7E1] bg-white px-5 py-12 text-center" aria-labelledby="recently-viewed-empty-heading">
          <FiClock aria-hidden="true" className="mx-auto size-10 text-[#8B7D90]" />
          <h2 id="recently-viewed-empty-heading" className="mt-4 text-xl font-semibold text-[#2D2231]">No recently viewed products</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B5F6F]">Products appear here after you open their product page.</p>
          <Link href="/" className="mt-5 inline-flex min-h-10 items-center rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]">Browse products</Link>
        </section>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((item, index) => (
              <article key={item.id} className="flex min-w-0 flex-col">
                <ProductCard product={item.product} position={index + 1} section="customer_recently_viewed" />
                <p className="mt-2 text-xs text-[#746978]">Viewed {viewedAtFormatter.format(new Date(item.lastViewedAt))}</p>
                <button type="button" disabled={pendingProductId === item.product.id} onClick={() => void removeItem(item)} className="mt-2 flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#D8CFDA] bg-white px-3 text-sm font-semibold text-[#5E5262] hover:border-[#C9A9B9] hover:text-[#B30060] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-wait disabled:opacity-60">
                  <FiX aria-hidden="true" /> {pendingProductId === item.product.id ? "Removing…" : "Remove"}
                </button>
              </article>
            ))}
          </div>
          {nextCursor ? (
            <div className="mt-7 text-center">
              <button type="button" disabled={loadingMore} onClick={async () => {
                setLoadingMore(true);
                setMessage("");
                try {
                  const page = await fetchRecentlyViewed(nextCursor);
                  setItems((current) => {
                    const known = new Set(current.map((item) => item.id));
                    return [...current, ...page.data.filter((item) => !known.has(item.id))];
                  });
                  setNextCursor(page.meta.next_cursor);
                } catch {
                  setMessage("More recent products could not be loaded. Try again.");
                } finally {
                  setLoadingMore(false);
                }
              }} className="min-h-10 rounded-md border border-[#CFC6D2] bg-white px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60">
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}

      {confirmClear ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#241628]/55 px-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !clearing) setConfirmClear(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="clear-history-title" aria-describedby="clear-history-description" className="w-full max-w-md rounded-lg border border-[#D8CFDA] bg-white p-6 shadow-[0_2px_8px_rgba(49,18,63,0.12)]">
            <h2 id="clear-history-title" className="text-lg font-semibold text-[#2D2231]">Clear recent history?</h2>
            <p id="clear-history-description" className="mt-2 text-sm leading-6 text-[#675B6B]">This removes every product from your account’s recently viewed history. It does not affect your Wishlist or Cart.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button ref={clearCancelRef} type="button" disabled={clearing} onClick={() => setConfirmClear(false)} className="min-h-10 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#514656] hover:bg-[#F7F4F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">Cancel</button>
              <button type="button" disabled={clearing} onClick={() => void clearAll()} className="min-h-10 rounded-md bg-[#B30060] px-4 text-sm font-semibold text-white hover:bg-[#950050] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] disabled:opacity-60">{clearing ? "Clearing…" : "Clear history"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function RecentlyViewedLoading() {
  return (
    <div aria-label="Loading recently viewed products" aria-busy="true">
      <div className="h-8 w-52 animate-pulse bg-[#E9E4EB]" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div className="aspect-[3/4] animate-pulse border border-[#DED7E1] bg-white" key={item} />)}
      </div>
    </div>
  );
}
