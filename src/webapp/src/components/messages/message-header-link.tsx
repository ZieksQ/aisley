"use client";

import Link from "next/link";
import { FiMessageCircle } from "react-icons/fi";
import { ChatNotificationControl, type ChatNotificationPage } from "@aisley/chat-ui";
import { useAuth } from "@/components/auth/auth-provider";
import { apiRequest } from "@/lib/api";

const load = (signal: AbortSignal) => apiRequest<ChatNotificationPage>("/api/v1/customer/chat-notifications", { signal, cache: "no-store" });
const triggerClassName = "flex min-h-11 min-w-11 items-center justify-center rounded-md px-1.5 py-1 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const inboxes = [
  { label: "Shop inbox", href: "/messages" },
  { label: "Logistics inbox", href: "/delivery-messages" },
  { label: "Courier inbox", href: "/courier-messages" },
];

export function MessageHeaderLink() {
  const { auth } = useAuth();
  if (auth.status !== "authenticated") return <Link aria-label="Chat messages" className={triggerClassName} href="/login?next=%2Fmessages"><FiMessageCircle aria-hidden="true" className="size-5" /></Link>;
  return <ChatNotificationControl
    theme="light"
    key={auth.customer.id}
    load={load}
    icon={<FiMessageCircle aria-hidden="true" className="size-5" />}
    triggerClassName={triggerClassName}
    inboxes={inboxes}
    destination={(item) => item.kind === "customer_shop" ? `/messages/${item.id}` : `${item.kind === "customer_logistics" ? "/delivery-messages" : "/courier-messages"}?conversation=${encodeURIComponent(item.id)}`}
    channelLabel={(item) => item.kind === "customer_shop" ? "Shop" : item.kind === "customer_logistics" ? "Logistics · Order" : "Courier · Delivery"}
    renderLink={(href, children, className, onClick) => <Link href={href} prefetch={false} className={className} onClick={onClick}>{children}</Link>}
  />;
}
