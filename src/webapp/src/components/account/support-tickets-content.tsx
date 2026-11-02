"use client";

import { createTicketClient, SupportTicketsWorkspace, type TicketTransport, type TicketDraftState } from "@aisley/support-tickets";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest, apiWriteWithCsrfTimeout } from "@/lib/api";

const transport: TicketTransport = <T,>(path: string, options?: RequestInit): Promise<T> =>
  options?.method === "POST" ? apiWriteWithCsrfTimeout<T>(path, options) : apiRequest<T>(path, options);

const client = createTicketClient("customer", transport);

export function SupportTicketsContent() {
  const [draft, setDraft] = useState<TicketDraftState>({ dirty: false, busy: false, uncertain: false });
  const locationSnapshot = useRef<{ url: string; state: unknown } | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");

  useEffect(() => {
    locationSnapshot.current = { url: window.location.href, state: window.history.state };
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!draft.dirty && !draft.busy && !draft.uncertain) return;
    const canLeave = () => !draft.busy && !draft.uncertain && window.confirm("Discard your unsent support draft?");
    const onLink = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href]')) return;
      if (!canLeave()) { event.preventDefault(); event.stopPropagation(); }
    };
    const onBack = (event: PopStateEvent) => {
      if (canLeave()) return;
      event.stopImmediatePropagation();
      const saved = locationSnapshot.current;
      if (saved) window.history.pushState(saved.state, '', saved.url);
    };
    document.addEventListener('click', onLink, true);
    window.addEventListener('popstate', onBack, true);
    return () => { document.removeEventListener('click', onLink, true); window.removeEventListener('popstate', onBack, true); };
  }, [draft]);

  function updateSelectedTicket(id: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (id) next.set("ticket", id);
    else next.delete("ticket");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return <SupportTicketsWorkspace client={client} onDraftChange={setDraft} initialTicketId={ticketId} onSelectedTicketIdChange={updateSelectedTicket} />;
}
