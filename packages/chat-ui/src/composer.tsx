import { ChatMediaSelection } from "./media-composer";
import { useComposerMedia } from "./use-composer-media";
import type { ChatMediaOptions } from "./media-types";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export function ChatComposer({
  media,
  value,
  onChange,
  onSubmit,
  recipient,
  sendAllowed = true,
  online = true,
  sending = false,
  uncertain = false,
  error,
  success,
  readOnlyReason,
  id = "chat-message",
  placeholder = "Write a message…",
}: {
  media?: ChatMediaOptions;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (attachmentIds: string[]) => void;
  recipient: string;
  sendAllowed?: boolean;
  online?: boolean;
  sending?: boolean;
  uncertain?: boolean;
  error?: string;
  success?: string;
  readOnlyReason?: string | null;
  id?: string;
  placeholder?: string;
}) {
  const attachments = useComposerMedia(media);
  const hasContent = Boolean(value.trim() || attachments.rows.length);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [browserOnline, setBrowserOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [touchInput, setTouchInput] = useState(false);

  useEffect(() => {
    const sync = () => setBrowserOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const sync = () => setTouchInput(media.matches || navigator.maxTouchPoints > 0);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!hasContent) return;
    const warnBeforeDiscard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeDiscard);
    return () => window.removeEventListener("beforeunload", warnBeforeDiscard);
  }, [hasContent]);

  useEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`;
  }, [value]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!sendAllowed && !uncertain) || !online || !browserOnline || sending || !hasContent || !attachments.ready) return;
    onSubmit(attachments.ids);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (touchInput || event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    event.preventDefault();
    if (hasContent && attachments.ready && online && browserOnline && !sending && (sendAllowed || uncertain)) onSubmit(attachments.ids);
  }

  const canSend = online && browserOnline && (sendAllowed || uncertain);
  return (
    <form className="shrink-0 border-t border-zinc-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 dark:border-white/10" onSubmit={submit}>
      {!sendAllowed && !uncertain ? <p className="mb-2 text-sm text-amber-700 dark:text-amber-300">{readOnlyReason ?? "This conversation is read only. Existing history remains available."}</p> : null}
      {(!online || !browserOnline) ? <p className="mb-2 text-sm text-amber-700 dark:text-amber-300" role="status">You are offline. Your draft stays here until you reconnect.</p> : null}
      {error ? <p className="mb-2 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      {success ? <p className="mb-2 text-sm text-emerald-700 dark:text-emerald-300" role="status">{success}</p> : null}
      {uncertain ? <p className="mb-2 text-sm text-amber-800 dark:text-amber-300" role="status">Delivery is unconfirmed. Retry this same message to check whether it was saved.</p> : null}
      {media ? <ChatMediaSelection disabled={sending || uncertain || !canSend} enabled={attachments.enabled} media={media} /> : null}
      <label className="sr-only" htmlFor={id}>Message {recipient}</label>
      <div className="flex items-end gap-2 border border-zinc-300 bg-white p-2 focus-within:border-[#4C1268] focus-within:ring-1 focus-within:ring-[#4C1268] dark:border-white/20 dark:bg-[#202024] dark:focus-within:border-purple-300 dark:focus-within:ring-purple-300">
        <textarea
          ref={textarea}
          aria-describedby={`${id}-help`}
          className="max-h-44 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-3 text-base text-zinc-950 outline-none placeholder:text-zinc-500 disabled:opacity-60 sm:text-sm dark:text-white"
          disabled={sending || uncertain || !sendAllowed}
          id={id}
          maxLength={2000}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={keyDown}
          placeholder={placeholder}
          value={value}
          rows={1}
        />
        <button className="min-h-11 shrink-0 border border-[#4C1268] bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]" disabled={!canSend || sending || !hasContent || !attachments.ready} type="submit">{sending ? "Sending…" : uncertain ? "Retry" : "Send"}</button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{uncertain ? "Message locked until delivery is confirmed" : "Enter to send · Shift+Enter for a new line"}</p>
        <p id={`${id}-help`} className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{value.length}/2,000</p>
      </div>
    </form>
  );
}
