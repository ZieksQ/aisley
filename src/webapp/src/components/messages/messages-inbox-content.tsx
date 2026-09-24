"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { listConversations, type ConversationSummary } from "@/lib/messages";

export function MessagesInboxContent() {
  const { auth } = useAuth();
  if (auth.status === "loading") return <p role="status">Checking your account…</p>;
  if (auth.status !== "authenticated") return <p>Please <Link className="font-semibold text-[#4C1268] underline" href="/login?next=%2Fmessages">sign in</Link> to see your messages.</p>;

  return <AuthenticatedMessagesInbox key={auth.customer.id} />;
}

function AuthenticatedMessagesInbox() {
  const { auth } = useAuth();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    try {
      const result = await listConversations();
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        result.items.forEach((item) => byId.set(item.id, item));
        return [...byId.values()].sort((left, right) =>
          (right.last_message_at ?? "").localeCompare(left.last_message_at ?? "") || right.id.localeCompare(left.id));
      });
      setNextCursor((current) => current ?? result.next_cursor);
      setError("");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Messages could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [auth.status]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => { if (navigator.onLine) void refresh(); };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void refresh();
    }, 20000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [refresh]);

  async function loadMore() {
    if (!nextCursor) return;
    setBusy(true);
    try {
      const result = await listConversations(nextCursor);
      setItems((current) => [...current, ...result.items.filter((item) => !current.some((entry) => entry.id === item.id))]);
      setNextCursor(result.next_cursor);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Older conversations could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-4 border border-[#E8BBCD] bg-[#FFF5F8] p-3 text-sm text-[#8B204B]" role="alert">{error} <button className="font-semibold underline" onClick={() => void refresh()} type="button">Retry</button></p>}
      {loading ? <p role="status">Loading messages…</p> : items.length === 0 ? (
        <p className="border border-[#DED7E1] bg-white p-8 text-center text-sm text-[#655969]">No conversations yet. Open a Shop or Product to message its Seller.</p>
      ) : (
        <div className="divide-y divide-[#EAE4EC] border border-[#DED7E1] bg-white">
          {items.map((item) => (
            <Link className="flex items-start justify-between gap-4 p-4 hover:bg-[#FAF7FB] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={`/messages/${item.id}`} key={item.id}>
              <span className="min-w-0">
                <span className="block font-semibold text-[#302534]">{item.shop.name}</span>
                <span className="mt-1 block truncate text-sm text-[#6D6170]">{item.last_message_preview}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-[#786C7B]">
                {item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : ""}
                {item.unread_count > 0 && <span className="mt-1 block font-semibold text-[#4C1268]">{item.unread_count} unread</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
      {nextCursor && <button className="mt-4 min-h-10 border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268] disabled:opacity-50" disabled={busy} onClick={() => void loadMore()} type="button">{busy ? "Loading…" : "Load older conversations"}</button>}
    </div>
  );
}
