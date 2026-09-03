import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RecentlyViewedPageContent } from "@/components/recently-viewed/recently-viewed-page-content";
import { getServerAuthState } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Recently viewed",
  description: "Review products you recently viewed on Aisley.",
  robots: { index: false, follow: false },
};

export default async function CustomerRecentlyViewedPage() {
  const auth = await getServerAuthState();
  if (auth.status !== "authenticated") {
    redirect(`/login?next=${encodeURIComponent("/account/recently-viewed")}`);
  }

  return <RecentlyViewedPageContent />;
}
