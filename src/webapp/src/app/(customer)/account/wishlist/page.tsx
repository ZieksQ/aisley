import type { Metadata } from "next";

import { WishlistPageContent } from "@/components/wishlist/wishlist-page-content";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Review products saved to your Aisley Wishlist.",
  robots: { index: false, follow: false },
};

export default function CustomerWishlistPage() {
  return <WishlistPageContent />;
}
