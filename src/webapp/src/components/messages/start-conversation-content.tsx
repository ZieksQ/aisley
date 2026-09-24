"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { startConversation, type MessageInput } from "@/lib/messages";

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
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pendingKey = useRef<{ key: string; body: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !shopId) return;
    const attempt = pendingKey.current?.body === text ? pendingKey.current : { key: crypto.randomUUID(), body: text };
    pendingKey.current = attempt;
    const input: MessageInput = { body: text };
    if (productId) { input.context_type = "product"; input.context_id = productId; }
    if (orderId) { input.context_type = "order"; input.context_id = orderId; }
    setBusy(true);
    setError("");
    try {
      const result = await startConversation(shopId, input, attempt.key);
      router.replace(`/messages/${result.conversation.id}`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Your message may not have sent. Retry with the same text; it will not create a duplicate.");
    } finally {
      setBusy(false);
    }
  }

  if (!shopId || (productId && orderId)) return <p className="text-sm text-[#8B204B]" role="alert">This message link is invalid. Return to the Shop, Product, or Order and try again.</p>;

  return (
    <form className="border border-[#DED7E1] bg-white p-5 sm:p-6" onSubmit={(event) => void submit(event)}>
      <h1 className="text-xl font-semibold text-[#302534]">Message Seller</h1>
      <p className="mt-2 text-sm text-[#655969]">Your conversation starts when you send the first message. The Seller can reply in their Aisley inbox.</p>
      <label className="mt-5 block text-sm font-semibold text-[#302534]" htmlFor="first-message">Your message</label>
      <textarea className="mt-2 block min-h-32 w-full border border-[#CFC6D2] p-3 text-sm text-[#302534] focus-visible:outline-2 focus-visible:outline-[#E6007A]" id="first-message" maxLength={2000} onChange={(event) => { setBody(event.target.value); setError(""); if (pendingKey.current?.body !== event.target.value.trim()) pendingKey.current = null; }} required value={body} />
      {error && <p className="mt-3 text-sm text-[#8B204B]" role="alert">{error}</p>}
      <button className="mt-4 min-h-10 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !body.trim()} type="submit">{busy ? "Sending…" : "Send message"}</button>
    </form>
  );
}
