"use client";

import { chatMedia } from "@/lib/chat-media";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearChatAttachments, ChatComposer, clearChatPrivateState, readChatAttempt, readChatDraft, writeChatAttempt, writeChatDraft } from "@aisley/chat-ui";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { startConversation, type MessageInput } from "@/lib/messages";
import { fetchProductDetail } from "@/lib/marketplace/client";
import { fetchOrder } from "@/lib/orders/client";

export function StartConversationContent({ shopId, productId, orderId }: { shopId: string; productId: string | null; orderId: string | null }) {
  const { auth } = useAuth();
  if (auth.status === "loading") return <p role="status">Checking your account…</p>;
  if (auth.status !== "authenticated") {
    const params = new URLSearchParams({ shop: shopId });
    if (productId) params.set("product", productId);
    if (orderId) params.set("order", orderId);
    const next = `/messages/new?${params.toString()}`;
    return <p>Please <Link className="font-semibold text-[#4C1268] underline" href={`/login?next=${encodeURIComponent(next)}`}>sign in</Link> to message this Seller.</p>;
  }

  return <AuthenticatedStartConversation key={`${auth.customer.id}:${shopId}:${productId}:${orderId}`} orderId={orderId} productId={productId} shopId={shopId} />;
}

function AuthenticatedStartConversation({ shopId, productId, orderId }: { shopId: string; productId: string | null; orderId: string | null }) {
  const router = useRouter();
  const { auth } = useAuth();
  const accountId = auth.status === "authenticated" ? auth.customer.id : "unknown";
  const draftKey = `customer-shop-start:${accountId}:${shopId}:${productId ?? orderId ?? "shop"}`;
  const [body, setBody] = useState(() => readChatDraft(draftKey));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(() => Boolean(readChatAttempt(draftKey)));
  const [context, setContext] = useState<{ type: "product" | "order"; id: string; label: string } | null>(null);
  const [contextUnavailable, setContextUnavailable] = useState(false);
  const [contextRemoved, setContextRemoved] = useState(false);
  const [contextLoading, setContextLoading] = useState(Boolean(productId || orderId));
  const pendingKey = useRef(readChatAttempt(draftKey));

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!productId && !orderId) { setContextLoading(false); return; }
      setContextLoading(true);
      try {
        if (productId) {
          const product = await fetchProductDetail(productId, controller.signal);
          if (product.shop.id !== shopId) throw new Error("This Product is not part of the selected Shop.");
          setContext({ type: "product", id: product.id, label: `Product · ${product.title}` });
        } else if (orderId) {
          const order = await fetchOrder(orderId, controller.signal);
          if (order.shop.id !== shopId) throw new Error("This Order is not associated with the selected Shop.");
          setContext({ type: "order", id: order.id, label: `Order ${order.reference} · ${order.shop.name}` });
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setContextUnavailable(true);
          setError(reason instanceof Error ? `${reason.message} Remove the context to send a Shop message.` : "The linked context is unavailable. Remove it to send a Shop message.");
        }
      } finally { if (!controller.signal.aborted) setContextLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [orderId, productId, shopId]);

  useEffect(() => { writeChatDraft(draftKey, body); }, [body, draftKey]);

  async function submit(attachmentIds: string[] = []) {
    const text = body.trim();
    if ((!text && !attachmentIds.length) || !shopId || contextLoading || busy || ((productId || orderId) && !context && !contextRemoved)) return;
    const contextToken = context ? `${context.type}:${context.id}` : null;
    const attempt = pendingKey.current?.body === text && JSON.stringify(pendingKey.current.attachmentIds ?? []) === JSON.stringify(attachmentIds) && pendingKey.current.context === contextToken
      ? pendingKey.current : { key: crypto.randomUUID(), body: text, context: contextToken, attachmentIds };
    pendingKey.current = attempt;
    writeChatAttempt(draftKey, attempt);
    const input: MessageInput = context ? { body: text, context_type: context.type, context_id: context.id } : { body: text };
    setBusy(true);
    setError("");
    try {
      const result = await startConversation(shopId, { ...input, attachment_ids: attempt.attachmentIds ?? [] }, attempt.key);
      clearChatAttachments(draftKey); writeChatDraft(draftKey, "");
      writeChatAttempt(draftKey, null);
      router.replace(`/messages/${result.conversation.id}`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Your message may not have sent. Retry with the same text; it will not create a duplicate.");
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) {
        clearChatPrivateState(); pendingKey.current = null; setBody(""); setUncertain(false);
      } else if (reason instanceof ApiError && [409, 422, 429].includes(reason.status)) {
        pendingKey.current = null; writeChatAttempt(draftKey, null); setUncertain(false);
      } else setUncertain(true);
    } finally {
      setBusy(false);
    }
  }

  if (!shopId || (productId && orderId)) return <p className="text-sm text-[#8B204B]" role="alert">This message link is invalid. Return to the Shop, Product, or Order and try again.</p>;

  return (
    <section className="border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">
      <header className="border-b border-zinc-200 p-4 dark:border-white/10 sm:p-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Message Seller</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Your conversation starts when you send the first message. The Seller can reply in their inbox.</p>
      </header>
      {context || contextUnavailable ? <div className="flex items-start justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
        <p className="min-w-0 text-sm text-zinc-800 dark:text-zinc-200">{context?.label ?? `${productId ? "Product" : "Order"} unavailable`}</p>
        <button className="min-h-9 shrink-0 px-2 text-sm font-semibold text-[#4C1268] underline focus-visible:outline-2 focus-visible:outline-[#E6007A] dark:text-purple-300" disabled={uncertain || busy} onClick={() => { setContext(null); setContextUnavailable(false); setContextRemoved(true); setError(""); pendingKey.current = null; writeChatAttempt(draftKey, null); setUncertain(false); }} type="button">Remove</button>
      </div> : null}
      {contextLoading ? <p className="px-4 pt-3 text-sm text-zinc-500" role="status">Checking linked {productId ? "Product" : "Order"}…</p> : null}
      {error ? <p className="mx-4 mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      <ChatComposer
        media={{ client: chatMedia, draftKey, context: { channel: "shop", shop_id: shopId, ...(context ? { context_type: context.type, context_id: context.id } : {}) } }}
        id="first-message"
        recipient="Seller"
        value={body}
        onChange={(value) => { setBody(value); setError(""); writeChatDraft(draftKey, value); }}
        onSubmit={(ids) => void submit(ids)}
        sending={busy}
        uncertain={uncertain && !busy}
        sendAllowed={!contextLoading && (!(productId || orderId) || Boolean(context) || contextRemoved)}
        readOnlyReason={contextLoading ? `Checking the linked ${productId ? "Product" : "Order"} before sending.` : undefined}
        online={typeof navigator === "undefined" || navigator.onLine}
        error={undefined}
      />
    </section>
  );
}
