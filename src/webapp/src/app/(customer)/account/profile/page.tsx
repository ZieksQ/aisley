import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CustomerAccountContent } from "@/components/account/customer-account-content";
import { getServerAuthState } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Profile and security",
  description: "Manage your Aisley customer profile and password.",
  robots: { index: false, follow: false },
};

export default async function CustomerProfilePage() {
  const auth = await getServerAuthState();
  if (auth.status !== "authenticated") {
    redirect(`/login?next=${encodeURIComponent("/account/profile")}`);
  }

  return <CustomerAccountContent />;
}
