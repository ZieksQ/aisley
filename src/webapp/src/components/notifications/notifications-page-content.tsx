"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { CustomerNotification, NotificationResponse } from "@/lib/notifications/types";

export function NotificationsPageContent() {
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [status, setStatus] = useState<"all" | "unread" | "read">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest<NotificationResponse>(`/api/v1/customer/notifications?status=${status}&per_page=30`);
        if (!cancelled) setItems(response.data);
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : "Notifications could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [status]);

  return <>
    <div className="mb-5 flex gap-2" aria-label="Notification filter">
      {(["all", "unread", "read"] as const).map((option) => <button key={option} type="button" onClick={() => setStatus(option)} className={`rounded-md border px-3 py-1.5 text-sm font-medium capitalize ${status === option ? "border-[#4C1268] bg-[#4C1268] text-white" : "border-[#DED7E1] text-[#514656] hover:bg-[#F6F0F8]"}`}>{option}</button>)}
    </div>
    {loading ? <div className="h-44 animate-pulse rounded-lg bg-[#F6F0F8]" /> : error ? <p className="rounded-lg border border-[#F1C4D8] bg-[#FFF6FA] p-4 text-sm text-[#8A1C4C]">{error}</p> : items.length ? <div className="overflow-hidden rounded-lg border border-[#DED7E1] bg-white">
      {items.map((notification) => <Link key={notification.id} href={`/notifications/${notification.id}`} className={`block border-b border-[#EEE9EF] px-4 py-4 last:border-b-0 hover:bg-[#FAF7FB] ${notification.read_at ? "" : "border-l-4 border-l-[#4C1268] pl-3"}`}><div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-[#281E2C]">{notification.title}</h2><p className="mt-1 text-sm leading-6 text-[#665A69]">{notification.summary}</p></div><time className="shrink-0 text-xs text-[#8A7D8D]">{new Date(notification.created_at).toLocaleDateString()}</time></div></Link>)}
    </div> : <div className="rounded-lg border border-dashed border-[#D8CFDB] bg-white px-5 py-12 text-center text-sm text-[#746778]">No {status === "all" ? "" : status} notifications yet.</div>}
  </>;
}
