"use client";

import { createTicketClient, SupportTicketsWorkspace, type TicketTransport } from "@aisley/support-tickets";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, apiWriteWithCsrfTimeout } from "@/lib/api";

const transport: TicketTransport = <T,>(path: string, options?: RequestInit): Promise<T> =>
  options?.method === "POST" ? apiWriteWithCsrfTimeout<T>(path, options) : apiRequest<T>(path, options);

const client = createTicketClient("customer", transport);

export function SupportTicketsContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");

  function updateSelectedTicket(id: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (id) next.set("ticket", id);
    else next.delete("ticket");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return <SupportTicketsWorkspace client={client} initialTicketId={ticketId} onSelectedTicketIdChange={updateSelectedTicket} />;
}
