"use client";

import { useRef, type ReactNode } from "react";
import { ChatAvatar } from "./presentation";

export type ShopAvailability = "online" | "offline" | "vacation";

export function ChatShopAvailability({ availability }: { availability?: ShopAvailability }) {
  if (!availability) return null;
  const color = availability === "online" ? "bg-emerald-600"
    : availability === "vacation" ? "bg-amber-600" : "bg-zinc-400";
  const label = availability === "online" ? "Shop online"
    : availability === "vacation" ? "On vacation" : "Shop offline";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
      <span aria-hidden="true" className={`size-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export function ChatProfileCard({ name, description, action }: {
  name: string;
  description?: ReactNode;
  action: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`View ${name} profile`}
        className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        onClick={() => dialog.current?.showModal()}
      >
        <ChatAvatar name={name} />
      </button>
      <dialog
        ref={dialog}
        aria-label={`${name} profile`}
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right
            || event.clientY < rect.top || event.clientY > rect.bottom) close();
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-xl backdrop:bg-black/20"
      >
        <div className="flex items-center gap-3">
          <ChatAvatar name={name} />
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-semibold">{name}</h2>
            {description}
          </div>
          <button
            autoFocus
            type="button"
            aria-label="Close profile"
            onClick={close}
            className="min-h-11 min-w-11 rounded-md text-xl focus-visible:outline-2 focus-visible:outline-[#E6007A]"
          >×</button>
        </div>
        <div className="mt-4" onClick={close}>{action}</div>
      </dialog>
    </>
  );
}
