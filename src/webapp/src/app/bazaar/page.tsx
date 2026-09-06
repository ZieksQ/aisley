import type { Metadata } from "next";

import { ComingSoonPage } from "@/components/marketplace/coming-soon-page";

const title = "Bazaar — Coming soon";
const description = "Bazaar is coming to Aisley: a dedicated place to shop from certified and verified stores.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/bazaar" },
  robots: { index: false, follow: true },
  openGraph: { type: "website", url: "/bazaar", title, description },
  twitter: { card: "summary", title, description },
};

export default function BazaarPage() {
  return (
    <ComingSoonPage title="Bazaar">
      <p>A dedicated place to discover and shop from certified and verified stores on Aisley.</p>
      <p>Bazaar is on its way. Check back for its launch.</p>
    </ComingSoonPage>
  );
}
