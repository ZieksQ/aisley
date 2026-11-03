import type { Metadata } from "next";

import { PolicyConsentContent } from "@/components/account/policy-consent-content";

export const metadata: Metadata = {
  title: "Terms and Privacy",
  description: "Review and manage your Aisley policy acceptance status.",
  robots: { index: false, follow: false, nocache: true },
};

export default function CustomerPolicyConsentPage() {
  return <PolicyConsentContent />;
}
