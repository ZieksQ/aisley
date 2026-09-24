"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiMessageCircle } from "react-icons/fi";
import { useAuth } from "@/components/auth/auth-provider";
import { getConversationUnreadCount } from "@/lib/messages";

export function MessageHeaderLink() {
  const { auth } = useAuth();
  const [count, setCount] = useState<{ owner: string; unread: number } | null>(null);
  const customerId = auth.status === "authenticated" ? auth.customer.id : null;

  useEffect(() => {
    if (!customerId) return;
    const refresh = async () => {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      try { setCount({ owner: customerId, unread: (await getConversationUnreadCount()).unread_count }); } catch { /* Keep the last known count. */ }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 20000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [customerId]);

  const visibleUnread = customerId && count?.owner === customerId ? count.unread : 0;
  const destination = auth.status === "authenticated" ? "/messages" : "/login?next=%2Fmessages";
  return (
    <Link aria-label={visibleUnread > 0 ? `Messages, ${visibleUnread} unread` : "Messages"} className="relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href={destination}>
      <FiMessageCircle aria-hidden="true" className="size-5" />
      {visibleUnread > 0 && <span aria-hidden="true" className="absolute right-0 top-0 rounded-md bg-[#E6007A] px-1 text-[10px] font-bold">{visibleUnread > 99 ? "99+" : visibleUnread}</span>}
    </Link>
  );
}
