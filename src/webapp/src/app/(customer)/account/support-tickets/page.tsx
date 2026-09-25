import type { Metadata } from "next";
import { SupportTicketsContent } from "@/components/account/support-tickets-content";

export const metadata: Metadata = {
  title: "Support tickets",
  robots: { index: false, follow: false },
};

export default function SupportTicketsPage() {
  return <SupportTicketsContent />;
}
