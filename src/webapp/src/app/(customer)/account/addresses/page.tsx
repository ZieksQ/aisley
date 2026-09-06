import type { Metadata } from "next";

import { AddressBookContent } from "@/components/account/address-book-content";

export const metadata: Metadata = {
  title: "Addresses",
  description: "Manage saved shipping and billing addresses for your Aisley account.",
  robots: { index: false, follow: false },
};

export default async function CustomerAddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;

  return (
    <AddressBookContent
      geoapifyApiKey={process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? ""}
      returnTo={returnTo === "/checkout" ? "/checkout" : null}
    />
  );
}
