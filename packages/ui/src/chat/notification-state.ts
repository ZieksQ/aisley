"use client";

import { clearChatPrivateState } from "./private-state";
import { useCallback, useEffect, useRef, useState } from "react";

export type ChatNotification = {
  id: string;
  kind: "customer_shop" | "customer_logistics" | "seller_logistics" | "logistics_courier" | "courier_seller" | "courier_customer";
  counterparty_label: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
};
export type ChatNotificationPage = { data: ChatNotification[]; meta: { unread_count: number } };

const changedEvent = "aisley:chat-unread-changed";

/** Notify only after a committed read acknowledgment. Preserve the caller's response. */
export async function acknowledgeChatRead<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  window.dispatchEvent(new Event(changedEvent));
  return result;
}

export function useChatNotifications(load: (signal: AbortSignal) => Promise<ChatNotificationPage>) {
  const [page, setPage] = useState<ChatNotificationPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    let pending = false;
    let queued = false;
    let controller: AbortController | null = null;
    let generation = 0;
    const refresh = async () => {
      if (!active || !navigator.onLine || document.visibilityState !== "visible") return;
      if (pending) { queued = true; return; }
      pending = true;
      const requestGeneration = generation;
      controller = new AbortController();
      const timer = window.setTimeout(() => controller?.abort(), 15000);
      setLoading(true);
      try {
        const result = await load(controller.signal);
        if (active && requestGeneration === generation) { setPage(result); setError(""); }
      } catch (caught) {
        if (active && requestGeneration === generation) {
          const status = caught && typeof caught === "object" && "status" in caught ? caught.status : null;
          if (status === 401 || status === 403 || status === 419) clearChatPrivateState();
          setError(status === 401 || status === 419 ? "Your session expired. Sign in again to see messages."
            : status === 403 ? "Chat is unavailable for this account."
            : "Could not refresh messages. Try again.");
        }
      } finally {
        window.clearTimeout(timer);
        pending = false;
        if (active) {
          setLoading(false);
          if (queued) { queued = false; void refresh(); }
        }
      }
    };
    const clear = () => {
      generation += 1;
      queued = false;
      controller?.abort();
      setPage(null);
      setError("Chat access changed. Refresh to check your access.");
    };
    const offline = () => setError("You are offline. Messages will refresh when you reconnect.");
    refreshRef.current = () => { void refresh(); };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 15000);
    const onRefresh = () => { void refresh(); };
    window.addEventListener("aisley:chat-private-cleared", clear);
    window.addEventListener("offline", offline);
    if (!navigator.onLine) offline();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("online", onRefresh);
    window.addEventListener(changedEvent, onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("aisley:chat-private-cleared", clear);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("online", onRefresh);
      window.removeEventListener(changedEvent, onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [load]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { page, error, loading, refresh };
}
