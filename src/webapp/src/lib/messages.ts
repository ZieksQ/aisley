import { apiRequest, apiWriteWithCsrfTimeout, initializeCsrf } from "@/lib/api";

export type ConversationSummary = {
  id: string;
  shop: { id: string; name: string; slug: string | null };
  customer_name: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_sequence: number;
  last_read_sequence: number;
  unread_count: number;
  send_allowed: boolean;
};

export type ConversationMessage = {
  id: string;
  sequence: number;
  body: string;
  mine: boolean;
  sender_role: "customer" | "seller";
  context: { type: "product" | "order"; id: string | null; label: string; url: string | null } | null;
  created_at: string;
};

export type ConversationPage = { items: ConversationSummary[]; next_cursor: string | null; unread_count: number };
export type MessagePage = { items: ConversationMessage[]; next_cursor: string | null };
export type SendResult = { conversation: ConversationSummary; message: ConversationMessage };
export type MessageInput = { body: string; context_type?: "product" | "order"; context_id?: string };

const base = "/api/v1/customer/conversations";

export function listConversations(cursor?: string) {
  return apiRequest<ConversationPage>(`${base}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
}

export function getConversation(id: string) {
  return apiRequest<{ data: ConversationSummary }>(`${base}/${id}`, { cache: "no-store" });
}

export function listMessages(id: string, cursor?: string) {
  return apiRequest<MessagePage>(`${base}/${id}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
}

export async function startConversation(shopId: string, input: MessageInput, key: string) {
  return apiWriteWithCsrfTimeout<SendResult>(base, {
    method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ shop_id: shopId, ...input }),
  });
}

export async function sendMessage(id: string, input: MessageInput, key: string) {
  return apiWriteWithCsrfTimeout<SendResult>(`${base}/${id}/messages`, {
    method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(input),
  });
}

export async function markConversationRead(id: string, sequence: number) {
  await initializeCsrf();
  return apiRequest<{ data: ConversationSummary }>(`${base}/${id}/read`, {
    method: "POST", body: JSON.stringify({ sequence }),
  });
}

export function getConversationUnreadCount() {
  return apiRequest<{ unread_count: number }>(`${base}/unread-count`, { cache: "no-store" });
}
