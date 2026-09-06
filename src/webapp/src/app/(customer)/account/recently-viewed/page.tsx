import type { Metadata } from "next";

import { RecentlyViewedPageContent } from "@/components/recently-viewed/recently-viewed-page-content";

export const metadata: Metadata = {
  title: "Recently viewed",
  description: "Review products you recently viewed on Aisley.",
  robots: { index: false, follow: false },
};

export default function CustomerRecentlyViewedPage() {
  return <RecentlyViewedPageContent />;
}
