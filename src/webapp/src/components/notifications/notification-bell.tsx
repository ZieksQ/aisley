"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiBell, FiX } from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { apiRequest } from "@/lib/api";
import type { CustomerNotification, NotificationResponse } from "@/lib/notifications/types";

const NOTIFICATION_PREVIEW_LIMIT = 5;

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}

export function NotificationBell() {
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const load = async () => {
      try {
        const unreadResponse = await apiRequest<NotificationResponse>(`/api/v1/customer/notifications?status=unread&per_page=${NOTIFICATION_PREVIEW_LIMIT}`);
        const unreadNotifications = unreadResponse.data.slice(0, NOTIFICATION_PREVIEW_LIMIT);

        if (unreadNotifications.length === NOTIFICATION_PREVIEW_LIMIT) {
          setNotifications(unreadNotifications);
          return;
        }

        const readResponse = await apiRequest<NotificationResponse>(`/api/v1/customer/notifications?status=read&per_page=${NOTIFICATION_PREVIEW_LIMIT - unreadNotifications.length}`);
        setNotifications([...unreadNotifications, ...readResponse.data].slice(0, NOTIFICATION_PREVIEW_LIMIT));
      } catch {
        setNotifications([]);
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, [auth.status]);

  if (auth.status !== "authenticated") return null;

  const hasUnreadNotifications = notifications.some((notification) => notification.read_at === null);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" aria-label={`Notifications${hasUnreadNotifications ? ", unread notifications" : ""}`} className="relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <FiBell aria-hidden="true" className="size-5" />
        {hasUnreadNotifications ? <span className="absolute right-1 top-0.5 size-2 rounded-full bg-[#E6007A] ring-2 ring-white" /> : null}
      </button>
      {open ? <div role="dialog" aria-label="Recent notifications" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#DED7E1] bg-white shadow-[0_16px_38px_rgba(49,18,63,0.16)]">
        <div className="flex items-center justify-between border-b border-[#EEE9EF] px-4 py-3"><h2 className="font-semibold text-[#281E2C]">Notifications</h2><button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-[#746778] hover:bg-[#F6F0F8]" aria-label="Close notifications"><FiX /></button></div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length ? notifications.map((notification) => { const unread = notification.read_at === null; return <Link onClick={() => setOpen(false)} key={notification.id} href={notification.destination} className={`block border-b border-[#F0EBF1] px-4 py-3 ${unread ? "bg-[#F6F0F8] hover:bg-[#EEE2F3]" : "hover:bg-[#FAF7FB]"}`}><p className="text-sm font-medium text-[#281E2C]">{unread ? <span className="sr-only">Unread notification: </span> : null}{notification.title}</p><p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#665A69]">{notification.summary}</p><p className="mt-1 text-[11px] text-[#8A7D8D]">{relativeTime(notification.created_at)}</p></Link>; }) : <p className="px-4 py-8 text-center text-sm text-[#746778]">You’re all caught up.</p>}
        </div>
        <Link href="/notifications" onClick={() => setOpen(false)} className="block px-4 py-3 text-center text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8]">View all notifications</Link>
      </div> : null}
    </div>
  );
}
