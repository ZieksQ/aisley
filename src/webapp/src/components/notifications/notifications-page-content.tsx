"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { NotificationCategoryLabel, NotificationFilters, isNotificationCategory, notificationCategoryOptions } from "@aisley/ui/notifications";
import { ApiError, apiRequest } from "@/lib/api";
import { markCustomerNotificationRead } from "@/lib/notifications/client";
import type { CustomerNotification, NotificationResponse } from "@/lib/notifications/types";

type Status = "all" | "unread" | "read";
const PAGE_SIZE = 30;

function supportTicketDestination(notification: CustomerNotification): string | null {
  if (notification.resource_type !== "support_ticket" || !isUuid(notification.resource_id ?? null)) return null;
  return `/account/support-tickets?ticket=${encodeURIComponent(notification.resource_id as string)}`;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function NotificationsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const statusParam = searchParams.get("status");
  const status: Status = statusParam === "unread" || statusParam === "read" ? statusParam : "all";
  const rawCategory = searchParams.get("category");
  const category = rawCategory && isNotificationCategory(rawCategory, "customer") ? rawCategory : "all";
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [response, setResponse] = useState<NotificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = `${status}:${category}:${page}:${reload}`;

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ status, page: String(page), per_page: String(PAGE_SIZE) });
    if (category !== "all") query.set("category", category);

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiRequest<NotificationResponse>(`/api/v1/customer/notifications?${query.toString()}`);
        if (active) { setResponse(result); setLoadedKey(requestKey); }
      } catch (reason: unknown) {
        if (active) { setError(reason instanceof ApiError ? reason.message : "Notifications could not be loaded."); setLoadedKey(requestKey); }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [category, page, reload, requestKey, status]);

  function updateFilters(nextStatus: Status, nextCategory: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextStatus === "all") next.delete("status");
    else next.set("status", nextStatus);
    if (nextCategory === "all") next.delete("category");
    else next.set("category", nextCategory);
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  const responseIsCurrent = loadedKey === requestKey;
  const currentLoading = loading || !responseIsCurrent || isPending;
  const currentError = responseIsCurrent ? error : null;
  const currentResponse = responseIsCurrent ? response : null;
  const categories = notificationCategoryOptions("customer", currentResponse?.meta.categories);
  const categoryLabel = categories.find((option) => option.key === category)?.label ?? "Other";
  const items = currentResponse?.data ?? [];
  const total = currentResponse?.meta.total;
  const lastPage = currentResponse?.meta.last_page ?? 1;

  return <>
    <div className="mb-4">
      <NotificationFilters
        category={category}
        categories={categories}
        onCategoryChange={(nextCategory) => updateFilters(status, nextCategory)}
        onStatusChange={(nextStatus) => updateFilters(nextStatus, category)}
        role="customer"
        status={status}
      />
    </div>
    <p aria-live="polite" className="mb-3 text-xs text-[#675B6B]">{currentLoading ? "Loading notifications…" : total === undefined ? `${items.length} notifications` : `${total} notification${total === 1 ? "" : "s"}`}</p>
    {currentLoading ? <div aria-label="Loading notifications" className="space-y-px overflow-hidden rounded-lg border border-[#DED7E1] bg-[#EEE9EF]" role="status">{[1, 2, 3].map((index) => <div className="h-24 bg-white" key={index} />)}</div> : currentError ? <div className="rounded-lg border border-[#E8B6C8] bg-[#FFF6FA] p-4 text-sm text-[#7E2447]" role="alert"><p>{currentError}</p><button className="mt-3 min-h-11 rounded-md border border-[#CFC4D2] px-3 font-medium text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]" onClick={() => setReload((value) => value + 1)} type="button">Try again</button></div> : items.length ? <div className="overflow-hidden rounded-lg border border-[#DED7E1] bg-white">
      {items.map((notification) => {
        const ticketDestination = supportTicketDestination(notification);
        return <Link key={notification.id} href={ticketDestination ?? `/notifications/${notification.id}`} onClick={() => { if (ticketDestination && !notification.read_at) void markCustomerNotificationRead(notification.id).catch(() => undefined); }} className={`block min-h-11 border-b border-[#EEE9EF] px-4 py-4 last:border-b-0 hover:bg-[#FAF7FB] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#4C1268] ${notification.read_at ? "" : "border-l-4 border-l-[#4C1268] pl-3"}`}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-sm font-semibold text-[#281E2C]">{notification.title}</h2><p className="mt-1 text-sm leading-6 text-[#514656]">{notification.summary}</p><div className="mt-2"><NotificationCategoryLabel category={notification.category} categoryLabel={notification.category_label} role="customer" /></div></div><time className="shrink-0 text-xs text-[#675B6B]">{new Date(notification.created_at).toLocaleDateString("en-PH")}</time></div></Link>;
      })}
    </div> : <div className="rounded-lg border border-dashed border-[#D8CFDB] bg-white px-5 py-12 text-center text-sm text-[#675B6B]">No {status === "all" ? "" : `${status} `}notifications{category === "all" ? " yet." : ` in ${categoryLabel} yet.`}</div>}
    {!currentLoading && !currentError && currentResponse && lastPage > 1 ? <nav aria-label="Notification pages" className="mt-4 flex items-center justify-between"><button className="min-h-11 rounded-md border border-[#CFC4D2] px-3 text-sm font-medium text-[#4C1268] disabled:opacity-50" disabled={page <= 1} onClick={() => changePage(page - 1)} type="button">Previous</button><span className="text-sm text-[#675B6B]">Page {currentResponse.meta.current_page} of {lastPage}</span><button className="min-h-11 rounded-md border border-[#CFC4D2] px-3 text-sm font-medium text-[#4C1268] disabled:opacity-50" disabled={page >= lastPage} onClick={() => changePage(page + 1)} type="button">Next</button></nav> : null}
  </>;
}
