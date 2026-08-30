"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiMapPin,
  FiPackage,
  FiRefreshCw,
  FiTruck,
  FiWifiOff,
} from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { fetchOrder, fetchOrderTracking } from "@/lib/orders/client";
import {
  formatOrderDateTime,
  formatOrderMoney,
} from "@/lib/orders/format";
import type {
  OrderDetail,
  OrderTimelineEvent,
  PaginationMeta,
} from "@/lib/orders/types";

export function OrderDetailContent({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { auth } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const returnPath = `/orders/${orderId}`;

  useEffect(() => {
    if (auth.status === "guest") {
      router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
    }
  }, [auth.status, returnPath, router]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;

    const controller = new AbortController();

    fetchOrder(orderId, controller.signal)
      .then((nextOrder) => {
        setOrder(nextOrder);
        setConnectionIssue(null);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        if (caught instanceof ApiError && caught.status === 404) {
          setNotFound(true);
          return;
        }
        if (
          caught instanceof ApiError &&
          (caught.status === 401 || caught.status === 403)
        ) {
          router.replace(`/login?next=${encodeURIComponent(returnPath)}`);
          return;
        }
        setError(
          caught instanceof ApiError
            ? caught.message
            : "We could not load this order. Check your connection and try again.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [auth.status, orderId, retryKey, returnPath, router]);

  const refreshQuietly = useCallback(async () => {
    if (auth.status !== "authenticated" || !navigator.onLine) {
      setConnectionIssue("You are offline. Tracking will refresh when your connection returns.");
      return;
    }

    setRefreshing(true);
    try {
      setOrder(await fetchOrder(orderId));
      setConnectionIssue(null);
    } catch {
      setConnectionIssue(
        "We could not refresh tracking. The last available order details are still shown.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [auth.status, orderId]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;

    function handleFocus() {
      void refreshQuietly();
    }

    function handleOffline() {
      setConnectionIssue("You are offline. Tracking will refresh when your connection returns.");
    }

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleFocus);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleFocus);
      window.removeEventListener("offline", handleOffline);
    };
  }, [auth.status, refreshQuietly]);

  if (auth.status !== "authenticated" || loading) {
    return <OrderDetailLoadingState />;
  }

  if (notFound) {
    return (
      <StatePanel
        title="Order not found"
        message="This order may not exist, or it is not available to your account."
      />
    );
  }

  if (error || !order) {
    return (
      <StatePanel
        title="We could not load this order"
        message={error ?? "Please try again."}
        retry={() => {
          setLoading(true);
          setError(null);
          setNotFound(false);
          setRetryKey((value) => value + 1);
        }}
      />
    );
  }

  return (
    <div>
      {connectionIssue ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 border border-[#E3CFB5] bg-[#FFF9F0] px-4 py-3 text-sm text-[#765226]"
        >
          <FiWifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{connectionIssue}</p>
        </div>
      ) : null}

      <header className="border border-[#DED7E1] bg-white px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#6D1748]">{order.groupLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#281E2C] sm:text-3xl">
              {order.statusLabel}
            </h1>
            <p className="mt-2 text-sm text-[#6B5F6F]">
              Order {order.reference} · {order.shop.name}
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refreshQuietly()}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
          >
            <FiRefreshCw
              aria-hidden="true"
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing…" : "Refresh tracking"}
          </button>
        </div>
        <dl className="mt-5 grid gap-3 border-t border-[#E9E3EB] pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[#746978]">Placed</dt>
            <dd className="mt-1 font-medium text-[#3A2E3E]">
              {formatOrderDateTime(order.placedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[#746978]">Payment</dt>
            <dd className="mt-1 font-medium text-[#3A2E3E]">
              Cash on delivery · {readableValue(order.payment.status)}
            </dd>
          </div>
          <div>
            <dt className="text-[#746978]">Order total</dt>
            <dd className="mt-1 font-semibold text-[#2D2231]">
              {formatOrderMoney(order.totals.payable, order.totals.currency)}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <OrderTimeline key={`${order.id}:${order.latestTrackingAt}`} order={order} />
          <OrderItems order={order} />
        </div>
        <aside className="space-y-5 lg:sticky lg:top-32">
          <OrderMapPanel order={order} />
          <DeliveryPanel order={order} />
          <TotalsPanel order={order} />
        </aside>
      </div>
    </div>
  );
}

function OrderTimeline({ order }: { order: OrderDetail }) {
  const [events, setEvents] = useState(order.timeline);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(page: number) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchOrderTracking(order.id, page);
      setEvents(response.data);
      setMeta(response.meta);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "We could not load the complete tracking history.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="tracking-heading" className="border border-[#DED7E1] bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-[#E9E3EB] px-4 py-4 sm:px-5">
        <div>
          <h2 id="tracking-heading" className="text-base font-semibold text-[#2D2231]">
            Tracking history
          </h2>
          <p className="mt-1 text-xs text-[#746978]">
            Times are shown in your local timezone.
          </p>
        </div>
        <FiTruck aria-hidden="true" className="size-5 text-[#6E5F73]" />
      </div>

      {events.length > 0 ? (
        <ol className="px-4 py-1 sm:px-5">
          {events.map((event, index) => (
            <TimelineRow
              key={event.id}
              event={event}
              last={index === events.length - 1}
            />
          ))}
        </ol>
      ) : (
        <p className="px-5 py-8 text-sm text-[#6B5F6F]">
          Tracking updates are not available yet.
        </p>
      )}

      {error ? (
        <p role="alert" className="border-t border-[#EEE9EF] px-5 py-3 text-sm text-[#9F2D25]">
          {error}
        </p>
      ) : null}

      {order.timelineHasMore && meta === null ? (
        <div className="border-t border-[#EEE9EF] px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadPage(1)}
            className="text-sm font-semibold text-[#4C1268] hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
          >
            {loading ? "Loading history…" : `View all ${order.timelineCount} updates`}
          </button>
        </div>
      ) : null}

      {meta && meta.last_page > 1 ? (
        <div className="flex items-center justify-between border-t border-[#EEE9EF] px-4 py-3 sm:px-5">
          <p className="text-xs text-[#746978]">
            Page {meta.current_page} of {meta.last_page}
          </p>
          <div className="flex gap-2">
            <TimelinePageButton
              label="Previous tracking page"
              disabled={loading || meta.current_page <= 1}
              onClick={() => void loadPage(meta.current_page - 1)}
            >
              <FiChevronLeft aria-hidden="true" />
            </TimelinePageButton>
            <TimelinePageButton
              label="Next tracking page"
              disabled={loading || meta.current_page >= meta.last_page}
              onClick={() => void loadPage(meta.current_page + 1)}
            >
              <FiChevronRight aria-hidden="true" />
            </TimelinePageButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TimelineRow({
  event,
  last,
}: {
  event: OrderTimelineEvent;
  last: boolean;
}) {
  const location = [event.location?.hub, event.location?.city]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
      <div aria-hidden="true" className="flex flex-col items-center">
        <FiCheckCircle className="mt-4 size-4 shrink-0 text-[#6D1748]" />
        {!last ? <span className="mt-1 w-px flex-1 bg-[#DED7E1]" /> : null}
      </div>
      <div className={`py-4 ${last ? "" : "border-b border-[#EEE9EF]"}`}>
        <p className="text-sm font-medium text-[#342838]">{event.label}</p>
        {location ? <p className="mt-1 text-xs text-[#655A69]">{location}</p> : null}
        <time dateTime={event.occurredAt} className="mt-1 block text-xs text-[#817584]">
          {formatOrderDateTime(event.occurredAt)}
        </time>
      </div>
    </li>
  );
}

function TimelinePageButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-md border border-[#CFC6D2] text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function OrderItems({ order }: { order: OrderDetail }) {
  return (
    <section aria-labelledby="items-heading" className="border border-[#DED7E1] bg-white">
      <div className="border-b border-[#E9E3EB] px-4 py-4 sm:px-5">
        <h2 id="items-heading" className="text-base font-semibold text-[#2D2231]">
          Items from {order.shop.name}
        </h2>
      </div>
      <div className="divide-y divide-[#EEE9EF]">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
            <div
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center border border-[#E3DDE5] bg-[#F7F4F7] text-[#6E5F73]"
            >
              <FiPackage className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#302534]">{item.productName}</p>
              {item.selectedOptions.length > 0 ? (
                <p className="mt-1 text-xs text-[#746978]">
                  {item.selectedOptions
                    .map((option) => `${option.group}: ${option.value}`)
                    .join(" · ")}
                </p>
              ) : item.variantName ? (
                <p className="mt-1 text-xs text-[#746978]">{item.variantName}</p>
              ) : null}
              <p className="mt-1 text-xs text-[#817584]">
                Qty {item.quantity}{item.sku ? ` · SKU ${item.sku}` : ""}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-[#342838]">
              {formatOrderMoney(item.lineSubtotal, item.currency)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrderMapPanel({ order }: { order: OrderDetail }) {
  const map = order.map;
  const stale = map.state === "stale";
  const loading = map.state === "loading";

  return (
    <section aria-labelledby="location-heading" className="border border-[#DED7E1] bg-white">
      <div className="border-b border-[#E9E3EB] px-4 py-4">
        <h2 id="location-heading" className="text-base font-semibold text-[#2D2231]">
          Shipment location
        </h2>
      </div>
      <div className="px-4 py-5">
        <div className="flex items-start gap-3">
          <FiMapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#6E5F73]" />
          <div>
            <p className="text-sm font-medium text-[#3A2E3E]">
              {loading
                ? "Loading shipment location"
                : map.available
                ? stale
                  ? "Last known shipment location"
                  : "Shipment location available"
                : "Location is not available yet"}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#746978]">
              {map.message ||
                "Tracking history remains available while location data is unavailable."}
            </p>
            {map.capturedAt ? (
              <p className="mt-2 text-xs text-[#817584]">
                Captured {formatOrderDateTime(map.capturedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DeliveryPanel({ order }: { order: OrderDetail }) {
  const address = order.deliveryAddress;
  return (
    <section aria-labelledby="delivery-heading" className="border border-[#DED7E1] bg-white">
      <div className="border-b border-[#E9E3EB] px-4 py-4">
        <h2 id="delivery-heading" className="text-base font-semibold text-[#2D2231]">
          Delivery address
        </h2>
      </div>
      <address className="px-4 py-4 text-sm not-italic leading-6 text-[#655A69]">
        <strong className="font-semibold text-[#342838]">{address.recipientName}</strong>
        <br />
        {address.contactNumber}
        <br />
        {address.addressLine1}
        {address.addressLine2 ? `, ${address.addressLine2}` : ""}
        <br />
        {address.barangay}, {address.cityMunicipality}
        <br />
        {address.province} {address.postalCode}
        <br />
        {address.country}
      </address>
    </section>
  );
}

function TotalsPanel({ order }: { order: OrderDetail }) {
  const totals = order.totals;
  return (
    <section aria-labelledby="summary-heading" className="border border-[#DED7E1] bg-white">
      <div className="border-b border-[#E9E3EB] px-4 py-4">
        <h2 id="summary-heading" className="text-base font-semibold text-[#2D2231]">
          Payment summary
        </h2>
      </div>
      <dl className="space-y-3 px-4 py-4 text-sm">
        <TotalLine label="Merchandise" value={totals.merchandiseSubtotal} currency={totals.currency} />
        <TotalLine label="Shipping" value={totals.shippingFee} currency={totals.currency} />
        {Number(totals.discount) > 0 ? (
          <TotalLine label="Voucher discount" value={totals.discount} currency={totals.currency} discount />
        ) : null}
        {Number(totals.shippingDiscount) > 0 ? (
          <TotalLine label="Shipping discount" value={totals.shippingDiscount} currency={totals.currency} discount />
        ) : null}
        <div className="flex items-center justify-between gap-4 border-t border-[#E6E0E8] pt-4 font-semibold">
          <dt>Total COD</dt>
          <dd className="text-base text-[#E6007A]">
            {formatOrderMoney(totals.payable, totals.currency)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function TotalLine({
  label,
  value,
  currency,
  discount = false,
}: {
  label: string;
  value: string;
  currency: string;
  discount?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${discount ? "text-[#3F6846]" : "text-[#655A69]"}`}>
      <dt>{label}</dt>
      <dd>{discount ? "−" : ""}{formatOrderMoney(value, currency)}</dd>
    </div>
  );
}

function StatePanel({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="border border-[#DED7E1] bg-white px-5 py-12 text-center">
      <FiPackage aria-hidden="true" className="mx-auto size-9 text-[#86798A]" />
      <h1 className="mt-4 text-xl font-semibold text-[#2D2231]">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B5F6F]">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#38104D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            <FiRefreshCw aria-hidden="true" /> Try again
          </button>
        ) : null}
        <Link
          href="/orders"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          <FiChevronLeft aria-hidden="true" /> Back to orders
        </Link>
      </div>
    </div>
  );
}

function OrderDetailLoadingState() {
  return (
    <div aria-label="Loading order details" className="animate-pulse space-y-5">
      <div className="border border-[#DED7E1] bg-white p-6">
        <div className="h-4 w-24 bg-[#ECE7ED]" />
        <div className="mt-3 h-8 w-64 max-w-full bg-[#E8E2EA]" />
        <div className="mt-4 h-4 w-48 bg-[#F0ECF1]" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-96 border border-[#DED7E1] bg-white" />
        <div className="h-64 border border-[#DED7E1] bg-white" />
      </div>
    </div>
  );
}

function readableValue(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
