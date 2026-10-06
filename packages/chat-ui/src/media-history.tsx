import { useEffect, useRef, useState } from "react";
import type { ChatAttachment, ChatMediaClient } from "./media-types";

export function ChatMessageMedia({ attachments, client }: { attachments: ChatAttachment[]; client: ChatMediaClient }) {
  const [viewing, setViewing] = useState<ChatAttachment | null>(null);
  const [viewerFailed, setViewerFailed] = useState(false);
  const [viewerRevision, setViewerRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setViewerFailed(false);
    if (viewing) dialog.current?.showModal();
    else dialog.current?.close();
  }, [viewing]);

  return (
    <>
      <ul aria-label="Message attachments" className="mt-2 space-y-2">
        {attachments.map((asset) => (
          <ChatMediaItem asset={asset} client={client} key={asset.id} onView={() => setViewing(asset)} />
        ))}
      </ul>
      <dialog
        aria-label="Image viewer"
        className="m-auto max-h-[90dvh] w-[min(92vw,960px)] overflow-auto border border-zinc-300 bg-white p-4 text-zinc-900 backdrop:bg-black/60 dark:border-white/20 dark:bg-zinc-900 dark:text-white"
        onCancel={() => setViewing(null)}
        onClose={() => setViewing(null)}
        ref={dialog}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="min-w-0 break-all text-sm">{viewing?.filename}</p>
          <button
            autoFocus
            className="min-h-10 shrink-0 border border-zinc-300 px-3 text-sm dark:border-white/20"
            onClick={() => setViewing(null)}
            type="button"
          >
            Close
          </button>
        </div>
        {viewerFailed ? (
          <p role="status" className="text-sm">
            Image unavailable. <button
              className="min-h-10 underline"
              type="button"
              onClick={() => {
                setViewerFailed(false);
                setViewerRevision((value) => value + 1);
              }}
            >Retry</button>
          </p>
        ) : viewing?.content_url ? (
          <img
            alt={viewing.filename}
            key={viewerRevision}
            onError={() => setViewerFailed(true)}
            className="max-h-[70dvh] w-full object-contain"
            src={client.url(viewing.content_url)}
          />
        ) : null}
      </dialog>
    </>
  );
}

function ChatMediaItem({ asset, client, onView }: {
  asset: ChatAttachment;
  client: ChatMediaClient;
  onView: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  if (!asset.content_url || asset.state !== "ready") {
    return <li className="text-sm text-zinc-600 dark:text-zinc-400">Attachment unavailable</li>;
  }

  return (
    <li className="min-w-0">
      {failed ? (
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Attachment unavailable. <button
            className="min-h-9 underline"
            onClick={() => {
              setRevision((current) => current + 1);
              setFailed(false);
            }}
            type="button"
          >Retry</button>
        </p>
      ) : asset.kind === "image" ? (
        <button
          aria-label={`View image: ${asset.filename}`}
          className="block max-w-full focus-visible:outline-2 focus-visible:outline-[#E6007A]"
          onClick={onView}
          type="button"
        >
          <img
            alt={asset.filename}
            className="max-h-64 max-w-full object-contain"
            height={asset.height ?? undefined}
            key={revision}
            loading="lazy"
            onError={() => setFailed(true)}
            src={client.url(asset.preview_url ?? asset.content_url)}
            width={asset.width ?? undefined}
          />
        </button>
      ) : asset.kind === "video" ? (
        <>
          <video
            aria-label={`Video: ${asset.filename}`}
            className="max-h-72 max-w-full"
            controls
            width={asset.width ?? undefined}
            height={asset.height ?? undefined}
            key={revision}
            onError={() => setFailed(true)}
            playsInline
            poster={asset.preview_url ? client.url(asset.preview_url) : undefined}
            preload="none"
            src={client.url(asset.content_url)}
          />
          <a
            className="mt-1 inline-block min-h-9 text-sm underline"
            href={client.url(asset.content_url)}
            rel="noreferrer"
            target="_blank"
          >
            Open video · {asset.duration_seconds ? `${Math.ceil(asset.duration_seconds)} seconds` : asset.filename}
          </a>
        </>
      ) : (
        <div className="border border-zinc-300 p-3 dark:border-white/20">
          <p className="break-all font-medium">{asset.filename}</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {asset.filename.split(".").at(-1)?.toUpperCase()} · {(asset.byte_size / 1024 / 1024).toFixed(1)} MiB
          </p>
          <a
            className="mt-2 inline-block min-h-9 text-sm underline"
            href={client.url(asset.content_url)}
            rel="noreferrer"
            target="_blank"
          >
            Download<span className="sr-only"> {asset.filename}</span>
          </a>
        </div>
      )}
    </li>
  );
}
