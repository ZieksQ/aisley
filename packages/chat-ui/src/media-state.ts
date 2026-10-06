import { useSyncExternalStore } from "react";
import type { ChatAttachmentDraft, ChatMediaClient, ChatMediaContext } from "./media-types";

const drafts = new Map<string, ChatAttachmentDraft[]>();
const listeners = new Map<string, Set<() => void>>();
const operations = new Map<string, AbortController>();
const empty: ChatAttachmentDraft[] = [];
let revision = 0;

function notify(key: string) { listeners.get(key)?.forEach((listener) => listener()); }
function update(key: string, id: string, patch: Partial<ChatAttachmentDraft>) {
  const rows = drafts.get(key);
  if (!rows?.some((row) => row.key === id)) return;
  drafts.set(key, rows.map((row) => row.key === id ? { ...row, ...patch } : row));
  notify(key);
}

export function clearChatAttachments(key: string) {
  drafts.get(key)?.forEach((row) => {
    operations.get(row.key)?.abort();
    operations.delete(row.key);
    if (row.preview) URL.revokeObjectURL(row.preview);
  });
  drafts.delete(key);
  notify(key);
}

export function clearChatMediaPrivateState() {
  revision++;
  [...drafts.keys()].forEach(clearChatAttachments);
}

export function useChatAttachments(key: string) {
  return useSyncExternalStore((listener) => {
    const set = listeners.get(key) ?? new Set();
    set.add(listener);
    listeners.set(key, set);
    return () => { set.delete(listener); if (!set.size) listeners.delete(key); };
  }, () => drafts.get(key) ?? empty, () => empty);
}

export function addChatFiles(key: string, files: File[], context: ChatMediaContext): string | null {
  const current = drafts.get(key) ?? empty;
  if (current.length + files.length > 5) return "Select at most five attachments.";
  if (current.reduce((sum, row) => sum + row.file.size, 0) + files.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) {
    return "Attachments may total at most 50 MiB.";
  }
  for (const file of files) {
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    const image = ["jpg", "jpeg", "png", "webp"].includes(extension ?? "");
    const video = extension === "mp4";
    if (!file.size || file.size > (video ? 30 : 10) * 1024 * 1024 || (image && file.size >= 10 * 1024 * 1024)) {
      return `${file.name} exceeds its size limit or is empty.`;
    }
    if (file.name.split(".").length !== 2 || !["jpg", "jpeg", "png", "webp", "mp4", "pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "txt", "csv"].includes(extension ?? "")) {
      return `${file.name} uses an unsupported filename or format.`;
    }
  }
  drafts.set(key, [...current, ...files.map((file) => ({
    key: crypto.randomUUID(), file, context: { ...context },
    preview: /\.(jpe?g|png|webp)$/i.test(file.name) ? URL.createObjectURL(file) : null,
    progress: 0, asset: null, error: null, busy: false,
  }))]);
  notify(key);
  return null;
}

export async function processChatFile(key: string, id: string, client: ChatMediaClient) {
  const row = drafts.get(key)?.find((item) => item.key === id);
  if (!row || operations.has(id)) return;
  const controller = new AbortController();
  const generation = revision;
  operations.set(id, controller);
  update(key, id, { busy: true, error: null });
  const signal = controller.signal;
  try {
    let asset = row.asset;
    if (!asset) asset = await client.upload(row.file, row.context, row.key, (progress) => update(key, id, { progress }), signal);
    else if (asset.state === "failed") asset = await client.retry(asset.id, signal);
    update(key, id, { asset, progress: 100 });
    while (asset.state === "pending" && !signal.aborted) {
      await new Promise<void>((resolve, reject) => {
        const cancelled = () => { clearTimeout(timer); reject(new Error("Checking cancelled.")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", cancelled); resolve(); }, 3000);
        signal.addEventListener("abort", cancelled, { once: true });
      });
      if (typeof document !== "undefined" && (document.hidden || !navigator.onLine)) continue;
      asset = await client.status(asset.id, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
      update(key, id, { asset });
    }
    if (asset.state !== "ready") throw new Error(asset.state === "rejected" ? "This file could not be accepted. Remove it and choose another file." : "File checking failed. Retry when the service is available.");
  } catch (reason) {
    if (generation === revision && !signal.aborted) update(key, id, { error: reason instanceof Error ? reason.message : "Unable to check this file." });
  } finally {
    if (operations.get(id) === controller) operations.delete(id);
    if (generation === revision && !signal.aborted) update(key, id, { busy: false });
  }
}

export function removeChatFile(key: string, id: string, client: ChatMediaClient) {
  const row = drafts.get(key)?.find((item) => item.key === id);
  if (!row) return;
  operations.get(id)?.abort();
  operations.delete(id);
  if (row.preview) URL.revokeObjectURL(row.preview);
  drafts.set(key, (drafts.get(key) ?? empty).filter((item) => item.key !== id));
  notify(key);
  if (row.asset) void client.remove(row.asset.id).catch(() => undefined);
}
