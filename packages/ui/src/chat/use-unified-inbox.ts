"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatRole } from "./unified-state";
import { clearChatPrivateState } from "./private-state";
import type { ChatNotification } from "./notification-state";

export type UnifiedChatSummary = ChatNotification & {
  counterparty_role: ChatRole;
  context_label: string | null;
  send_allowed: boolean;
  read_only_reason: string | null;
};
export type UnifiedChatPage = { data: UnifiedChatSummary[]; meta: { next_cursor: string | null; unread_count: number } };
export type UnifiedChatLoader = (query: string, signal: AbortSignal) => Promise<UnifiedChatPage>;

export function useUnifiedChatInbox(load: UnifiedChatLoader, filter: string) {
  const [items, setItems] = useState<UnifiedChatSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const refreshRef = useRef<(more?: boolean) => void>(() => {});
  const loadedCount = useRef(0);
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let pending = false;
    let queued = false;
    let generation = 0;
    let controller: AbortController | null = null;
    cursorRef.current = null;
    loadedCount.current = 0;
    setItems([]);
    setCursor(null);
    setUnread(0);
    setError("");
    setDenied(false);
    setLoading(true);
    const refresh = async (more = false) => {
      if (!active || !navigator.onLine || document.visibilityState !== "visible") return;
      if (pending) {
        if (!more) queued = true;
        return;
      }
      if (more && !cursorRef.current) return;
      pending = true;
      const version = generation;
      controller = new AbortController();
      const requestController = controller;
      const timeout = window.setTimeout(() => requestController.abort(), 15000);
      const query = new URLSearchParams();
      if (filter) query.set("counterparty_role", filter);
      if (more && cursorRef.current) query.set("cursor", cursorRef.current);
      setLoading(true);
      try {
        const page = await load(query.toString(), requestController.signal);
        if (!more) {
          const target = Math.max(20, loadedCount.current);
          while (page.data.length < target && page.meta.next_cursor) {
            if (!active || version !== generation) return;
            query.set("cursor", page.meta.next_cursor);
            const older = await load(query.toString(), requestController.signal);
            page.data.push(...older.data);
            page.meta.next_cursor = older.meta.next_cursor;
          }
        }
        if (!active || version !== generation) return;
        setItems((current) => {
          const byId = new Map((more ? current : []).map((item) => [item.id, item]));
          page.data.forEach((item) => byId.set(item.id, item));
          const next = [...byId.values()].sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "") || b.id.localeCompare(a.id));
          loadedCount.current = next.length;
          return next;
        });
        cursorRef.current = page.meta.next_cursor;
        setCursor(page.meta.next_cursor);
        setUnread(page.meta.unread_count);
        setError("");
        setDenied(false);
      } catch (caught) {
        if (!active || version !== generation) return;
        const status = caught && typeof caught === "object" && "status" in caught ? caught.status : null;
        if (status === 401 || status === 403 || status === 419) {
          clearChatPrivateState();
          setDenied(true);
        }
        setError(caught instanceof Error ? caught.message : "Messages could not be loaded. Try again.");
      } finally {
        window.clearTimeout(timeout);
        pending = false;
        if (active) {
          setLoading(false);
          if (queued) { queued = false; void refresh(); }
        }
      }
    };
    const clear = () => {
      generation++;
      controller?.abort();
      queued = false;
      setItems([]);
      setUnread(0);
      setCursor(null);
      cursorRef.current = null;
      loadedCount.current = 0;
      setDenied(true);
    };
    const offline = () => setError("You are offline. Reconnect to refresh messages.");
    const onRefresh = () => { void refresh(); };
    refreshRef.current = (more) => { void refresh(more); };
    const timer = window.setInterval(onRefresh, 15000);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("online", onRefresh);
    window.addEventListener("offline", offline);
    window.addEventListener("aisley:chat-unread-changed", onRefresh);
    window.addEventListener("aisley:chat-private-cleared", clear);
    document.addEventListener("visibilitychange", onRefresh);
    void refresh();
    if (!navigator.onLine) { offline(); setLoading(false); }
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("online", onRefresh);
      window.removeEventListener("offline", offline);
      window.removeEventListener("aisley:chat-unread-changed", onRefresh);
      window.removeEventListener("aisley:chat-private-cleared", clear);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [load, filter]);

  return { items, cursor, unread, loading, error, denied,
    refresh: useCallback(() => refreshRef.current(), []),
    loadMore: useCallback(() => refreshRef.current(true), []),
  };
}
