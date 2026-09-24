"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { getConversation, listMessages, markConversationRead, sendMessage } from "@/lib/messages";
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
  const [thread, setThread] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const pendingKey = useRef<{ key: string; body: string } | null>(null);

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
      if (latest && latest > detail.data.last_read_sequence) {
        const read = await markConversationRead(id, latest);
        setThread(read.data);
      }
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setLoading(false);
    }
  }, [auth.status, id]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => { if (navigator.onLine) void refresh(); };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void refresh();
    }, 12000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [refresh]);

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
      setError(errorText(reason));
    } finally {
      setOlderBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !thread?.send_allowed) return;
    const attempt = pendingKey.current?.body === text ? pendingKey.current : { key: crypto.randomUUID(), body: text };
    pendingKey.current = attempt;
    setBusy(true);
    setSendError("");
    try {
      const result = await sendMessage(id, { body: text }, attempt.key);
      setThread(result.conversation);
      setMessages((current) => current.some((message) => message.id === result.message.id) ? current : [...current, result.message]);
      setBody("");
      pendingKey.current = null;
      await refresh();
    } catch (reason) {
      setSendError(errorText(reason));
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading conversation…</p>;
  if (!thread) return <p className="border border-[#E8BBCD] bg-[#FFF5F8] p-4 text-sm text-[#8B204B]" role="alert">{error || "Conversation unavailable."} <button className="underline" onClick={() => void refresh()} type="button">Retry</button></p>;

  return (
    <div className="border border-[#DED7E1] bg-white">
      <header className="border-b border-[#EAE4EC] px-4 py-4 sm:px-6">
        <h1 className="text-xl font-semibold text-[#302534]">{thread.shop.name}</h1>
        <p className="mt-1 text-xs text-[#746978]">Messages are saved in your Aisley inbox. Replies may take time to appear.</p>
      </header>
      {error && <p className="m-4 border border-[#E8BBCD] bg-[#FFF5F8] p-3 text-sm text-[#8B204B]" role="alert">{error} <button className="underline" onClick={() => void refresh()} type="button">Retry</button></p>}
      {nextCursor && <button className="mx-4 mt-4 min-h-10 text-sm font-semibold text-[#4C1268] underline disabled:opacity-50" disabled={olderBusy} onClick={() => void loadOlder()} type="button">{olderBusy ? "Loading…" : "Load earlier messages"}</button>}
      <ol aria-label="Conversation messages" className="space-y-3 px-4 py-5 sm:px-6">
        {messages.map((message) => (
          <li className={`max-w-[85%] border p-3 text-sm ${message.mine ? "ml-auto border-[#DCC6E3] bg-[#F8F2FA]" : "border-[#E6E0E8] bg-white"}`} key={message.id}>
            <p className="mb-1 text-xs font-semibold text-[#655969]">{message.mine ? "You" : thread.shop.name}</p>
            <p className="whitespace-pre-wrap break-words text-[#302534]">{message.body}</p>
            {message.context && <p className="mt-2 border-t border-[#E6E0E8] pt-2 text-xs text-[#655969]">{message.context.url ? <Link className="font-semibold text-[#4C1268] underline" href={message.context.url}>{message.context.label}</Link> : message.context.label}</p>}
            <time className="mt-2 block text-xs text-[#877A89]" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
          </li>
        ))}
      </ol>
      <form className="border-t border-[#EAE4EC] p-4 sm:p-6" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm font-semibold text-[#302534]" htmlFor="chat-message">Message Seller</label>
        <textarea className="mt-2 block min-h-24 w-full border border-[#CFC6D2] p-3 text-sm text-[#302534] focus-visible:outline-2 focus-visible:outline-[#E6007A] disabled:bg-[#F5F2F6]" disabled={!thread.send_allowed || busy} id="chat-message" maxLength={2000} onChange={(event) => { setBody(event.target.value); setSendError(""); if (pendingKey.current?.body !== event.target.value.trim()) pendingKey.current = null; }} value={body} />
        {!thread.send_allowed && <p className="mt-2 text-sm text-[#8B204B]">This Shop cannot receive new messages right now. Your conversation history remains available.</p>}
        {sendError && <p className="mt-2 text-sm text-[#8B204B]" role="alert">{sendError}</p>}
        <button className="mt-3 min-h-10 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!thread.send_allowed || busy || !body.trim()} type="submit">{busy ? "Sending…" : "Send message"}</button>
      </form>
    </div>
  );
}
