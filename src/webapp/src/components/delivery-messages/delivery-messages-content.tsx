"use client";

import { chatMedia } from "@/lib/chat-media";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearChatAttachments, ChatComposer, ChatHistory, ChatWorkspace, clearChatPrivateState, readChatAttempt, readChatDraft, writeChatAttempt, writeChatDraft, useChatAttempt, useChatDraft, type ChatEntry } from "@aisley/chat-ui";
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
  const { auth } = useAuth();
  const router = useRouter();
  const accountId = auth.status === "authenticated" ? auth.customer.id : "unknown";
  const [threads, setThreads] = useState<DeliveryThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(conversationId);
  const selected = threads.find((thread) => thread.id === selectedId) ?? null;
  const startingOrder = selected ? null : orderId;
  const draftKey = `customer-logistics:${accountId}:${selectedId ?? startingOrder ?? 'inbox'}`;
  const [draft, setDraft] = useChatDraft(draftKey);
  const [pending, setPending] = useChatAttempt(draftKey);
  const [messages, setMessages] = useState<DeliveryMessage[]>([]);
  const [nextThreadCursor, setNextThreadCursor] = useState<string | null>(null);
  const [nextMessageCursor, setNextMessageCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeDraftKey = useRef(draftKey);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const page = await deliveryMessages.list();
      setThreads((current) => [...page.data, ...current.filter((item) => !page.data.some((fresh) => fresh.id === item.id))]);
      setNextThreadCursor(page.meta.next_cursor);
      if (activeDraftKey.current === draftKey && !conversationId && orderId) {
        const match = page.data.find((thread) => thread.order_id === orderId && thread.send_allowed);
        if (match && !readChatAttempt(draftKey)) {
          const startKey = `customer-logistics:${accountId}:${orderId}`;
          const threadKey = `customer-logistics:${accountId}:${match.id}`;
          if (readChatDraft(startKey) && !readChatDraft(threadKey)) writeChatDraft(threadKey, readChatDraft(startKey));
          activeDraftKey.current = threadKey;
          setLoading(true);
          setSelectedId(match.id);
        }
      }
      setError("");
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
        clearChatPrivateState();
        setThreads([]);
        setMessages([]);
        setSelectedId(null);
      }
      setError(errorText(reason));
    } finally {
      setLoading(false);
    }
  }, [accountId, conversationId, draftKey, orderId]);

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
        if (!document.hidden && latest && latest > detail.data.last_read_sequence) {
          const read = await deliveryMessages.read(selectedId, latest);
          if (!cancelled) setThreads((current) => current.map((thread) => thread.id === selectedId ? read.data : thread));
        }
      } catch (reason) {
        if (!cancelled) {
          if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
            clearChatPrivateState(); setThreads([]); setMessages([]);
          }
          setError(errorText(reason));
        }
      }
      finally { if (!cancelled) setLoading(false); }
    };
    const initial = window.setTimeout(() => { setLoading(true); void load(); }, 0);
    const poll = () => { if (document.visibilityState === "visible" && navigator.onLine) void load(); };
    const timer = window.setInterval(poll, 15000);
    window.addEventListener("focus", poll);
    window.addEventListener("online", poll);
    return () => { cancelled = true; window.clearTimeout(initial); window.clearInterval(timer); window.removeEventListener("focus", poll); window.removeEventListener("online", poll); };
  }, [selectedId]);

  async function loadOlderThreads() {
    if (!nextThreadCursor) return;
    try {
      const page = await deliveryMessages.list(nextThreadCursor);
      setThreads((current) => [...current, ...page.data.filter((thread) => !current.some((item) => item.id === thread.id))]);
      setNextThreadCursor(page.meta.next_cursor);
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) { clearChatPrivateState(); setThreads([]); setMessages([]); }
      setError(errorText(reason));
    }
  }

  async function loadOlderMessages() {
    if (!selectedId || !nextMessageCursor) return;
    try {
      const page = await deliveryMessages.history(selectedId, nextMessageCursor);
      setMessages((current) => mergeMessages(current, page.data));
      setNextMessageCursor(page.meta.next_cursor);
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) { clearChatPrivateState(); setThreads([]); setMessages([]); }
      setError(errorText(reason));
    }
  }

  async function send(attachmentIds: string[] = []) {
    if (busy || !navigator.onLine) { setError("Reconnect before sending a message."); return; }
    const body = pending?.body ?? draft.trim();
    if ((!body && !attachmentIds.length) || body.length > 2000 || (!selectedId && !startingOrder)) return;
    const contextToken = selectedId ? null : `order:${startingOrder}`;
    const savedAttempt = readChatAttempt(draftKey);
    const attempt = savedAttempt?.body === body && JSON.stringify(savedAttempt.attachmentIds ?? []) === JSON.stringify(attachmentIds) && savedAttempt.context === contextToken
      ? savedAttempt : { key: crypto.randomUUID(), body, context: contextToken, attachmentIds };
    setPending(attempt);
    const targetDraftKey = draftKey;
    const targetConversationId = selectedId;
    const targetOrderId = startingOrder;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = targetConversationId
        ? await deliveryMessages.send(targetConversationId, attempt.body, attempt.key, attempt.attachmentIds ?? [])
        : await deliveryMessages.start(targetOrderId!, attempt.body, attempt.key, attempt.attachmentIds ?? []);
      clearChatAttachments(targetDraftKey); writeChatDraft(targetDraftKey, "");
      writeChatAttempt(targetDraftKey, null);
      if (activeDraftKey.current !== targetDraftKey) { void refresh(); return; }
      setMessages((current) => mergeMessages(current, [result.message]));
      setThreads((current) => [result.conversation, ...current.filter((thread) => thread.id !== result.conversation.id)]);
      activeDraftKey.current = `customer-logistics:${accountId}:${result.conversation.id}`;
      setSelectedId(result.conversation.id);
      setNotice("Message saved.");
      router.replace(`/delivery-messages?conversation=${encodeURIComponent(result.conversation.id)}`);
    } catch (reason) {
      if (activeDraftKey.current !== targetDraftKey) return;
      setError(errorText(reason));
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearChatPrivateState();
      } else if (reason instanceof ApiError && [409, 422, 429].includes(reason.status)) {
        writeChatAttempt(targetDraftKey, null);
        if (reason.status === 409) void refresh();
      }
    }
    finally { setBusy(false); }
  }

  const entries: ChatEntry[] = threads.map((thread) => ({
    id: thread.id, title: thread.counterparty_label, preview: thread.last_message_preview ?? '',
    activity: thread.last_message_at, unread: thread.unread_count,
    context: `Order ${thread.order_reference ?? thread.order_id.slice(0, 8)}`,
    selected: selectedId === thread.id, readOnly: Boolean(thread.read_only_reason),
    onSelect: () => { activeDraftKey.current = `customer-logistics:${accountId}:${thread.id}`; setBusy(false); setLoading(true); setSelectedId(thread.id); setMessages([]); setNotice(""); setError(""); router.replace(`/delivery-messages?conversation=${encodeURIComponent(thread.id)}`); },
  }));

  return <ChatWorkspace
    entries={entries}
    selected={Boolean(selected || startingOrder || selectedId)}
    inboxTitle="Delivery conversations"
    inboxStatus={loading && !threads.length ? <p className="p-4 text-sm text-[#655969]" role="status">Loading conversations…</p> : null}
    inboxError={error && !selected && !startingOrder ? error : undefined}
    onRetryInbox={() => void refresh()}
    canLoadMore={Boolean(nextThreadCursor)}
    onLoadMore={() => void loadOlderThreads()}
    onBack={() => { activeDraftKey.current = `customer-logistics:${accountId}:${orderId ?? 'inbox'}`; setBusy(false); setSelectedId(null); setMessages([]); setError(""); router.replace('/delivery-messages'); }}
  >
    {selected || startingOrder || selectedId ? <>
      <header className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-white/10 sm:px-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{selected?.counterparty_label ?? (startingOrder ? 'Contact Logistics' : loading ? 'Loading conversation…' : 'Delivery conversation')}</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{selected ? `Order ${selected.order_reference ?? selected.order_id.slice(0, 8)}` : startingOrder ? `Order ${startingOrder.slice(0, 8)}` : 'Delivery coordination'}</p>
      </header>
      {error ? <p className="m-3 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}
      <ChatHistory
          mediaClient={chatMedia}
        key={selectedId ?? startingOrder ?? 'delivery-inbox'}
        messages={messages.map((message) => ({ id: message.id, sequence: message.sequence, body: message.body, mine: message.mine, sender: message.mine ? 'You' : selected?.counterparty_label ?? 'Logistics', attachments: message.attachments, createdAt: message.created_at }))}
        olderCursor={Boolean(nextMessageCursor)} onLoadOlder={() => void loadOlderMessages()} loading={loading}
        emptyText={startingOrder ? 'Your first message creates a private Order conversation.' : 'No messages to show.'}
      />
      {selected || startingOrder ? <ChatComposer
        media={{ client: chatMedia, draftKey, context: { ...(selectedId ? { conversation_id: selectedId } : { channel: "logistics", context_type: "order", context_id: startingOrder ?? undefined }) } }}
        id="delivery-message" recipient="Logistics"
        value={draft}
        onChange={(value) => { setDraft(value); setError(""); setNotice(""); }}
        onSubmit={(ids) => void send(ids)}
        sendAllowed={selected?.send_allowed ?? true}
        readOnlyReason={selected?.read_only_reason ? 'The delivery relationship ended. This history is read only.' : null}
        online={typeof navigator === 'undefined' || navigator.onLine}
        sending={busy} uncertain={Boolean(pending) && !busy} error={error || undefined}
        success={notice ? 'Message saved.' : undefined}
      /> : <p className="p-4 text-sm text-zinc-500" role="status">{loading ? 'Loading messages…' : error || 'This conversation is unavailable.'}</p>}
    </> : <div className="grid min-h-full place-items-center p-8 text-center text-sm text-[#655969]">Select an Order conversation or open an eligible Order to contact Logistics.</div>}
  </ChatWorkspace>;
}
