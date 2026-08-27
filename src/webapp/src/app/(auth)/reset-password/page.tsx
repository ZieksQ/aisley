import { PageIntro } from "@/components/auth/page-intro";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Securely choose a new password for your Aisley customer account.",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string | string[];
    token?: string | string[];
  }>;
}) {
  const params = await searchParams;

  return (
    <section className="w-full max-w-md">
      <PageIntro
        eyebrow="Account recovery"
        title="Create a new password"
        description="Choose a strong password that you haven’t used for this account before."
      />

      <ResetPasswordForm
        initialEmail={first(params.email)}
        token={first(params.token)}
      />
    </section>
  );
}
