"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, apiRequest, initializeCsrf } from "@/lib/api";
import type { CustomerNotification } from "@/lib/notifications/types";

export function NotificationDetail({ id }: { id: string }) {
  const [notification, setNotification] = useState<CustomerNotification | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiRequest<{ data: CustomerNotification }>(`/api/v1/customer/notifications/${id}`).then(({ data: item }) => { setNotification(item); if (!item.read_at) void initializeCsrf().then(() => apiRequest(`/api/v1/customer/notifications/${id}/read`, { method: "POST" })); }).catch((reason: unknown) => setError(reason instanceof ApiError && reason.status === 404 ? "This notification is no longer available." : "Notification could not be loaded.")); }, [id]);
  if (error) return <p className="rounded-lg border border-[#F1C4D8] bg-[#FFF6FA] p-4 text-sm text-[#8A1C4C]">{error}</p>;
  if (!notification) return <div className="h-40 animate-pulse rounded-lg bg-[#F6F0F8]" />;
  return <article className="rounded-lg border border-[#DED7E1] bg-white p-5 sm:p-7"><time className="text-xs text-[#8A7D8D]">{new Date(notification.created_at).toLocaleString()}</time><h1 className="mt-2 text-2xl font-semibold text-[#281E2C]">{notification.title}</h1><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#514656]">{notification.summary}</p>{notification.order_id ? <Link href={`/orders/${notification.order_id}`} className="mt-6 inline-flex rounded-md bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3A0D50]">View order {notification.order_reference}</Link> : null}</article>;
}
