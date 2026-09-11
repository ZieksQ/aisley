"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { fetchPolicyConsentStatus } from "@/lib/policies/client";
import { useAuth } from "./auth-provider";
import { isProtectedCustomerPath, safeReturnPath } from "@/lib/auth/navigation";

type ConsentState = "checking" | "allowed" | "required" | "error";
type ConsentResult = { key: string; state: Exclude<ConsentState, "checking">; error: string };

// UI gating only. Private data must still come from Laravel's authenticated,
// Customer-scoped APIs; a server child must never pass unguarded private data.
export function AuthRouteBoundary({ children, guestOnly = false }: { children: ReactNode; guestOnly?: boolean }) {
  const { auth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const protectedRoute = !guestOnly && isProtectedCustomerPath(pathname);
  const isConsentRoute = pathname === "/account/policy-consent";
  const consentKey = protectedRoute && !isConsentRoute && auth.status === "authenticated"
    ? `${auth.customer.id}:${pathname}`
    : "";
  const [consentResult, setConsentResult] = useState<ConsentResult | null>(null);

  useEffect(() => {
    if (!consentKey) return;

    const controller = new AbortController();

    fetchPolicyConsentStatus(controller.signal)
      .then((response) => setConsentResult({
        key: consentKey,
        state: response.data.all_required_accepted ? "allowed" : "required",
        error: "",
      }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setConsentResult({
          key: consentKey,
          state: "error",
          error: error instanceof ApiError ? error.message : "We could not verify policy consent.",
        });
      });

    return () => controller.abort();
  }, [consentKey]);

  const consentState: ConsentState = !consentKey
    ? "allowed"
    : consentResult?.key === consentKey
      ? consentResult.state
      : "checking";
  const consentError = consentResult?.key === consentKey ? consentResult.error : "";

  useEffect(() => {
    if (protectedRoute && auth.status === "guest") {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    } else if (protectedRoute && !isConsentRoute && auth.status === "authenticated" && consentState === "required") {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/account/policy-consent?next=${encodeURIComponent(next)}`);
    } else if (guestOnly && auth.status === "authenticated") {
      const parameters = new URLSearchParams(window.location.search);
      const next = safeReturnPath(parameters.get("next") ?? parameters.get("returnTo"));
      router.replace(next === pathname || next.startsWith(`${pathname}?`) ? "/" : next);
    }
  }, [auth.status, consentState, guestOnly, isConsentRoute, pathname, protectedRoute, router]);

  if ((protectedRoute && auth.status !== "authenticated") ||
      (guestOnly && auth.status !== "guest")) {
    return <p role="status" className="mx-auto w-full max-w-[1180px] px-4 py-8 text-sm text-[#5E5262]">
      {auth.status === "loading" ? "Checking your session…" : "Redirecting…"}
    </p>;
  }

  if (protectedRoute && !isConsentRoute && consentState === "checking") {
    return <p role="status" className="mx-auto w-full max-w-[1180px] px-4 py-8 text-sm text-[#5E5262]">Checking policy consent…</p>;
  }

  if (protectedRoute && !isConsentRoute && consentState === "error") {
    return <section className="mx-auto w-full max-w-[1180px] px-4 py-8"><div className="border border-[#E2DCE4] bg-white p-5"><p className="text-sm text-[#B42318]" role="alert">{consentError}</p><button className="mt-4 min-h-10 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268]" onClick={() => window.location.reload()} type="button">Try again</button></div></section>;
  }

  return children;
}
