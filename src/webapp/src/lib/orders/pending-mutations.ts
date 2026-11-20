import { sessionRevision } from "@/lib/auth/session-events";

export type PendingOrderDecision = { kind: "cancel" | "extend"; key: string; reason: string };
let revision = -1;
const requests = new Map<string, PendingOrderDecision>();

export function clearOrderDecisions() {
  requests.clear();
  revision = sessionRevision();
}

export function pendingOrderDecision(orderId: string) {
  if (revision !== sessionRevision()) clearOrderDecisions();
  return requests.get(orderId) ?? null;
}

export function saveOrderDecision(orderId: string, request: PendingOrderDecision | null) {
  if (revision !== sessionRevision()) clearOrderDecisions();
  if (request) requests.set(orderId, request);
  else requests.delete(orderId);
}
