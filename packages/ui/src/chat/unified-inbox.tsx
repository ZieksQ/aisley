"use client";

import { useRef, type ReactNode } from "react";
import { ChatWorkspace } from "./workspace";
import { ChatEmptyState } from "./presentation";
import { useUnifiedChatInbox, type UnifiedChatLoader } from "./use-unified-inbox";
import { chatRoleLabel, messageHref, UnifiedInboxContext, type ChatRole } from "./unified-state";

export function UnifiedChatInbox({ load, roles, filter, onFilter, navigate, conversationId, counterpartRole, children }: {
  load: UnifiedChatLoader;
  roles: ChatRole[];
  filter: string;
  onFilter: (role: string) => void;
  navigate: (href: string) => void;
  conversationId: string | null;
  counterpartRole?: ChatRole;
  children?: ReactNode;
}) {
  const inbox = useUnifiedChatInbox(load, filter);
  const scrollPosition = useRef(0);
  const entries = inbox.items.map((item) => ({
    id: item.id, title: item.counterparty_label, role: item.counterparty_role,
    preview: item.last_message_preview ?? "", activity: item.last_message_at,
    unread: item.unread_count, context: item.context_label ?? undefined,
    readOnly: !item.send_allowed, selected: item.id === conversationId,
    onSelect: () => navigate(messageHref(item.kind, item.id, filter)),
  }));
  const value = {
    entries, inboxTitle: `Inbox · ${inbox.unread} unread`,
    inboxStatus: inbox.loading && !entries.length ? <p className="p-4 text-sm" role="status">Loading conversations…</p> : undefined,
    inboxError: inbox.error || undefined,
    inboxToolbar: <div className="flex w-full items-center gap-2 text-sm">
      <label htmlFor="chat-role-filter">Role</label>
      <select id="chat-role-filter" aria-label="Filter conversations by role" className="min-h-11 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 focus-visible:outline-2 dark:border-white/20 dark:bg-slate-800 dark:text-zinc-100" value={filter} onChange={(event) => { scrollPosition.current = 0; onFilter(event.target.value); }}>
        <option value="">All</option>
        {roles.map((role) => <option key={role} value={role}>{chatRoleLabel(role)}</option>)}
      </select>
      <button className="min-h-11 px-2 text-sm font-semibold underline" onClick={inbox.refresh} type="button">Refresh</button>
    </div>,
    onRetryInbox: inbox.refresh, onLoadMore: inbox.loadMore,
    canLoadMore: Boolean(inbox.cursor), loadingMore: inbox.loading,
    onBack: () => navigate(filter ? `/messages?role=${encodeURIComponent(filter)}` : "/messages"),
    scrollPosition, counterpartRole, refresh: inbox.refresh,
    openConversation: (kind: string, id: string) => { inbox.refresh(); navigate(messageHref(kind, id, filter)); },
  };
  return <UnifiedInboxContext.Provider value={value}>
    {!inbox.denied && children ? children : <ChatWorkspace entries={[]} selected={false}>
      <ChatEmptyState title="Messages" description={inbox.denied ? "Refresh to check your chat access." : "Select a conversation to read and reply."} />
    </ChatWorkspace>}
  </UnifiedInboxContext.Provider>;
}
