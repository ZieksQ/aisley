import type { Metadata } from "next";
import { MyVouchersContent } from "@/components/vouchers/my-vouchers-content";
import "@/components/vouchers/vouchers.css";

export const metadata: Metadata = {
  title: "My Vouchers",
  robots: { index: false, follow: false },
};
export default function MyVouchersPage() {
  return <MyVouchersContent />;
}
