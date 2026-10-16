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

export const chatMediaAccept = ".jpg,.jpeg,.png,.mp4";
export const chatMediaHelp = "Up to 5 files. JPG/JPEG, PNG and MP4 only, up to 8 MB (8,000,000 bytes) each. Images: up to 4096 pixels per edge and 8 megapixels. MP4: H.264 video with optional AAC audio, up to 3 minutes.";
