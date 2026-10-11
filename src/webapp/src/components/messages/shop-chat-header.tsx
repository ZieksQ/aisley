"use client";

import Link from "next/link";
import { ChatProfileCard, ChatShopAvailability, ChatThreadHeader } from "@aisley/ui/chat";
import type { ConversationSummary } from "@/lib/messages";

export function ShopChatHeader({ shop }: { shop: ConversationSummary["shop"] }) {
  const status = <ChatShopAvailability availability={shop.availability} />;
  return <ChatThreadHeader title={shop.name} description={status} avatar={shop.slug ? <ChatProfileCard name={shop.name} description={status} action={<Link className="flex min-h-11 items-center justify-center rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={`/shops/${encodeURIComponent(shop.slug)}`}>View shop</Link>} /> : undefined} />;
}
