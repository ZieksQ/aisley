"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useChatNotifications, type ChatNotification, type ChatNotificationPage } from "./notification-state";

type Props = {
  theme?: "light" | "dashboard";
  load: (signal: AbortSignal) => Promise<ChatNotificationPage>;
  icon: ReactNode;
  triggerClassName: string;
  inboxes: { label: string; href: string }[];
  destination: (item: ChatNotification) => string;
  channelLabel: (item: ChatNotification) => string;
  renderLink: (href: string, children: ReactNode, className: string, onClick: () => void) => ReactNode;
};

export function ChatNotificationControl(props: Props) {
  const { page, loading, error, refresh } = useChatNotifications(props.load);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 64 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const unread = page?.meta.unread_count ?? 0;
  const close = () => setOpen(false);
  const themed = (className: string) => props.theme === "light"
    ? className.split(/\s+/).filter((name) => !name.startsWith("dark:")).join(" ")
    : className;

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect) setPosition({
        left: Math.max(8, Math.min(rect.right - 352, window.innerWidth - Math.min(352, window.innerWidth - 16) - 8)),
        top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 180)),
      });
    };
    reposition();
    panel.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  return (
    <div
      ref={root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close();
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={`Chat messages${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        className={`relative ${props.triggerClassName}`}
        onClick={() => {
          setOpen(!open);
          if (!open) refresh();
        }}
      >
        {props.icon}
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 rounded-md bg-[#E6007A] px-1.5 text-[10px] font-bold leading-5 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-labelledby={`${id}-title`}
          tabIndex={-1}
          className={themed("fixed z-[100] w-[352px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.1)] focus-visible:outline-2 focus-visible:outline-[#4C1268] dark:border-white/15 dark:bg-[#18181b] dark:text-zinc-100")}
          style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 8}px)` }}
        >
          <div className={themed("flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10")}>
            <h2 id={`${id}-title`} className="font-semibold">Chat messages</h2>
            <button
              type="button"
              onClick={() => { close(); trigger.current?.focus(); }}
              className={themed("rounded px-2 py-1 text-xs hover:bg-zinc-100 focus-visible:outline-2 dark:hover:bg-white/10")}
            >
              Close
            </button>
          </div>
          <p className="sr-only" role="status">{unread} unread chat messages</p>
          {loading && !page && <p className="px-4 py-5" role="status">Loading messages…</p>}
          {error && (
            <div className="px-4 py-3" role="status">
              <p>{error}</p>
              <button type="button" className="mt-2 underline underline-offset-2" onClick={refresh} disabled={loading}>Retry</button>
            </div>
          )}
          {!loading && !error && page?.data.length === 0 && (
            <p className={themed("px-4 py-5 text-zinc-600 dark:text-zinc-400")}>No unread messages.</p>
          )}
          {page && (
            <ul className={themed("divide-y divide-zinc-200 dark:divide-white/10")}>
              {page.data.map((item) => (
                <li key={item.id}>
                  {props.renderLink(
                    props.destination(item),
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-words font-semibold">{item.counterparty_label}</span>
                        <span className={themed("shrink-0 text-xs font-medium text-[#4C1268] dark:text-pink-200")}>{item.unread_count} unread</span>
                      </div>
                      <p className={themed("mt-1 line-clamp-2 break-words text-zinc-600 dark:text-zinc-300")}>{item.last_message_preview || "New attachment"}</p>
                      <p className={themed("mt-2 text-xs text-zinc-500 dark:text-zinc-400")}>
                        {props.channelLabel(item)}
                        {item.last_message_at && (
                          <> · <time dateTime={item.last_message_at}>
                            {new Date(item.last_message_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </time></>
                        )}
                      </p>
                    </>,
                    themed("block px-4 py-3 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#4C1268] dark:hover:bg-white/5"),
                    close,
                  )}
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="Chat inboxes" className={themed("flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10")}>
            {props.inboxes.map((inbox) => (
              <span key={inbox.href}>
                {props.renderLink(inbox.href, inbox.label, "text-xs font-medium underline underline-offset-2 focus-visible:outline-2", close)}
              </span>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
