import Link from "next/link";
import type { ReactNode } from "react";

const channels = [
  { key: "shop", label: "Shops", href: "/messages" },
  { key: "logistics", label: "Logistics", href: "/delivery-messages" },
  { key: "courier", label: "Couriers", href: "/courier-messages" },
] as const;

export function MessagePageShell({ channel, children, focusConversation = false }: { channel: "shop" | "logistics" | "courier"; children: ReactNode; focusConversation?: boolean }) {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-2 py-3 sm:px-4 lg:px-6">
      <div className={`${focusConversation ? "hidden min-[800px]:flex" : "flex"} mb-1 items-center justify-between gap-3 px-1`}>
        <h1 className="text-lg font-semibold text-[#231429]">Messages</h1>
        <Link className="inline-flex min-h-11 items-center text-sm text-[#4C1268] hover:underline focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={channel === "shop" ? "/" : "/orders"}>{channel === "shop" ? "Back to store" : "Orders"}</Link>
      </div>
      <nav aria-label="Message channels" className={`${focusConversation ? "hidden min-[800px]:flex" : "flex"} mb-2 gap-5 border-b border-[#E9E4EB] px-1 text-sm`}>
        {channels.map((item) => <Link aria-current={item.key === channel ? "page" : undefined} className={`inline-flex min-h-11 items-center border-b-2 px-1 focus-visible:outline-2 focus-visible:outline-[#E6007A] ${item.key === channel ? "border-[#E6007A] font-semibold text-[#4C1268]" : "border-transparent text-[#655969] hover:text-[#4C1268]"}`} href={item.href} key={item.key}>{item.label}</Link>)}
      </nav>
      {children}
    </main>
  );
}
