"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import { ApiError, apiRequest, initializeCsrf } from "@/lib/api";
import type { AuthState, AuthenticatedCustomer } from "@/lib/auth/types";

type AuthContextValue = {
  auth: AuthState;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthState>;
  setAuthenticatedCustomer: (customer: AuthenticatedCustomer) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthState(customer: AuthenticatedCustomer): AuthState {
  return customer.role === "customer" && customer.status === "active"
    ? { status: "authenticated", customer }
    : { status: "guest" };
}

export function AuthProvider({
  children,
  initialAuth,
}: {
  children: ReactNode;
  initialAuth: AuthState;
}) {
  // A server-side guest result can be caused by a cross-origin deployment
  // boundary not forwarding the browser's session cookie. Let the browser
  // settle it with its credentialed request before rendering guest controls.
  const [auth, setAuth] = useState<AuthState>(() =>
    initialAuth.status === "authenticated" ? initialAuth : { status: "loading" },
  );
  const pathname = usePathname();
  const refreshRequest = useRef<Promise<AuthState> | null>(null);
  const refreshedPath = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (refreshRequest.current) {
      return refreshRequest.current;
    }

    const request = apiRequest<{ customer: AuthenticatedCustomer }>(
      "/api/v1/customer/auth/me",
    )
      .then(({ customer }) => toAuthState(customer))
      .catch((error: unknown): AuthState => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 419)) {
          return { status: "guest" };
        }

        return { status: "guest" };
      })
      .then((nextAuth) => {
        setAuth(nextAuth);
        return nextAuth;
      })
      .finally(() => {
        refreshRequest.current = null;
      });

    refreshRequest.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated" || refreshedPath.current === pathname) {
      return;
    }

    refreshedPath.current = pathname;
    void refresh();
  }, [auth.status, pathname, refresh]);

  useEffect(() => {
    const refreshOnFocus = () => void refresh();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [refresh]);

  const logout = useCallback(async () => {
    await initializeCsrf();
    await apiRequest<{ message: string }>("/api/v1/customer/auth/logout", {
      method: "POST",
    });
    setAuth({ status: "guest" });
  }, []);

  const setAuthenticatedCustomer = useCallback((customer: AuthenticatedCustomer) => {
    setAuth(toAuthState(customer));
  }, []);

  const value = useMemo(
    () => ({ auth, logout, refresh, setAuthenticatedCustomer }),
    [auth, logout, refresh, setAuthenticatedCustomer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
