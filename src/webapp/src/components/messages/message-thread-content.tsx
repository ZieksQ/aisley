"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer, ChatHistory, ChatWorkspace, clearChatPrivateState, readChatAttempt, readChatDraft, writeChatAttempt, writeChatDraft, type ChatEntry } from "@aisley/chat-ui";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { getConversation, listConversations, listMessages, markConversationRead, sendMessage } from "@/lib/messages";
import type { ConversationMessage, ConversationSummary } from "@/lib/messages";

function errorText(reason: unknown) {
  if (reason instanceof Error && reason.message.startsWith("Message delivery was not confirmed")) return reason.message;
  if (!(reason instanceof ApiError)) return "Your connection may be unavailable. Retry with the same message.";
  if (reason.status === 404) return "This conversation is unavailable to your account.";
  if (reason.status === 409) return "This Shop cannot receive a new message right now. Your history is still available.";
  if (reason.status === 429) return "Too many messages. Wait a moment and retry.";
  return reason.message;
}

export function MessageThreadContent({ id }: { id: string }) {
  const { auth } = useAuth();
  if (auth.status === "loading") return <p role="status">Checking your account…</p>;
  if (auth.status !== "authenticated") return <p>Please <Link className="font-semibold text-[#4C1268] underline" href={`/login?next=${encodeURIComponent(`/messages/${id}`)}`}>sign in</Link> to open this conversation.</p>;

  return <AuthenticatedMessageThread id={id} key={`${auth.customer.id}:${id}`} />;
}

function AuthenticatedMessageThread({ id }: { id: string }) {
  const { auth } = useAuth();
  const router = useRouter();
  const accountId = auth.status === "authenticated" ? auth.customer.id : "unknown";
  const draftKey = `customer-shop:${accountId}:${id}`;
  const [thread, setThread] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [body, setBody] = useState(() => readChatDraft(draftKey));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [uncertain, setUncertain] = useState(() => Boolean(readChatAttempt(draftKey)));
  const [inbox, setInbox] = useState<ConversationSummary[]>([]);
  const [inboxCursor, setInboxCursor] = useState<string | null>(null);
  const [inboxError, setInboxError] = useState("");
  const [inboxBusy, setInboxBusy] = useState(false);
  const pendingKey = useRef(readChatAttempt(draftKey));

  const clearPrivateConversationState = useCallback(() => {
    clearChatPrivateState();
    pendingKey.current = null;
    setBody("");
    setUncertain(false);
  }, []);

  useEffect(() => { writeChatDraft(draftKey, body); }, [body, draftKey]);

  const loadInbox = useCallback(async (cursor?: string) => {
    try {
      const page = await listConversations(cursor);
      setInbox((current) => cursor
        ? [...current, ...page.items.filter((item) => !current.some((saved) => saved.id === item.id))]
        : [...page.items, ...current.filter((item) => !page.items.some((fresh) => fresh.id === item.id))]);
      setInboxCursor(page.next_cursor);
      setInboxError("");
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
        clearPrivateConversationState();
        setInbox([]);
        setThread(null);
        setMessages([]);
      }
      setInboxError(errorText(reason));
    }
  }, [clearPrivateConversationState]);

  const refresh = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    try {
      const [detail, page] = await Promise.all([getConversation(id), listMessages(id)]);
      setThread(detail.data);
      setMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]));
        page.items.forEach((message) => byId.set(message.id, message));
        return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
      });
      setNextCursor((current) => current ?? page.next_cursor);
      setError("");
      const latest = page.items.at(-1)?.sequence;
      if (!document.hidden && latest && latest > detail.data.last_read_sequence) {
        const read = await markConversationRead(id, latest);
        setThread(read.data);
      }
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearPrivateConversationState();
        setThread(null);
        setMessages([]);
      }
      setError(errorText(reason));
    } finally {
      setLoading(false);
    }
  }, [auth.status, clearPrivateConversationState, id]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const initialInbox = window.setTimeout(() => void loadInbox(), 0);
    const onFocus = () => { if (navigator.onLine) { void refresh(); void loadInbox(); } };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) { void refresh(); void loadInbox(); }
    }, 12000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(initialInbox);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [loadInbox, refresh]);

  async function loadOlder() {
    if (!nextCursor) return;
    setOlderBusy(true);
    try {
      const page = await listMessages(id, nextCursor);
      setMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]));
        page.items.forEach((message) => byId.set(message.id, message));
        return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
      });
      setNextCursor(page.next_cursor);
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearPrivateConversationState();
        setThread(null);
        setMessages([]);
      }
      setError(errorText(reason));
    } finally {
      setOlderBusy(false);
    }
  }

  async function submit() {
    const text = body.trim();
    if (!text || (!thread?.send_allowed && !uncertain) || busy) return;
    const attempt = pendingKey.current?.body === text ? pendingKey.current : { key: crypto.randomUUID(), body: text };
    pendingKey.current = attempt;
    writeChatAttempt(draftKey, attempt);
    setBusy(true);
    setSendError("");
    try {
      const result = await sendMessage(id, { body: text }, attempt.key);
      setThread(result.conversation);
      setMessages((current) => current.some((message) => message.id === result.message.id) ? current : [...current, result.message]);
      setBody("");
      pendingKey.current = null;
      writeChatDraft(draftKey, "");
      writeChatAttempt(draftKey, null);
      setUncertain(false);
      await refresh();
    } catch (reason) {
      setSendError(errorText(reason));
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearPrivateConversationState();
        pendingKey.current = null;
        setBody("");
        setUncertain(false);
      } else if (reason instanceof ApiError && [409, 422, 429].includes(reason.status)) {
        pendingKey.current = null;
        writeChatAttempt(draftKey, null);
        setUncertain(false);
      } else {
        setUncertain(true);
      }
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  const entries: ChatEntry[] = inbox.map((item) => ({
    id: item.id,
    title: item.shop.name,
    preview: item.last_message_preview ?? "",
    activity: item.last_message_at,
    unread: item.unread_count,
    onSelect: () => router.push(`/messages/${item.id}`),
    selected: item.id === id,
  }));
  if (thread && !entries.some((entry) => entry.id === thread.id)) entries.unshift({
    id: thread.id, title: thread.shop.name, preview: thread.last_message_preview ?? "", activity: thread.last_message_at,
    unread: thread.unread_count, onSelect: () => router.push(`/messages/${thread.id}`), selected: true,
  });

  return (
    <ChatWorkspace
      entries={entries}
      selected
      inboxTitle="Shop messages"
      inboxStatus={loading && !inbox.length ? <p className="p-4 text-sm text-[#655969]" role="status">Loading conversations…</p> : null}
      inboxError={inboxError || undefined}
      onRetryInbox={() => void loadInbox()}
      canLoadMore={Boolean(inboxCursor)}
      loadingMore={inboxBusy}
      onLoadMore={() => {
        if (!inboxCursor) return;
        setInboxBusy(true);
        void loadInbox(inboxCursor).finally(() => setInboxBusy(false));
      }}
        onBack={() => router.push("/messages")}
    >
      {loading && !thread ? <p className="p-5 text-sm text-[#655969]" role="status">Loading conversation…</p> : !thread ? (
        <p className="m-4 border border-[#E8BBCD] bg-[#FFF5F8] p-4 text-sm text-[#8B204B]" role="alert">{error || "Conversation unavailable."} <button className="ml-2 underline" onClick={() => void refresh()} type="button">Retry</button></p>
      ) : <>
        <header className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-white/10 sm:px-6">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">{thread.shop.name}</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Private Shop conversation · Messages are saved before they appear here.</p>
        </header>
        {error ? <p className="m-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{error} <button className="ml-2 underline" onClick={() => void refresh()} type="button">Retry</button></p> : null}
        <ChatHistory
          key={id}
          messages={messages.map((message) => ({
            id: message.id, sequence: message.sequence, body: message.body, mine: message.mine,
            sender: message.mine ? "You" : thread.shop.name, createdAt: message.created_at,
            context: message.context ? message.context.url
              ? <Link className="font-semibold text-[#4C1268] underline dark:text-purple-300" href={message.context.url}>{message.context.label}</Link>
              : <span>{message.context.label}</span>
              : undefined,
          }))}
          olderCursor={Boolean(nextCursor)}
          onLoadOlder={() => void loadOlder()}
          loadingOlder={olderBusy}
          emptyText="Your private conversation with this Shop starts with your first message."
        />
        {thread.send_allowed || uncertain ? <ChatComposer
          id="shop-chat-message"
          recipient="Seller"
          value={body}
          onChange={(value) => { setBody(value); setSendError(""); writeChatDraft(draftKey, value); }}
          onSubmit={() => void submit()}
          sending={busy}
          uncertain={uncertain}
          online={typeof navigator === "undefined" || navigator.onLine}
          sendAllowed={thread.send_allowed}
          error={sendError}
        /> : <p className="border-t border-zinc-200 p-4 text-sm text-amber-800 dark:border-white/10 dark:text-amber-300">This Shop cannot receive new messages right now. Your conversation history remains available.</p>}
      </>}
    </ChatWorkspace>
  );
}
