"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPackage,
  FiRefreshCw,
  FiShoppingBag,
} from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { fetchOrders } from "@/lib/orders/client";
import {
  formatOrderDateTime,
  formatOrderMoney,
} from "@/lib/orders/format";
import type {
  CustomerOrderGroup,
  OrderListResponse,
  OrderSummary,
} from "@/lib/orders/types";

const fallbackTabs: OrderListResponse["filters"]["tabs"] = [
  { value: null, label: "All" },
  { value: "to_pay", label: "To Pay" },
  { value: "to_prepare", label: "To Prepare" },
  { value: "to_ship", label: "To Ship" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "completed", label: "Completed" },
  { value: "cancelled_issue", label: "Cancelled / Issue" },
];

export function OrdersPageContent({
  initialGroup,
  initialPage,
}: {
  initialGroup: CustomerOrderGroup | null;
  initialPage: number;
}) {
  const router = useRouter();
  const { auth } = useAuth();
  const [response, setResponse] = useState<OrderListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const queryKey = `${initialGroup ?? "all"}:${initialPage}:${retryKey}`;
  const loading = loadedQuery !== queryKey;

  useEffect(() => {
    if (auth.status === "guest") {
      router.replace(`/login?next=${encodeURIComponent("/orders")}`);
    }
  }, [auth.status, router]);

  useEffect(() => {
    if (auth.status !== "authenticated") {
      return;
    }

    const controller = new AbortController();
    fetchOrders(initialGroup, initialPage, controller.signal)
      .then((nextResponse) => {
        setResponse(nextResponse);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        if (
          caught instanceof ApiError &&
          (caught.status === 401 || caught.status === 403)
        ) {
          router.replace(`/login?next=${encodeURIComponent("/orders")}`);
          return;
        }

        setError(
          caught instanceof ApiError
            ? caught.message
            : "We could not load your orders. Check your connection and try again.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadedQuery(queryKey);
        }
      });

    return () => controller.abort();
  }, [auth.status, initialGroup, initialPage, queryKey, router]);

  function navigate(group: CustomerOrderGroup | null, page = 1) {
    setError(null);
    const parameters = new URLSearchParams();
    if (group) parameters.set("group", group);
    if (page > 1) parameters.set("page", String(page));
    const query = parameters.toString();
    router.push(query ? `/orders?${query}` : "/orders");
  }

  const tabs = response?.filters.tabs ?? fallbackTabs;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Filter orders by status"
        className="marketplace-scroll flex overflow-x-auto border-b border-[#DCD4DF] bg-white"
      >
        {tabs.map((tab) => {
          const selected = tab.value === initialGroup;
          return (
            <button
              key={tab.value ?? "all"}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => navigate(tab.value)}
              className={`min-h-12 shrink-0 border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E6007A] sm:px-5 ${
                selected
                  ? "border-[#E6007A] text-[#A9005B]"
                  : "border-transparent text-[#655A69] hover:border-[#CFC5D2] hover:text-[#3F3343]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {auth.status !== "authenticated" || (loading && !response) ? (
        <OrdersLoadingState />
      ) : error ? (
        <OrdersErrorState
          message={error}
          onRetry={() => setRetryKey((value) => value + 1)}
        />
      ) : response && response.data.length > 0 ? (
        <>
          <div
            aria-live="polite"
            aria-busy={loading}
            className={`mt-4 space-y-3 ${loading ? "opacity-60" : ""}`}
          >
            {response.data.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
          <OrderPagination
            currentPage={response.meta.current_page}
            lastPage={response.meta.last_page}
            total={response.meta.total}
            onPageChange={(page) => navigate(initialGroup, page)}
          />
        </>
      ) : (
        <OrdersEmptyState filtered={initialGroup !== null} />
      )}
    </div>
  );
}

function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <article className="border border-[#DED7E1] bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E9E3EB] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#302534]">
            {order.shop.name}
          </p>
          <p className="mt-0.5 text-xs text-[#7A6F7D]">
            Order {order.reference}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[#6D1748]">
            {order.statusLabel}
          </p>
          <p className="mt-0.5 text-xs text-[#746978]">{order.groupLabel}</p>
        </div>
      </header>

      <div className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center border border-[#E3DDE5] bg-[#F7F4F7] text-[#6E5F73] sm:size-16"
        >
          <FiPackage className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#302534]">
            {order.itemPreview?.productName ?? "Order items"}
          </p>
          {order.itemPreview?.variantName ? (
            <p className="mt-1 truncate text-xs text-[#746978]">
              {order.itemPreview.variantName}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[#746978]">
            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
            {order.lineCount > 1 ? ` across ${order.lineCount} products` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-[#746978]">Order total</p>
          <p className="mt-1 font-semibold text-[#2D2231]">
            {formatOrderMoney(order.totals.payable, order.totals.currency)}
          </p>
        </div>
      </div>

      <footer className="flex flex-col gap-3 border-t border-[#EEE9EF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs text-[#746978]">
          Latest update {formatOrderDateTime(order.latestTrackingAt)}
        </p>
        <Link
          href={order.detailUrl}
          className="inline-flex min-h-9 items-center justify-center rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#38104D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          View order
        </Link>
      </footer>
    </article>
  );
}

function OrderPagination({
  currentPage,
  lastPage,
  total,
  onPageChange,
}: {
  currentPage: number;
  lastPage: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (lastPage <= 1) return null;

  return (
    <nav
      aria-label="Order list pages"
      className="mt-5 flex items-center justify-between border border-[#DED7E1] bg-white px-4 py-3"
    >
      <p className="text-xs text-[#746978]">
        Page {currentPage} of {lastPage} · {total} orders
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#CFC6D2] px-3 text-sm font-medium text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiChevronLeft aria-hidden="true" /> Previous
        </button>
        <button
          type="button"
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-[#CFC6D2] px-3 text-sm font-medium text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <FiChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

function OrdersEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="mt-4 border border-[#DED7E1] bg-white px-5 py-12 text-center sm:px-8">
      <FiShoppingBag aria-hidden="true" className="mx-auto size-9 text-[#86798A]" />
      <h2 className="mt-4 text-lg font-semibold text-[#2D2231]">
        {filtered ? "No orders in this status" : "You have no orders yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B5F6F]">
        {filtered
          ? "Choose another status or return to All to see your complete order history."
          : "Orders placed through checkout will appear here, grouped by Shop."}
      </p>
      <Link
        href={filtered ? "/orders" : "/"}
        className="mt-5 inline-flex min-h-10 items-center rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]"
      >
        {filtered ? "View all orders" : "Browse products"}
      </Link>
    </div>
  );
}

function OrdersErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mt-4 border border-[#E0CACA] bg-white px-5 py-10 text-center">
      <p role="alert" className="text-sm text-[#9F2D25]">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
      >
        <FiRefreshCw aria-hidden="true" /> Try again
      </button>
    </div>
  );
}

export function OrdersLoadingState() {
  return (
    <div aria-label="Loading orders" className="mt-4 space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse border border-[#DED7E1] bg-white">
          <div className="flex justify-between border-b border-[#EEE9EF] px-5 py-4">
            <div className="h-4 w-36 bg-[#ECE7ED]" />
            <div className="h-4 w-24 bg-[#ECE7ED]" />
          </div>
          <div className="flex gap-4 px-5 py-4">
            <div className="size-16 bg-[#F0ECF1]" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-4 w-1/2 bg-[#ECE7ED]" />
              <div className="h-3 w-1/3 bg-[#F0ECF1]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
