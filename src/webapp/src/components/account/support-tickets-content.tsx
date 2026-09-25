"use client";

import { createTicketClient, SupportTicketsWorkspace, type TicketTransport } from "@aisley/support-tickets";
import { apiRequest, apiWriteWithCsrfTimeout } from "@/lib/api";

const transport: TicketTransport = <T,>(path: string, options?: RequestInit): Promise<T> =>
  options?.method === "POST" ? apiWriteWithCsrfTimeout<T>(path, options) : apiRequest<T>(path, options);

const client = createTicketClient("customer", transport);

export function SupportTicketsContent() {
  return <SupportTicketsWorkspace client={client} />;
}
