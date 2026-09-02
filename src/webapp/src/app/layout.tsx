import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { CartProvider } from "@/components/cart/cart-provider";
import { getServerAuthState } from "@/lib/auth/server";
import { WishlistProvider } from "@/components/wishlist/wishlist-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Aisley | Shop from trusted local sellers",
    template: "%s | Aisley",
  },
  description:
    "Discover products from trusted sellers and enjoy a simple, secure shopping experience with Aisley.",
  applicationName: "Aisley",
  openGraph: {
    type: "website",
    siteName: "Aisley",
    title: "Aisley | Shop from trusted local sellers",
    description:
      "Discover products from trusted sellers and enjoy a simple, secure shopping experience with Aisley.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aisley | Shop from trusted local sellers",
    description:
      "Discover products from trusted sellers and enjoy a simple, secure shopping experience with Aisley.",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialAuth = await getServerAuthState();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AuthProvider initialAuth={initialAuth}>
          <WishlistProvider>
            <CartProvider>{children}</CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
