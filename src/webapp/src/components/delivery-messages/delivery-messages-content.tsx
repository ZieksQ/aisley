"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { deliveryMessages, type DeliveryMessage, type DeliveryThread } from "@/lib/delivery-messages";

function errorText(reason: unknown) {
  if (!navigator.onLine) return "You are offline. Reconnect before sending or refreshing.";
  if (reason instanceof ApiError) {
    if (reason.status === 404) return "This Order or conversation is unavailable to your account, or no Logistics team is handling it yet.";
    if (reason.status === 409) return "This delivery relationship ended or the message changed. Refresh before trying again.";
    if (reason.status === 429) return "Too many messages. Wait a moment before retrying.";
    return reason.message;
  }
  return "The request may not have completed. You can retry the same message safely.";
}

function mergeMessages(current: DeliveryMessage[], incoming: DeliveryMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

export function DeliveryMessagesContent({ orderId, conversationId }: { orderId: string | null; conversationId: string | null }) {
  const { auth } = useAuth();
  if (auth.status === "loading") return <p role="status">Checking your account…</p>;
  if (auth.status !== "authenticated") {
    const query = orderId ? `?order=${encodeURIComponent(orderId)}` : conversationId ? `?conversation=${encodeURIComponent(conversationId)}` : "";
    return <p>Please <Link className="font-semibold text-[#4C1268] underline" href={`/login?next=${encodeURIComponent(`/delivery-messages${query}`)}`}>sign in</Link> to see delivery messages.</p>;
  }

  return <AuthenticatedDeliveryMessages key={`${auth.customer.id}:${orderId}:${conversationId}`} orderId={orderId} conversationId={conversationId} />;
}

function AuthenticatedDeliveryMessages({ orderId, conversationId }: { orderId: string | null; conversationId: string | null }) {
  const router = useRouter();
  const [threads, setThreads] = useState<DeliveryThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(conversationId);
  const [messages, setMessages] = useState<DeliveryMessage[]>([]);
  const [nextThreadCursor, setNextThreadCursor] = useState<string | null>(null);
  const [nextMessageCursor, setNextMessageCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef<{ key: string; body: string } | null>(null);
  const selected = threads.find((thread) => thread.id === selectedId) ?? null;
  const startingOrder = selected ? null : orderId;

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const page = await deliveryMessages.list();
      setThreads((current) => [...page.data, ...current.filter((item) => !page.data.some((fresh) => fresh.id === item.id))]);
      setNextThreadCursor(page.meta.next_cursor);
      if (!conversationId && orderId) {
        const match = page.data.find((thread) => thread.order_id === orderId && thread.send_allowed);
        if (match) setSelectedId(match.id);
      }
      setError("");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setLoading(false);
    }
  }, [conversationId, orderId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const poll = () => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); };
    const timer = window.setInterval(poll, 15000);
    window.addEventListener("focus", poll);
    window.addEventListener("online", poll);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener("focus", poll); window.removeEventListener("online", poll); };
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [detail, history] = await Promise.all([deliveryMessages.show(selectedId), deliveryMessages.history(selectedId)]);
        if (cancelled) return;
        setThreads((current) => [detail.data, ...current.filter((thread) => thread.id !== selectedId)]);
        setMessages((current) => mergeMessages(current, history.data));
        setNextMessageCursor(history.meta.next_cursor);
        const latest = history.data.at(-1)?.sequence;
        if (latest && latest > detail.data.last_read_sequence) {
          const read = await deliveryMessages.read(selectedId, latest);
          if (!cancelled) setThreads((current) => current.map((thread) => thread.id === selectedId ? read.data : thread));
        }
      } catch (reason) { if (!cancelled) setError(errorText(reason)); }
    };
    void load();
    const poll = () => { if (document.visibilityState === "visible" && navigator.onLine) void load(); };
    const timer = window.setInterval(poll, 15000);
    window.addEventListener("focus", poll);
    window.addEventListener("online", poll);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", poll); window.removeEventListener("online", poll); };
  }, [selectedId]);

  async function loadOlderThreads() {
    if (!nextThreadCursor) return;
    try {
      const page = await deliveryMessages.list(nextThreadCursor);
      setThreads((current) => [...current, ...page.data.filter((thread) => !current.some((item) => item.id === thread.id))]);
      setNextThreadCursor(page.meta.next_cursor);
    } catch (reason) { setError(errorText(reason)); }
  }

  async function loadOlderMessages() {
    if (!selectedId || !nextMessageCursor) return;
    try {
      const page = await deliveryMessages.history(selectedId, nextMessageCursor);
      setMessages((current) => mergeMessages(current, page.data));
      setNextMessageCursor(page.meta.next_cursor);
    } catch (reason) { setError(errorText(reason)); }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !navigator.onLine) { setError("Reconnect before sending a message."); return; }
    const body = draft.trim();
    if (!body || body.length > 2000 || (!selectedId && !startingOrder)) return;
    const attempt = pending.current?.body === body ? pending.current : { key: crypto.randomUUID(), body };
    pending.current = attempt;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = selectedId
        ? await deliveryMessages.send(selectedId, attempt.body, attempt.key)
        : await deliveryMessages.start(startingOrder!, attempt.body, attempt.key);
      pending.current = null;
      setDraft("");
      setMessages((current) => mergeMessages(current, [result.message]));
      setThreads((current) => [result.conversation, ...current.filter((thread) => thread.id !== result.conversation.id)]);
      setSelectedId(result.conversation.id);
      setNotice("Message saved.");
      router.replace(`/delivery-messages?conversation=${encodeURIComponent(result.conversation.id)}`);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  return <div className="grid border border-[#DED7E1] bg-white md:grid-cols-[16rem_minmax(0,1fr)]">
    <aside aria-label="Delivery inbox" className="border-b border-[#EAE4EC] md:border-b-0 md:border-r">
      <div className="border-b border-[#EAE4EC] px-4 py-3 text-sm font-semibold text-[#302534]">Delivery inbox</div>
      {loading && <p className="p-4 text-sm text-[#655969]" role="status">Loading conversations…</p>}
      {!loading && !threads.length && <p className="p-4 text-sm text-[#655969]">No delivery conversations yet. Open an active Order to contact its Logistics team.</p>}
      <ul className="divide-y divide-[#EAE4EC]">{threads.map((thread) => <li key={thread.id}>
        <button aria-current={selectedId === thread.id ? "true" : undefined} className="w-full p-4 text-left hover:bg-[#FAF7FB] focus-visible:outline-2 focus-visible:outline-[#E6007A]" onClick={() => { setSelectedId(thread.id); setMessages([]); setNotice(""); router.replace(`/delivery-messages?conversation=${encodeURIComponent(thread.id)}`); }} type="button">
          <span className="block text-sm font-semibold text-[#302534]">{thread.counterparty_label}</span>
          <span className="mt-1 block text-xs text-[#655969]">Order {thread.order_reference ?? thread.order_id.slice(0, 8)}{thread.unread_count ? ` · ${thread.unread_count} unread` : ""}</span>
          <span className="mt-1 block truncate text-xs text-[#655969]">{thread.last_message_preview}</span>
        </button>
      </li>)}</ul>
      {nextThreadCursor && <button className="w-full border-t border-[#EAE4EC] p-3 text-sm font-semibold text-[#4C1268]" onClick={() => void loadOlderThreads()} type="button">Load older conversations</button>}
    </aside>
    <section aria-label="Delivery conversation" className="flex min-h-80 flex-col">
      <header className="border-b border-[#EAE4EC] px-4 py-4">
        <h2 className="font-semibold text-[#302534]">{selected?.counterparty_label ?? (startingOrder ? "Contact Logistics" : "Choose a conversation")}</h2>
        <p className="mt-1 text-xs text-[#655969]">{selected ? `Order ${selected.order_reference ?? selected.order_id.slice(0, 8)}` : startingOrder ? `Order ${startingOrder.slice(0, 8)}` : "Delivery conversations are separate from Shop messages."}</p>
        {selected?.read_only_reason && <p className="mt-2 text-xs text-[#8B204B]">The delivery relationship ended. This history is read-only.</p>}
      </header>
      <div aria-live="polite" className="flex-1 space-y-3 p-4">
        {nextMessageCursor && <button className="text-sm font-semibold text-[#4C1268] underline" onClick={() => void loadOlderMessages()} type="button">Load earlier messages</button>}
        {!messages.length && <p className="text-sm text-[#655969]">{startingOrder ? "Your first message creates a private Order conversation." : "No messages to show."}</p>}
        {messages.map((message) => <article className={`max-w-[85%] border p-3 text-sm ${message.mine ? "ml-auto border-[#DCC6E3] bg-[#F8F2FA]" : "border-[#E6E0E8]"}`} key={message.id}>
          <p className="mb-1 text-xs font-semibold text-[#655969]">{message.mine ? "You" : selected?.counterparty_label ?? "Logistics"}</p>
          <p className="whitespace-pre-wrap break-words text-[#302534]">{message.body}</p>
          <time className="mt-2 block text-xs text-[#877A89]" dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>
        </article>)}
      </div>
      {(selected || startingOrder) && <form className="border-t border-[#EAE4EC] p-4" onSubmit={(event) => void send(event)}>
        {error && <p className="mb-2 text-sm text-[#8B204B]" role="alert">{error}</p>}
        {notice && <p className="mb-2 text-sm text-[#20734A]" role="status">{notice}</p>}
        <label className="block text-sm font-semibold text-[#302534]" htmlFor="delivery-message">Message Logistics</label>
        <textarea className="mt-2 min-h-24 w-full border border-[#CFC6D2] p-3 text-sm focus-visible:outline-2 focus-visible:outline-[#E6007A]" disabled={busy || selected?.send_allowed === false} id="delivery-message" maxLength={2000} onChange={(event) => setDraft(event.target.value)} value={draft} />
        <button className="mt-3 min-h-10 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !draft.trim() || selected?.send_allowed === false} type="submit">{busy ? "Sending…" : "Send message"}</button>
      </form>}
      {error && !selected && !startingOrder && <p className="p-4 text-sm text-[#8B204B]" role="alert">{error}</p>}
    </section>
  </div>;
}
