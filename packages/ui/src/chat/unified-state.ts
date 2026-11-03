"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ChatEntry } from "./types";

export type ChatRole = "customer" | "seller" | "logistics" | "courier" | "admin";
export const chatRoleLabel = (role: ChatRole) => role === "admin" ? "Platform (Admin)" : role.charAt(0).toUpperCase() + role.slice(1);

export type UnifiedInboxState = {
  entries: ChatEntry[];
  inboxTitle: string;
  inboxStatus?: ReactNode;
  inboxError?: ReactNode;
  inboxToolbar?: ReactNode;
  onRetryInbox: () => void;
  onLoadMore: () => void;
  canLoadMore: boolean;
  loadingMore: boolean;
  onBack: () => void;
  scrollPosition: { current: number };
  counterpartRole?: ChatRole;
  refresh: () => void;
  openConversation: (kind: string, id: string) => void;
};
export const UnifiedInboxContext = createContext<UnifiedInboxState | null>(null);
export const useUnifiedInbox = () => useContext(UnifiedInboxContext);

export function messageHref(kind: string, id: string, filter?: string) {
  const query = new URLSearchParams({ kind, conversation: id });
  if (filter) query.set("role", filter);
  return `/messages?${query}`;
}
