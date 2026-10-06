import { useRef, useState } from "react";
import { addChatFiles, processChatFile, removeChatFile, useChatAttachments } from "./media-state";
import { chatMediaAccept, chatMediaHelp, type ChatMediaOptions } from "./media-types";

export function ChatMediaSelection({ media, disabled, enabled }: {
  media: ChatMediaOptions;
  disabled: boolean;
  enabled: boolean;
}) {
  const rows = useChatAttachments(media.draftKey);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-3 space-y-2">
      {enabled ? (
        <>
          <button
            className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-800 disabled:opacity-50 dark:border-white/20 dark:text-zinc-200"
            disabled={disabled || rows.length >= 5}
            onClick={() => picker.current?.click()}
            type="button"
          >
            Attach files
          </button>
          <input
            accept={chatMediaAccept}
            aria-label="Choose chat attachments"
            className="sr-only"
            disabled={disabled}
            multiple
            onChange={(event) => {
              setError(addChatFiles(media.draftKey, Array.from(event.target.files ?? []), media.context));
              event.target.value = "";
            }}
            ref={picker}
            tabIndex={-1}
            type="file"
          />
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {chatMediaHelp} Documents: PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP, TXT, CSV.
          </p>
        </>
      ) : rows.length ? (
        <p className="text-xs text-amber-800 dark:text-amber-300">New uploads are temporarily unavailable.</p>
      ) : null}
      {error ? <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      {rows.length ? (
        <ul aria-label="Selected attachments" className="max-h-48 space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <li className="flex items-start gap-3 border border-zinc-200 p-2 dark:border-white/10" key={row.key}>
              {row.preview ? (
                <img alt="Selected image preview" className="h-12 w-12 shrink-0 object-contain" src={row.preview} />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm text-zinc-900 dark:text-zinc-100">{row.file.name}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400" role="status">
                  <span className="sr-only">{row.file.name}: </span>
                  {(row.file.size / 1024 / 1024).toFixed(1)} MiB · {row.error ? "Could not attach"
                    : row.asset?.state === "ready" ? "Ready" : row.asset ? "Checking file…"
                    : `Uploading ${row.progress}%`}
                </p>
                {row.busy && !row.asset ? (
                  <progress
                    aria-label={`Uploading ${row.file.name}`}
                    className="mt-1 h-2 w-full accent-[#4C1268]"
                    max={100}
                    value={row.progress}
                  />
                ) : null}
                {row.error ? <p className="mt-1 text-xs text-red-700 dark:text-red-300" role="alert">{row.error}</p> : null}
                {row.error && row.asset?.state !== "rejected" ? (
                  <button
                    className="mt-1 min-h-9 text-sm underline"
                    disabled={disabled || row.busy || !enabled}
                    onClick={() => void processChatFile(media.draftKey, row.key, media.client)}
                    type="button"
                  >
                    Retry file
                  </button>
                ) : null}
              </div>
              <button
                aria-label={`Remove ${row.file.name}`}
                className="min-h-10 shrink-0 px-2 text-sm underline disabled:opacity-50"
                disabled={disabled}
                onClick={() => removeChatFile(media.draftKey, row.key, media.client)}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
