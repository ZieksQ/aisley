import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import type { AuthState, AuthenticatedCustomer } from "./types";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");
const storefrontUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

type AuthResponse = { customer: AuthenticatedCustomer };

export const getServerAuthState = cache(async (): Promise<AuthState> => {
  const cookieHeader = (await cookies()).toString();

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/customer/auth/me`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Cookie: cookieHeader,
        Referer: `${storefrontUrl}/`,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (response.status === 401 || response.status === 403) {
      return { status: "guest" };
    }

    if (!response.ok) {
      return { status: "loading" };
    }

    const { customer } = (await response.json()) as AuthResponse;

    if (customer.role !== "customer" || customer.status !== "active") {
      return { status: "guest" };
    }

    return { status: "authenticated", customer };
  } catch {
    return { status: "loading" };
  }
});
