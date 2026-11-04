import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a customer account",
  description:
    "Create your free Aisley customer account to save products, place orders, and track deliveries after admin approval.",
  alternates: { canonical: "/register" },
  openGraph: {
    title: "Create your Aisley customer account",
    description:
      "Join Aisley to save products, shop from trusted sellers, and track every delivery.",
    url: "/register",
  },
};

export default function RegisterPage() {
  return null;
}
