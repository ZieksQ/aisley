"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { announceChatChange, ChatWorkspace, messageHref } from "@aisley/ui/chat";
import { useAuth } from "@/components/auth/auth-provider";
import { CourierThread } from "./courier-thread";

type Props = { conversationId: string | null; orderId: string | null };

export function CourierMessagesContent({ conversationId, orderId }: Props) {
  const { auth } = useAuth();
  const router = useRouter();
  const onStarted = useCallback((id: string) => {
    const filter = new URLSearchParams(window.location.search).get("role") ?? undefined;
    router.replace(messageHref("courier_customer", id, filter));
  }, [router]);

  if (auth.status !== "authenticated") return null;
  return <ChatWorkspace entries={[]} selected>
    <CourierThread
      key={`${auth.customer.id}:${conversationId ?? orderId}`}
      conversationId={conversationId}
      orderId={orderId}
      onUpdated={announceChatChange}
      onStarted={onStarted}
    />
  </ChatWorkspace>;
}
