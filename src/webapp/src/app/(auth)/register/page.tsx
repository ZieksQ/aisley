import { PageIntro } from "@/components/auth/page-intro";
import { RegisterForm } from "@/components/auth/register-form";
import type { Metadata } from "next";
import Link from "next/link";

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
  return (
    <section className="w-full max-w-2xl">
      <PageIntro
        eyebrow="Join Aisley"
        title="Create your account"
        description="Tell us a little about yourself. Your account will be ready to use after a quick admin review."
      />

      <RegisterForm />

      <p className="mt-7 text-center text-sm text-[#746778]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-bold text-[#4C1268] underline-offset-4 hover:text-[#E6007A] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}
