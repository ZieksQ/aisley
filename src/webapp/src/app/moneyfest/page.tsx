import type { Metadata } from "next";

import { ComingSoonPage } from "@/components/marketplace/coming-soon-page";

const title = "MoneyFest — Coming soon";
const description = "MoneyFest is coming to Aisley: earn cashback from purchases and save credit toward future shopping.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/moneyfest" },
  robots: { index: false, follow: true },
  openGraph: { type: "website", url: "/moneyfest", title, description },
  twitter: { card: "summary", title, description },
};

export default function MoneyFestPage() {
  return (
    <ComingSoonPage title="MoneyFest">
      <p>MoneyFest will let you earn cashback every time you shop on Aisley.</p>
      <p>Make at least one purchase each month to retain your cashback. Once you have enough credit, you will be able to use it to buy something on Aisley.</p>
      <p>Cashback is not available yet. Full details will be shared when MoneyFest launches.</p>
    </ComingSoonPage>
  );
}
