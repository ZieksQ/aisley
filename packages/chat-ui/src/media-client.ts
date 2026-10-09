import { clearChatPrivateState } from "./private-state";
import type { ChatAttachment, ChatMediaClient } from "./media-types";

export function createChatMediaClient({ origin, role, request, csrf }: {
  origin: string;
  role: "customer" | "seller" | "logistics";
  request: <T>(path: string, options?: RequestInit) => Promise<T>;
  csrf: (signal?: AbortSignal) => Promise<void>;
}): ChatMediaClient {
  const base = `/api/v1/${role}/chat-attachments`;
  const url = (path: string) => `${origin.replace(/\/$/, "")}${path}`;
  const write = async <T>(path: string, options: RequestInit, signal?: AbortSignal) => {
    await csrf(signal);
    return request<T>(path, { ...options, signal });
  };
  return {
    url,
    capabilities: async (signal) => (await request<{ data: { enabled: boolean } }>(base, { signal, cache: "no-store" })).data.enabled,
    status: async (id, signal) => (await request<{ data: ChatAttachment }>(`${base}/${id}`, { signal, cache: "no-store" })).data,
    retry: async (id, signal) => (await write<{ data: ChatAttachment }>(`${base}/${id}/retry`, { method: "POST" }, signal)).data,
    remove: async (id) => { await write(`${base}/${id}`, { method: "DELETE" }, AbortSignal.timeout(15000)); },
    upload: async (file, context, key, progress, signal) => {
      await csrf(signal);
      if (signal.aborted) throw new Error("Upload cancelled.");
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url(base));
        xhr.withCredentials = true;
        xhr.timeout = 120000;
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        xhr.setRequestHeader("Idempotency-Key", key);
        const token = document.cookie.split("; ").find((entry) => entry.startsWith("XSRF-TOKEN="));
        if (token) xhr.setRequestHeader("X-XSRF-TOKEN", decodeURIComponent(token.split("=").slice(1).join("=")));
        const cancel = () => xhr.abort();
        signal.addEventListener("abort", cancel, { once: true });
        xhr.addEventListener("loadend", () => signal.removeEventListener("abort", cancel));
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100));
        });
        xhr.addEventListener("load", () => {
          const payload = (() => {
            try { return JSON.parse(xhr.responseText) as { data?: ChatAttachment; message?: string; errors?: Record<string, string[]> }; }
            catch { return {}; }
          })();
          if (xhr.status >= 200 && xhr.status < 300 && payload.data) resolve(payload.data);
          else {
            if ([401, 403, 419].includes(xhr.status)) clearChatPrivateState();
            reject(new Error(payload.errors?.file?.[0] ?? payload.message ?? "Upload was not confirmed. Retry the same file."));
          }
        });
        for (const event of ["error", "timeout", "abort"]) {
          xhr.addEventListener(event, () => reject(new Error("Upload was not confirmed. Retry the same file.")));
        }
        const data = new FormData();
        data.set("file", file);
        data.set("context", JSON.stringify(context));
        xhr.send(data);
      });
    },
  };
}
