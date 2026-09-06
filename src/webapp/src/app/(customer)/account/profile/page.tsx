import type { Metadata } from "next";

import { CustomerAccountContent } from "@/components/account/customer-account-content";

export const metadata: Metadata = {
  title: "Profile and security",
  description: "Manage your Aisley customer profile and password.",
  robots: { index: false, follow: false },
};

export default function CustomerProfilePage() {
  return <CustomerAccountContent />;
}
