import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PageIntro } from "@/components/auth/page-intro";
import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

export const metadata: Metadata = {
  title: "Reset your password",
  description:
    "Request secure password reset instructions for your approved Aisley customer account.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <section className="w-full max-w-md">
      <PageIntro
        eyebrow="Account recovery"
        title="Forgot your password?"
        description="Enter the email attached to your approved customer account and we’ll send you a secure reset link."
      />

      <ForgotPasswordForm />

      <Link
        href="/login"
        className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-lg text-sm font-bold text-[#4C1268] underline-offset-4 hover:text-[#E6007A] hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4C1268]/15"
      >
        <FiArrowLeft aria-hidden="true" />
        Back to sign in
      </Link>
    </section>
  );
}
