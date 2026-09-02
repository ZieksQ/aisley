import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WishlistPageContent } from "@/components/wishlist/wishlist-page-content";
import { getServerAuthState } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Review products saved to your Aisley Wishlist.",
  robots: { index: false, follow: false },
};

export default async function CustomerWishlistPage() {
  const auth = await getServerAuthState();
  if (auth.status !== "authenticated") {
    redirect(`/login?next=${encodeURIComponent("/account/wishlist")}`);
  }

  return <WishlistPageContent />;
}
