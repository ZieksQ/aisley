"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { ChatEntry } from "./types";
import { useUnifiedInbox } from "./unified-state";
import { ChatInbox } from "./inbox";

export { ChatInbox } from "./inbox";

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const unified = useUnifiedInbox();
  return <ChatWorkspaceView {...props} {...(unified ?? {})} />;
}

type ChatWorkspaceProps = {
  entries: ChatEntry[]; selected: boolean; inboxTitle?: string; inboxStatus?: ReactNode; inboxError?: ReactNode;
  onRetryInbox?: () => void; onLoadMore?: () => void; canLoadMore?: boolean; loadingMore?: boolean;
  onBack?: () => void; children: ReactNode; inboxToolbar?: ReactNode; scrollPosition?: { current: number };
};

function ChatWorkspaceView({
  entries, selected, inboxTitle = "Inbox", inboxStatus, inboxError,
  onRetryInbox, onLoadMore, canLoadMore = false, loadingMore = false,
  onBack, children,
  inboxToolbar, scrollPosition,
}: ChatWorkspaceProps) {
  const inboxList = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (inboxList.current && scrollPosition) inboxList.current.scrollTop = scrollPosition.current;
  }, [selected, scrollPosition]);
  const workspace = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = workspace.current;
    if (!element) return;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
        const available = bottom - Math.max(0, element.getBoundingClientRect().top) - 12;
        element.style.setProperty("--chat-height", `${Math.max(160, Math.min(900, available))}px`);
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
    };
  }, []);

  return (
    <div ref={workspace} className="grid h-[var(--chat-height,calc(100dvh-12rem))] min-h-40 grid-cols-1 overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 min-[800px]:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] dark:border-white/10 dark:bg-[#1E293B] dark:text-zinc-100">
      <aside aria-label="Conversation inbox" className={`${selected ? "hidden" : "flex"} min-h-0 min-w-0 flex-col border-zinc-200 min-[800px]:flex min-[800px]:border-r dark:border-white/10`}>
        <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 dark:border-white/10">
          <h2 className="min-w-0 break-words text-sm font-semibold">{inboxTitle}</h2>
        </div>
        {inboxToolbar ? <div className="shrink-0 border-b border-zinc-200 px-3 py-2 dark:border-white/10">{inboxToolbar}</div> : null}
        {inboxError ? (
          <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">
            {inboxError}{onRetryInbox ? <button className="ml-2 min-h-11 font-semibold underline focus-visible:outline-2 focus-visible:outline-[var(--chat-brand,#4C1268)]" onClick={onRetryInbox} type="button">Retry</button> : null}
          </div>
        ) : null}
        <div ref={inboxList} onScroll={(event) => { if (scrollPosition) scrollPosition.current = event.currentTarget.scrollTop; }} className="marketplace-scroll min-h-0 flex-1 overflow-y-auto">
          {inboxStatus}
          {entries.length || (!inboxStatus && !inboxError) ? <ChatInbox entries={entries} /> : null}
          {canLoadMore ? <button className="min-h-11 w-full border-t border-zinc-200 px-4 text-sm font-semibold text-[var(--chat-brand,#4C1268)] hover:bg-zinc-50 disabled:opacity-60 dark:border-white/10 dark:text-[var(--chat-focus,#C4B5FD)] dark:hover:bg-white/[0.04]" disabled={loadingMore} onClick={onLoadMore} type="button">{loadingMore ? "Loading…" : "Load older conversations"}</button> : null}
        </div>
      </aside>
      <section aria-label="Conversation" className={`${selected ? "flex" : "hidden min-[800px]:flex"} min-h-0 min-w-0 flex-col overflow-hidden`}>
        {selected && onBack ? <button className="min-h-11 shrink-0 self-start px-4 text-sm font-semibold text-[var(--chat-brand,#4C1268)] focus-visible:outline-2 focus-visible:outline-[var(--chat-brand,#4C1268)] min-[800px]:hidden dark:text-[var(--chat-focus,#C4B5FD)]" onClick={onBack} type="button">← Inbox</button> : null}
        {children}
      </section>
    </div>
  );
}
