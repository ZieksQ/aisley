"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { isProtectedCustomerPath, safeReturnPath } from "@/lib/auth/navigation";

// UI gating only. Private data must still come from Laravel's authenticated,
// Customer-scoped APIs; a server child must never pass unguarded private data.
export function AuthRouteBoundary({ children, guestOnly = false }: { children: ReactNode; guestOnly?: boolean }) {
  const { auth } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const protectedRoute = !guestOnly && isProtectedCustomerPath(pathname);

  useEffect(() => {
    if (protectedRoute && auth.status === "guest") {
      const next = `${pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    } else if (guestOnly && auth.status === "authenticated") {
      const parameters = new URLSearchParams(window.location.search);
      const next = safeReturnPath(parameters.get("next") ?? parameters.get("returnTo"));
      router.replace(next === pathname || next.startsWith(`${pathname}?`) ? "/" : next);
    }
  }, [auth.status, guestOnly, pathname, protectedRoute, router]);

  if ((protectedRoute && auth.status !== "authenticated") ||
      (guestOnly && auth.status !== "guest")) {
    return <p role="status" className="mx-auto w-full max-w-[1180px] px-4 py-8 text-sm text-[#5E5262]">
      {auth.status === "loading" ? "Checking your session…" : "Redirecting…"}
    </p>;
  }
  return children;
}
