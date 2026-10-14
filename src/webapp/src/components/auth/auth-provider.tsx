"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPasswordChangeSession, type PasswordChangeSession } from "@aisley/ui/password-change";
import { Button } from "@aisley/ui";
import { clearCheckoutPlacement } from "@/lib/checkout/placement";
import { clearChatPrivateState } from "@aisley/ui/chat";
import { ApiError, apiRequest, initializeCsrf } from "@/lib/api";
import type { AuthState, AuthenticatedCustomer } from "@/lib/auth/types";
import { createSessionController } from "@/lib/auth/session-controller";
import { advanceSessionRevision, isInvalidSession, subscribeToSessionFailures } from "@/lib/auth/session-events";

type AuthContextValue = {
  auth: AuthState;
  passwordSession: PasswordChangeSession;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthState>;
  setAuthenticatedCustomer: (customer: AuthenticatedCustomer, freshAuthentication?: boolean) => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const initialAuth: AuthState = { status: "loading" };
const getServerSnapshot = () => initialAuth;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [passwordSession] = useState(createPasswordChangeSession);
  const [session] = useState(() => createSessionController(
    async () => (await apiRequest<{ customer: AuthenticatedCustomer }>(
      "/api/v1/customer/auth/me", { cache: "no-store", signal: AbortSignal.timeout(15000) },
    )).customer,
    (error) => error instanceof ApiError && isInvalidSession(error.status, error.code),
    advanceSessionRevision,
    passwordSession.setIdentity,
  ));
  const channel = useRef<BroadcastChannel | null>(null);
  const checkoutCustomer = useRef<string | null>(null);
  const auth = useSyncExternalStore(session.subscribe, session.getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (auth.status === "guest") {
      clearChatPrivateState();
      clearCheckoutPlacement();
      checkoutCustomer.current = null;
    } else if (auth.status === "authenticated") {
      if (checkoutCustomer.current && checkoutCustomer.current !== auth.customer.id) {
        clearCheckoutPlacement();
      }
      checkoutCustomer.current = auth.customer.id;
    }
  }, [auth]);

  useEffect(() => {
    const unsubscribe = subscribeToSessionFailures((failure) => {
      if (failure === "invalid") session.clear();
      else void session.refresh(); // A CSRF mismatch alone does not prove logout.
    });
    const sessionChannel = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("aisley-customer-session") : null;
    channel.current = sessionChannel;
    if (sessionChannel) sessionChannel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === "signed-out") session.clear();
      else if (event.data === "session-changed") {
        passwordSession.setIdentity(null);
        session.reset();
        void session.refresh();
      }
    };
    void session.start();
    const retryOnline = () => {
      if (session.getSnapshot().status === "loading") void session.refresh();
    };
    window.addEventListener("online", retryOnline);
    return () => {
      unsubscribe();
      sessionChannel?.close();
      channel.current = null;
      window.removeEventListener("online", retryOnline);
    };
  }, [session, passwordSession]);

  const logout = useCallback(async () => {
    clearChatPrivateState();
    try {
      await initializeCsrf();
      await apiRequest<{ message: string }>("/api/v1/customer/auth/logout", { method: "POST" });
      session.clear();
      channel.current?.postMessage("signed-out");
    } catch (error) {
      if (error instanceof ApiError && isInvalidSession(error.status, error.code)) session.clear();
      else throw error;
    }
  }, [session]);

  const setAuthenticatedCustomer = useCallback((customer: AuthenticatedCustomer, freshAuthentication = false) => {
    const current = session.getSnapshot();
    if (current.status === "authenticated" && current.customer.id !== customer.id) {
      clearChatPrivateState();
      clearCheckoutPlacement();
    }
    passwordSession.setIdentity(customer.id, freshAuthentication);
    session.setCustomer(customer);
    channel.current?.postMessage("session-changed");
  }, [session, passwordSession]);

  const value = useMemo(() => ({
    auth, passwordSession, logout, refresh: session.refresh, setAuthenticatedCustomer,
  }), [auth, passwordSession, logout, session, setAuthenticatedCustomer]);

  return <AuthContext.Provider value={value}>
    {auth.status === "loading" && auth.error ? (
      <div role="alert" className="border-b border-[#DED7E1] bg-white px-4 py-3 text-sm text-[#4C1268]">
        <p>{auth.error}</p>
        <Button type="button" className="mt-2" onClick={() => void session.refresh()}>Retry session check</Button>
      </div>
    ) : null}
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
