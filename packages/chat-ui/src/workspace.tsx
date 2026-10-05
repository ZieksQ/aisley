import type { ReactNode } from "react";
import type { ChatEntry } from "./types";

const surface = "border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]";
const muted = "text-zinc-500 dark:text-zinc-400";

export function ChatWorkspace({
  entries,
  selected,
  inboxTitle = "Inbox",
  inboxStatus,
  inboxError,
  onRetryInbox,
  onLoadMore,
  canLoadMore = false,
  loadingMore = false,
  onBack,
  children,
}: {
  entries: ChatEntry[];
  selected: boolean;
  inboxTitle?: string;
  inboxStatus?: ReactNode;
  inboxError?: ReactNode;
  onRetryInbox?: () => void;
  onLoadMore?: () => void;
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`grid h-[min(780px,calc(100dvh-11rem))] min-h-[min(30rem,calc(100dvh-11rem))] grid-cols-1 overflow-hidden border ${surface} min-[800px]:grid-cols-[minmax(17rem,19rem)_minmax(0,1fr)]`}>
      <aside aria-label="Conversation inbox" className={`${selected ? "hidden" : "flex"} min-h-0 flex-col border-r-0 border-zinc-200 min-[800px]:flex min-[800px]:border-r dark:border-white/10`}>
        <div className="flex min-h-12 items-center justify-between border-b border-zinc-200 px-4 dark:border-white/10">
          <h2 className="text-sm font-semibold">{inboxTitle}</h2>
        </div>
        {inboxError ? (
          <div className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">
            {inboxError}{onRetryInbox ? <button className="ml-2 font-semibold underline" onClick={onRetryInbox} type="button">Retry</button> : null}
          </div>
        ) : null}
        <div className="marketplace-scroll min-h-0 flex-1 overflow-y-auto">
          {inboxStatus}
          {entries.length || (!inboxStatus && !inboxError) ? <ChatInbox entries={entries} /> : null}
          {canLoadMore ? <button className="min-h-11 w-full border-t border-zinc-200 px-4 text-sm font-semibold text-[#4C1268] hover:bg-zinc-50 disabled:opacity-60 md:dark:text-purple-300 dark:border-white/10 dark:hover:bg-white/[0.04]" disabled={loadingMore} onClick={onLoadMore} type="button">{loadingMore ? "Loading…" : "Load older conversations"}</button> : null}
        </div>
      </aside>
      <section aria-label="Conversation" className={`${selected ? "flex" : "hidden min-[800px]:flex"} min-h-0 min-w-0 flex-col`}>
        {selected && onBack ? <button className="min-h-11 self-start px-4 text-sm font-semibold text-[#4C1268] underline min-[800px]:hidden dark:text-purple-300" onClick={onBack} type="button">← Back to inbox</button> : null}
        {children}
      </section>
    </div>
  );
}

export function ChatInbox({ entries, emptyText = "No conversations yet." }: { entries: ChatEntry[]; emptyText?: string }) {
  if (!entries.length) return <p className={`p-5 text-sm ${muted}`}>{emptyText}</p>;
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-white/10">
      {entries.map((entry) => (
        <li key={entry.id}>
          {entry.onSelect ? (
            <button aria-current={entry.selected ? "true" : undefined} className={`block w-full border-l-2 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-[#E6007A] ${entry.selected ? "border-[#4C1268] bg-purple-50 dark:border-purple-300 dark:bg-purple-400/10" : "border-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.04]"}`} onClick={entry.onSelect} type="button">
              <ChatEntryText entry={entry} />
            </button>
          ) : entry.href ? (
            <a aria-current={entry.selected ? "page" : undefined} className={`block border-l-2 px-4 py-3 focus-visible:outline-2 focus-visible:outline-[#E6007A] ${entry.selected ? "border-[#4C1268] bg-purple-50 dark:border-purple-300 dark:bg-purple-400/10" : "border-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.04]"}`} href={entry.href}>
              <ChatEntryText entry={entry} />
            </a>
          ) : (
            <button aria-current={entry.selected ? "true" : undefined} className={`block w-full border-l-2 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-[#E6007A] ${entry.selected ? "border-[#4C1268] bg-purple-50 dark:border-purple-300 dark:bg-purple-400/10" : "border-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.04]"}`} onClick={entry.onSelect} type="button">
              <ChatEntryText entry={entry} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ChatEntryText({ entry }: { entry: ChatEntry }) {
  const activityDate = entry.activity ? new Date(entry.activity) : null;
  const activityLabel = activityDate && Number.isFinite(activityDate.getTime())
    ? activityDate.toDateString() === new Date().toDateString()
      ? activityDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : activityDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{entry.title}</span>
        {activityDate && activityLabel ? <time className={`shrink-0 text-xs ${muted}`} dateTime={entry.activity!}>{activityLabel}</time> : null}
      </span>
      {entry.context ? <span className={`mt-1 block truncate text-xs ${muted}`}>{entry.context}</span> : null}
      <span className="mt-1 flex items-center justify-between gap-3">
        <span className={`min-w-0 truncate text-sm ${muted}`}>{entry.preview || "No messages yet"}</span>
        {entry.unread > 0 ? <span className="shrink-0 border border-[#4C1268]/25 bg-[#4C1268]/5 px-1.5 py-0.5 text-xs font-semibold text-[#4C1268] dark:border-purple-300/30 dark:bg-purple-300/10 dark:text-purple-200"><span aria-hidden="true">{entry.unread}</span><span className="sr-only">{entry.unread} unread messages</span></span> : null}
      </span>
      {entry.readOnly ? <span className={`mt-1 block text-xs ${muted}`}>Read only</span> : null}
    </>
  );
}
