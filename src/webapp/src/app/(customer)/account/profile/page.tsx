import { AccountSettingsState } from "@aisley/ui/account-settings";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CustomerAccountContent } from "@/components/account/customer-account-content";

export const metadata: Metadata = {
  title: "Profile and security",
  description: "Manage your Aisley customer profile and password.",
  robots: { index: false, follow: false },
};

export default function CustomerProfilePage() {
  return <Suspense fallback={<AccountSettingsState />}>

    <CustomerAccountContent />

  </Suspense>;
}
