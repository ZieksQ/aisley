import type { ChatEntry } from "./types";
import { ChatAvatar, ChatEmptyState } from "./presentation";

export function ChatInbox({ entries, emptyText = "No conversations yet." }: { entries: ChatEntry[]; emptyText?: string }) {
  if (!entries.length) return <ChatEmptyState title={emptyText} description="Your conversations will appear here." />;
  return (
    <ul className="py-1">
      {entries.map((entry) => {
        const className = `flex w-full items-start gap-3 border-l-[3px] px-3 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#E6007A] ${entry.selected ? "border-[#E6007A] bg-[#F7F0F9] dark:bg-purple-400/10" : "border-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.04]"}`;
        return (
          <li key={entry.id}>
            {entry.href && !entry.onSelect ? (
              <a aria-current={entry.selected ? "page" : undefined} className={className} href={entry.href}><ChatEntryText entry={entry} /></a>
            ) : (
              <button aria-current={entry.selected ? "true" : undefined} className={className} onClick={entry.onSelect} type="button"><ChatEntryText entry={entry} /></button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ChatEntryText({ entry }: { entry: ChatEntry }) {
  const date = entry.activity ? new Date(entry.activity) : null;
  const activity = date && Number.isFinite(date.getTime())
    ? date.toDateString() === new Date().toDateString()
      ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  return (
    <>
      <ChatAvatar name={entry.title} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`min-w-0 truncate text-sm ${entry.unread ? "font-bold" : "font-semibold"}`}>{entry.title}</span>
          {activity ? <time className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400" dateTime={entry.activity!}>{activity}</time> : null}
        </span>
        {entry.context ? <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">{entry.context}</span> : null}
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className={`min-w-0 truncate text-sm ${entry.unread ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-400"}`}>{entry.preview || "No messages yet"}</span>
          {entry.unread > 0 ? <span className="flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#E6007A] px-1.5 text-[11px] font-semibold text-white"><span aria-hidden="true">{entry.unread > 99 ? "99+" : entry.unread}</span><span className="sr-only">{entry.unread} unread messages</span></span> : null}
        </span>
        {entry.readOnly ? <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Read only</span> : null}
      </span>
    </>
  );
}
