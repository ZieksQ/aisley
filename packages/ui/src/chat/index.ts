"use client";

export { ChatComposer } from "./composer";
export { ChatHistory } from "./history";
export { ChatInbox, ChatWorkspace } from "./workspace";
export type { ChatEntry, ChatMessageItem } from "./types";
export {
  clearChatPrivateState,
  readChatDraft,
  writeChatDraft,
  readChatAttempt,
  writeChatAttempt,
  useChatDraft,
  useChatAttempt,
  type ChatAttempt,
} from "./private-state";

export { createChatMediaClient } from "./media-client";
export { clearChatAttachments } from "./media-state";
export type { ChatAttachment, ChatMediaClient, ChatMediaContext, ChatMediaOptions } from "./media-types";

export { ChatNotificationControl } from "./notification-control";
export { acknowledgeChatRead, announceChatChange } from "./notification-state";
export type { ChatNotification, ChatNotificationPage } from "./notification-state";

export { ChatAvatar, ChatThreadHeader, ChatEmptyState } from "./presentation";

export { ChatProfileCard, ChatShopAvailability, type ShopAvailability } from "./profile-card";
export { ChatLoadingThread } from "./loading";
export { TicketHistory, ticketStatusLabel } from './ticket-history';
export type { TicketHistoryEvent } from './ticket-history';
export { TicketViewport } from './ticket-workspace';

export { UnifiedChatInbox } from "./unified-inbox";
export { useUnifiedInbox, messageHref, chatRoleLabel } from "./unified-state";
export type { ChatRole } from "./unified-state";
export type { UnifiedChatSummary, UnifiedChatPage, UnifiedChatLoader } from "./use-unified-inbox";
