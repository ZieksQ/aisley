import { useEffect, useState } from "react";
import { processChatFile, useChatAttachments } from "./media-state";
import type { ChatMediaOptions } from "./media-types";

export function useComposerMedia(media: ChatMediaOptions | undefined) {
  const client = media?.client;
  const draftKey = media?.draftKey;
  const rows = useChatAttachments(media?.draftKey ?? "unused-media-composer");
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    const check = () => {
      void client.capabilities(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]))
        .then((value) => { if (!controller.signal.aborted) setEnabled(value); })
        .catch(() => { if (!controller.signal.aborted) setEnabled(false); });
    };
    check();
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    return () => { controller.abort(); window.removeEventListener("focus", check); window.removeEventListener("online", check); };
  }, [client]);
  useEffect(() => {
    if (!client || !draftKey) return;
    rows.filter((row) => !row.busy && !row.error && row.asset?.state !== "ready")
      .forEach((row) => void processChatFile(draftKey, row.key, client));
  }, [rows, client, draftKey]);

  return {
    enabled,
    rows,
    ready: rows.every((row) => row.asset?.state === "ready" && !row.error),
    ids: rows.flatMap((row) => row.asset?.state === "ready" ? [row.asset.id] : []),
  };
}
