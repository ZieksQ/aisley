import { ChatMessageMedia } from "./media-history";
import type { ChatMediaClient } from "./media-types";
import { useLayoutEffect, useRef, useState } from "react";
import type { ChatMessageItem } from "./types";

const muted = "text-zinc-500 dark:text-zinc-400";

export function ChatHistory({
  mediaClient,
  messages,
  label = "Conversation messages",
  olderCursor,
  onLoadOlder,
  loadingOlder,
  loading,
  emptyText = "No messages yet.",
}: {
  mediaClient?: ChatMediaClient;
  messages: ChatMessageItem[];
  label?: string;
  olderCursor?: boolean;
  onLoadOlder?: () => void;
  loadingOlder?: boolean;
  loading?: boolean;
  emptyText?: string;
}) {
  const view = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const previousNewest = useRef<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [initialScroll, setInitialScroll] = useState(true);
  const previousSequence = useRef(0);

  useLayoutEffect(() => {
    const element = view.current;
    if (!element) return;
    if (anchor.current) {
      element.scrollTop = anchor.current.top + element.scrollHeight - anchor.current.height;
      anchor.current = null;
    } else if (initialScroll || following.current) {
      element.scrollTop = element.scrollHeight;
      setNewCount(0);
    } else if (messages.at(-1)?.id !== previousNewest.current) {
      const latestSequence = messages.at(-1)?.sequence ?? previousSequence.current;
      setNewCount((count) => count + Math.max(1, latestSequence - previousSequence.current));
    }
    previousNewest.current = messages.at(-1)?.id ?? null;
    previousSequence.current = messages.at(-1)?.sequence ?? previousSequence.current;
    setInitialScroll(false);
  }, [messages, initialScroll]);

  function loadOlder() {
    const element = view.current;
    if (element) anchor.current = { height: element.scrollHeight, top: element.scrollTop };
    onLoadOlder?.();
  }

  function jumpToLatest() {
    const element = view.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    following.current = true;
    setNewCount(0);
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={view} aria-label={label} className="marketplace-scroll absolute inset-0 overflow-y-auto px-4 py-4 sm:px-6" tabIndex={0} onScroll={(event) => {
        const element = event.currentTarget;
        following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
        if (following.current) setNewCount(0);
      }}>
        {olderCursor ? <button className="mb-4 min-h-10 text-sm font-semibold text-[#4C1268] underline focus-visible:outline-2 focus-visible:outline-[#E6007A] dark:text-purple-300" disabled={loadingOlder} onClick={loadOlder} type="button">{loadingOlder ? "Loading earlier messages…" : "Load earlier messages"}</button> : null}
        {loading && !messages.length ? <p className={`py-6 text-center text-sm ${muted}`} role="status">Loading messages…</p> : null}
        {!loading && !messages.length ? <p className={`py-8 text-center text-sm ${muted}`}>{emptyText}</p> : null}
        <ol className="space-y-3">
          {messages.map((message, index) => {
            const prior = messages[index - 1];
            const date = new Date(message.createdAt);
            const priorDate = prior ? new Date(prior.createdAt) : null;
            const day = new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(date);
            const newDay = !priorDate || date.toDateString() !== priorDate.toDateString();
            return (
              <li key={message.id}>
                {newDay ? <p className="mb-3 mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400"><span className="border border-zinc-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-[#18181b]">{day}</span></p> : null}
                <article className={`max-w-[92%] border px-3 py-2.5 text-sm sm:max-w-[78%] ${message.mine ? "ml-auto border-[#4C1268]/20 bg-[#4C1268]/5 dark:bg-[#4C1268]/20" : "border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.04]"}`}>
                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{message.sender}</p>
                  <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere] text-zinc-900 dark:text-zinc-100">{message.body}</p>
                  {mediaClient && message.attachments?.length ? <ChatMessageMedia attachments={message.attachments} client={mediaClient} /> : null}
                  {message.context ? <div className="mt-2 border-t border-zinc-200 pt-2 text-xs dark:border-white/10">{message.context}</div> : null}
                  <time className={`mt-2 block text-right text-xs ${muted}`} dateTime={message.createdAt} title={date.toLocaleString()}>{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
                  {message.status && message.mine ? <p className={`mt-1 text-right text-xs ${message.status === "unconfirmed" || message.status === "failed" ? "text-amber-700 dark:text-amber-300" : muted}`}>{message.status === "sent" ? "Sent" : message.status === "sending" ? "Sending…" : message.status === "failed" ? "Failed" : "Delivery unconfirmed"}</p> : null}
                </article>
              </li>
            );
          })}
        </ol>
      </div>
      <p aria-live="polite" className="sr-only" role="status">{newCount > 0 ? `${newCount} new message${newCount === 1 ? "" : "s"} available.` : ""}</p>
      {newCount > 0 ? <button className="absolute bottom-3 left-1/2 -translate-x-1/2 border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-[#4C1268] shadow-sm focus-visible:outline-2 focus-visible:outline-[#E6007A] dark:border-white/20 dark:bg-[#202024] dark:text-purple-300" onClick={jumpToLatest} type="button">{newCount} new message{newCount === 1 ? "" : "s"} · Latest</button> : null}
    </div>
  );
}
