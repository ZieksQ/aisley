"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatEmptyState, ChatWorkspace, UnifiedChatInbox, type UnifiedChatPage } from "@aisley/ui/chat";
import { useAuth } from "@/components/auth/auth-provider";
import { apiRequest } from "@/lib/api";
import { MessageThreadContent } from "./message-thread-content";
import { StartConversationContent } from "./start-conversation-content";
import { DeliveryMessagesContent } from "../delivery-messages/delivery-messages-content";
import { CourierMessagesContent } from "../courier-messages/courier-messages-content";

const load = (query: string, signal: AbortSignal) => apiRequest<UnifiedChatPage>(
  `/api/v1/customer/chat-inbox?${query}`, { signal, cache: "no-store" },
);

export function UnifiedMessagesContent() {
  const { auth } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  if (auth.status === "loading") return <p role="status">Checking your account…</p>;
  if (auth.status !== "authenticated") {
    return <p>Please <Link className="font-semibold underline" href={`/login?next=${encodeURIComponent(`/messages?${params}`)}`}>sign in</Link> to see your messages.</p>;
  }
  const kind = params.get("kind");
  const id = params.get("conversation");
  const shop = params.get("shop");
  const order = params.get("order");
  const role = params.get("role") ?? "";
  const filter = ["seller", "logistics", "courier"].includes(role) ? role : "";
  const counterpartRole = shop || kind === "customer_shop" ? "seller"
    : kind === "customer_logistics" ? "logistics"
      : kind === "courier_customer" ? "courier" : undefined;

  function filterRole(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("role", value);
    else next.delete("role");
    router.push(`/messages?${next}`, { scroll: false });
  }

  let thread: ReactNode;
  if (shop) {
    thread = <StartConversationContent shopId={shop} productId={params.get("product")} orderId={order} />;
  } else if (kind === "customer_shop" && id) {
    thread = <MessageThreadContent id={id} />;
  } else if (kind === "customer_logistics" && (id || order)) {
    thread = <DeliveryMessagesContent key={id ?? order} conversationId={id} orderId={order} />;
  } else if (kind === "courier_customer" && (id || order)) {
    thread = <CourierMessagesContent conversationId={id} orderId={order} />;
  } else if (id || order) {
    thread = <ChatWorkspace entries={[]} selected>
      <ChatEmptyState title="Conversation unavailable" description="Open a conversation from your inbox." />
    </ChatWorkspace>;
  }

  return <UnifiedChatInbox
    key={auth.customer.id}
    load={load}
    roles={["seller", "logistics", "courier"]}
    filter={filter}
    onFilter={filterRole}
    navigate={(href) => router.push(href, { scroll: false })}
    conversationId={id}
    counterpartRole={counterpartRole}
  >
    {thread}
  </UnifiedChatInbox>;
}
