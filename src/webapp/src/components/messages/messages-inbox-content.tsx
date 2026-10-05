"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChatWorkspace, clearChatPrivateState, type ChatEntry } from "@aisley/chat-ui";
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
  const router = useRouter();
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
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
        clearChatPrivateState();
        setItems([]);
      }
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

  const entries: ChatEntry[] = items.map((item) => ({
    id: item.id,
    title: item.shop.name,
    preview: item.last_message_preview ?? "",
    activity: item.last_message_at,
    unread: item.unread_count,
    onSelect: () => router.push(`/messages/${item.id}`),
  }));

  return (
    <ChatWorkspace
      canLoadMore={Boolean(nextCursor)}
      entries={entries}
      inboxError={error || undefined}
      inboxStatus={loading && !items.length ? <p className="p-4 text-sm text-[#655969]" role="status">Loading conversations…</p> : null}
      onLoadMore={() => void loadMore()}
      onRetryInbox={() => void refresh()}
      loadingMore={busy}
      selected={false}
    >
      <div className="grid min-h-full place-items-center p-8 text-center text-sm text-[#655969]"><p>Select a conversation, or open a Shop or Product to contact its Seller.</p></div>
    </ChatWorkspace>
  );
}
