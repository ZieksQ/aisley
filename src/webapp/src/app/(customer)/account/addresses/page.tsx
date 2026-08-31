import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AddressBookContent } from "@/components/account/address-book-content";
import { getServerAuthState } from "@/lib/auth/server";

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
  const [{ returnTo }, auth] = await Promise.all([searchParams, getServerAuthState()]);
  if (auth.status !== "authenticated") {
    const next = returnTo === "/checkout"
      ? "/account/addresses?returnTo=%2Fcheckout"
      : "/account/addresses";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <AddressBookContent
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ""}
      returnTo={returnTo === "/checkout" ? "/checkout" : null}
    />
  );
}
