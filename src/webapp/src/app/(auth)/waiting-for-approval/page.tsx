import { AuthStatusCard } from "@/components/auth/auth-status-card";
import type { Metadata } from "next";
import { FiClock } from "react-icons/fi";

export const metadata: Metadata = {
  title: "Waiting for account approval",
  description: "Your Aisley customer registration is awaiting admin review.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function WaitingForApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string | string[] }>;
}) {
  const registered = (await searchParams).registered === "1";

  return (
    <AuthStatusCard
      title="Waiting for approval"
      icon={<FiClock aria-hidden="true" className="size-9" />}
      description={
        <>
          {registered
            ? "Your account has been registered successfully and is waiting for admin approval."
            : "Your account is still waiting for admin approval."}{" "}
          We&apos;ll email you once your account has been reviewed.
          <span className="mt-3 block">You can continue browsing the store while you wait.</span>
        </>
      }
      actionHref="/"
      actionLabel="Continue shopping"
      secondaryAction={{ href: "/login", label: "Go to sign in" }}
    />
  );
}
