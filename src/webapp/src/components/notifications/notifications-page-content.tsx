"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { NotificationCenter, isNotificationCategory, notificationCategoryOptions } from "@aisley/ui/notifications";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { listCustomerNotifications, markCustomerNotificationRead } from "@/lib/notifications/client";
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
  const { auth } = useAuth();
  return auth.status === "authenticated" ? <CustomerNotificationCenter key={auth.customer.id} /> : null;
}

function CustomerNotificationCenter() {
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
        const result = await listCustomerNotifications(query);
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
  const items = currentResponse?.data ?? [];
  const total = currentResponse?.meta.total;
  const lastPage = currentResponse?.meta.last_page ?? 1;

  return <NotificationCenter role="customer" description="Your orders, support tickets, and marketplace updates."
    items={items} total={total} loading={currentLoading} error={currentError}
    onRetry={() => setReload(value => value + 1)}
    status={status} category={category} categories={categories}
    onStatusChange={next => updateFilters(next, category)} onCategoryChange={next => updateFilters(status, next)}
    page={page} lastPage={currentResponse ? lastPage : 1} onPageChange={changePage}
    renderAction={(notification, props) => <Link {...props} href={supportTicketDestination(notification) ?? `/notifications/${notification.id}`}
      onClick={() => { if (supportTicketDestination(notification) && !notification.read_at) void markCustomerNotificationRead(notification.id).catch(() => undefined); }} />}
  />;
}
