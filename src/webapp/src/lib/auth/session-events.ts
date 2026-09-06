type SessionFailure = "invalid" | "recheck";
let revision = 0;
const listeners = new Set<(failure: SessionFailure) => void>();

export function sessionRevision() { return revision; }
export function advanceSessionRevision() { revision += 1; }

export function subscribeToSessionFailures(listener: (failure: SessionFailure) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isInvalidSession(status: number, code?: string) {
  return status === 401 || (status === 403 && [
    "FORBIDDEN_ROLE", "ACCOUNT_PENDING_APPROVAL", "ACCOUNT_REJECTED",
    "ACCOUNT_SUSPENDED", "ACCOUNT_INACTIVE",
  ].includes(code ?? ""));
}

export function reportSessionFailure(path: string, status: number, code: string | undefined, requestRevision: number) {
  // Login errors and stale responses from an earlier session must not sign out
  // a newly authenticated Customer. /me is handled by the session controller.
  if (requestRevision !== revision || !path.startsWith("/api/v1/customer/") ||
      (path.startsWith("/api/v1/customer/auth/") && path !== "/api/v1/customer/auth/logout")) return;
  const failure = isInvalidSession(status, code) ? "invalid" : status === 419 ? "recheck" : null;
  if (failure) listeners.forEach((listener) => listener(failure));
}
