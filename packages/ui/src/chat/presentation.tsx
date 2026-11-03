import { useUnifiedInbox, chatRoleLabel } from "./unified-state";
import type { ReactNode } from "react";

export function ChatAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0] ?? "").join("").toLocaleUpperCase();
  return <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--chat-tint,#F1EAF4)] text-sm font-semibold text-[var(--chat-brand,#4C1268)] dark:bg-purple-300/10 dark:text-[var(--chat-focus,#C4B5FD)]">{initials || "?"}</span>;
}

export function ChatThreadHeader({ title, description, children, avatar }: { title: string; description?: ReactNode; children?: ReactNode; avatar?: ReactNode }) {
  const inbox = useUnifiedInbox();
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#18181b]">
      {avatar ?? <ChatAvatar name={title} />}
      <div className="min-w-0 flex-1">
        <h2 className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {inbox?.counterpartRole ? <p className="mt-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">{chatRoleLabel(inbox.counterpartRole)}</p> : null}
        {description ? <div className="mt-0.5 break-words text-xs text-zinc-500 dark:text-zinc-400">{description}</div> : null}
        {children}
      </div>
    </header>
  );
}

export function ChatEmptyState({ title = "Your messages", description }: { title?: string; description?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-6 text-center">
      <svg aria-hidden="true" className="mb-1 size-9 text-[var(--chat-brand,#4C1268)]/60 dark:text-purple-300/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z" /><path d="M7 9h10M7 13h6" /></svg>
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
      {description ? <p className="max-w-64 text-sm text-zinc-500 dark:text-zinc-400">{description}</p> : null}
    </div>
  );
}
