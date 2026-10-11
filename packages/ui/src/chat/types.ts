import type { ChatAttachment } from "./media-types";
import type { ReactNode } from "react";

export type ChatEntry = {
  id: string;
  title: string;
  preview: string;
  activity: string | null;
  unread: number;
  href?: string;
  selected?: boolean;
  readOnly?: boolean;
  context?: string;
  onSelect?: () => void;
};

export type ChatMessageItem = {
  id: string;
  sequence: number;
  body: string;
  attachments?: ChatAttachment[];
  mine: boolean;
  sender: string;
  createdAt: string;
  context?: ReactNode;
  status?: "sending" | "sent" | "failed" | "unconfirmed";
};
