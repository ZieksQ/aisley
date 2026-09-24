import { apiRequest, apiWriteWithCsrfTimeout, initializeCsrf } from "@/lib/api";

const base = "/api/v1/customer/logistics-conversations";

export type DeliveryThread = {
  id: string;
  kind: "customer_logistics";
  order_id: string;
  order_reference: string | null;
  counterparty_label: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_sequence: number;
  last_read_sequence: number;
  unread_count: number;
  send_allowed: boolean;
  read_only_reason: string | null;
};

export type DeliveryMessage = {
  id: string;
  sequence: number;
  body: string;
  mine: boolean;
  sender_role: "customer" | "logistics";
  created_at: string;
};

type Page<T> = { data: T[]; meta: { next_cursor: string | null; unread_count?: number } };
type Write = { conversation: DeliveryThread; message: DeliveryMessage };

export const deliveryMessages = {
  list: (cursor?: string) => apiRequest<Page<DeliveryThread>>(`${base}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" }),
  show: (id: string) => apiRequest<{ data: DeliveryThread }>(`${base}/${id}`, { cache: "no-store" }),
  history: (id: string, cursor?: string) => apiRequest<Page<DeliveryMessage>>(`${base}/${id}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" }),
  async start(orderId: string, body: string, key: string) {
    return apiWriteWithCsrfTimeout<Write>(base, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ context_type: "order", context_id: orderId, body }) });
  },
  async send(id: string, body: string, key: string) {
    return apiWriteWithCsrfTimeout<Write>(`${base}/${id}/messages`, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ body }) });
  },
  async read(id: string, sequence: number) {
    await initializeCsrf();
    return apiRequest<{ data: DeliveryThread }>(`${base}/${id}/read`, { method: "POST", body: JSON.stringify({ last_read_sequence: sequence }) });
  },
};
