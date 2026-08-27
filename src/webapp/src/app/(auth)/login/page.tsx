import { LoginForm } from "@/components/auth/login-form";
import { PageIntro } from "@/components/auth/page-intro";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in to your account",
  description:
    "Sign in to your approved Aisley customer account to manage orders, saved items, and account details.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Sign in to your Aisley account",
    description:
      "Access your Aisley orders, saved items, and customer account securely.",
    url: "/login",
  },
};

function safeReturnPath(value: string | string[] | undefined) {
  const path = Array.isArray(value) ? value[0] : value;

  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    return "/";
  }

  return path;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { returnTo } = await searchParams;

  return (
    <section className="w-full max-w-md">
      <PageIntro
        eyebrow="Welcome back"
        title="Sign in to Aisley"
        description="Use your approved customer account to pick up where you left off."
      />
      <LoginForm returnTo={safeReturnPath(returnTo)} />

      <p className="mt-7 text-center text-sm text-[#746778]">
        New to Aisley?{" "}
        <Link
          href="/register"
          className="font-bold text-[#4C1268] underline-offset-4 hover:text-[#E6007A] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </section>
  );
}
