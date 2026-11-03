"use client";

import { PolicyConsentPanel } from "@aisley/ui/policy-consent";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { safeReturnPath } from "@/lib/auth/navigation";
import { sessionRevision } from "@/lib/auth/session-events";
import { acceptPolicies, fetchCurrentPolicy, fetchPolicyConsentStatus } from "@/lib/policies/client";

const api = { status: fetchPolicyConsentStatus, document: fetchCurrentPolicy, accept: acceptPolicies };

export function PolicyConsentContent() {
  const { auth } = useAuth();
  const router = useRouter();
  return <PolicyConsentPanel
    key={auth.status === "authenticated" ? `${auth.customer.id}:${sessionRevision()}` : "signed-out"}
    api={api}
    onComplete={() => {
      const next = new URLSearchParams(window.location.search).get("next");
      const path = safeReturnPath(next);
      if (next && path.split(/[?#]/)[0] !== "/account/policy-consent") router.replace(path);
    }}
  />;
}
