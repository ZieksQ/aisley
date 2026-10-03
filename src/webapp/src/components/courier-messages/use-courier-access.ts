"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";

export function useCourierAccess() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) return false;
    const next = encodeURIComponent(`${pathname}${window.location.search}`);
    // apiRequest already reports invalid sessions to the shared AuthProvider.
    if (error.status === 401) router.replace(`/login?next=${next}`);
    else if (error.code === "POLICY_CONSENT_REQUIRED") router.replace(`/account/policy-consent?next=${next}`);
    return true;
  }, [router, pathname]);
}

export function courierError(error: unknown) {
  if (error instanceof ApiError && error.status === 429) return "Too many messages. Wait a moment before retrying.";
  return error instanceof ApiError ? error.errors.body?.[0] ?? error.message : "The API could not be reached. Check your connection and retry.";
}
