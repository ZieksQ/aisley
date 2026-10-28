import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportTicketsContent } from "@/components/account/support-tickets-content";

export const metadata: Metadata = {
  title: "Support tickets",
  robots: { index: false, follow: false },
};

export default function SupportTicketsPage() {
  return <Suspense fallback={<p className="p-5 text-sm text-[#675B6B]" role="status">Loading support tickets…</p>}><SupportTicketsContent /></Suspense>;
}
