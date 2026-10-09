export type ChatAttachment = {
  id: string;
  kind: "image" | "video" | "document";
  filename: string;
  mime_type: string;
  byte_size: number;
  state: "pending" | "ready" | "rejected" | "failed" | "deleted";
  error_code: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  content_url: string | null;
  preview_url: string | null;
};

export type ChatMediaContext = {
  conversation_id?: string;
  channel?: "shop" | "logistics" | "courier" | "operational";
  shop_id?: string;
  context_type?: "product" | "order" | "pickup_request";
  context_id?: string;
  leg?: "first_mile" | "final_mile";
  task_id?: string;
  counterparty_role?: "logistics" | "seller" | "customer";
};

export type ChatMediaClient = {
  capabilities: (signal: AbortSignal) => Promise<boolean>;
  upload: (file: File, context: ChatMediaContext, key: string, progress: (value: number) => void, signal: AbortSignal) => Promise<ChatAttachment>;
  status: (id: string, signal: AbortSignal) => Promise<ChatAttachment>;
  retry: (id: string, signal: AbortSignal) => Promise<ChatAttachment>;
  remove: (id: string) => Promise<void>;
  url: (path: string) => string;
};

export type ChatMediaOptions = {
  client: ChatMediaClient;
  context: ChatMediaContext;
  draftKey: string;
};

export type ChatAttachmentDraft = {
  key: string;
  file: File;
  preview: string | null;
  context: ChatMediaContext;
  progress: number;
  asset: ChatAttachment | null;
  error: string | null;
  busy: boolean;
};

export const chatMediaAccept = ".jpg,.jpeg,.png,.webp,.mp4,.pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,.txt,.csv";
export const chatMediaHelp = "Up to 5 files, 50 MiB total. JPG/PNG/WebP under 10 MiB; MP4 up to 30 MiB and 3 minutes; documents up to 10 MiB.";
