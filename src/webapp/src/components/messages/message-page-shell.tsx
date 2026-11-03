import Link from "next/link";
import type { ReactNode } from "react";

export function MessagePageShell({ channel, children, focusConversation = false }: { channel: "shop" | "logistics" | "courier"; children: ReactNode; focusConversation?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-2 py-3 sm:px-4 lg:px-6">
      <div className={`${focusConversation ? "hidden min-[800px]:flex" : "flex"} mb-1 items-center justify-between gap-3 px-2`}>
        <h1 className="text-lg font-semibold text-[#231429]">Messages</h1>
        <Link className="inline-flex min-h-11 items-center text-sm text-[#4C1268] hover:underline focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={channel === "shop" ? "/" : "/orders"}>{channel === "shop" ? "Back to store" : "Orders"}</Link>
      </div>
      {children}
    </main>
  );
}
