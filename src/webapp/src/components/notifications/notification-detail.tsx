"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NotificationCategoryLabel } from "@aisley/ui/notifications";
import { ApiError, apiRequest, initializeCsrf } from "@/lib/api";
import type { CustomerNotification } from "@/lib/notifications/types";

export function NotificationDetail({ id }: { id: string }) {
  const [notification, setNotification] = useState<CustomerNotification | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiRequest<{ data: CustomerNotification }>(`/api/v1/customer/notifications/${id}`).then(({ data: item }) => { setNotification(item); if (!item.read_at) void initializeCsrf().then(() => apiRequest(`/api/v1/customer/notifications/${id}/read`, { method: "POST" })); }).catch((reason: unknown) => setError(reason instanceof ApiError && reason.status === 404 ? "This notification is no longer available." : "Notification could not be loaded.")); }, [id]);
  if (error) return <p className="rounded-lg border border-[#F1C4D8] bg-[#FFF6FA] p-4 text-sm text-[#8A1C4C]">{error}</p>;
  if (!notification) return <div className="h-40 animate-pulse rounded-lg bg-[#F6F0F8]" />;
  const ticketDestination = notification.resource_type === "support_ticket" && isUuid(notification.resource_id ?? null) ? `/account/support-tickets?ticket=${encodeURIComponent(notification.resource_id as string)}` : null;
  return <article className="rounded-lg border border-[#DED7E1] bg-white p-5 sm:p-7"><time className="text-xs text-[#675B6B]">{new Date(notification.created_at).toLocaleString("en-PH")}</time><div className="mt-2"><NotificationCategoryLabel category={notification.category} categoryLabel={notification.category_label} role="customer" /></div><h1 className="mt-1 text-2xl font-semibold text-[#281E2C]">{notification.title}</h1><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#514656]">{notification.summary}</p>{ticketDestination ? <Link href={ticketDestination} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54]">Open support ticket</Link> : notification.order_id ? <Link href={`/orders/${notification.order_id}`} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54]">View order {notification.order_reference}</Link> : notification.type === "customer-campaign.promotion" && notification.destination !== `/notifications/${notification.id}` ? <Link href={notification.destination} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54]">Open destination</Link> : null}</article>;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
