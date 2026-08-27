import { AuthStatusCard } from "@/components/auth/auth-status-card";
import type { Metadata } from "next";
import { FiXCircle } from "react-icons/fi";

export const metadata: Metadata = {
  title: "Account not approved",
  description: "Your Aisley customer account registration was not approved.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AccountNotApprovedPage() {
  return (
    <AuthStatusCard
      title="Account not approved"
      tone="error"
      icon={<FiXCircle aria-hidden="true" className="size-9" />}
      description={
        <>
          Your account registration was not approved. Check your email for more
          information or contact support if you need assistance.
        </>
      }
      actionHref="/"
      actionLabel="Back to store"
      secondaryAction={{ href: "/login", label: "Return to sign in" }}
    />
  );
}
