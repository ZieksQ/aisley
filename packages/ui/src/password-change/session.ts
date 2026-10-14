export type PasswordOperation = { generation: number; id: number };
export type PasswordSessionSnapshot = {
  phase: "ready" | "requesting" | "confirming" | "reconciliation";
  blockedUntil: number;
  resendUntil: number;
};

/** Nonsecret state owned by an auth provider, never by the password screen. */
export function createPasswordChangeSession() {
  let identity: string | null = null;
  let generation = 0;
  let operationId = 0;
  let snapshot: PasswordSessionSnapshot = { phase: "ready", blockedUntil: 0, resendUntil: 0 };
  const listeners = new Set<() => void>();
  function publish(next: PasswordSessionSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  function isCurrent(operation: PasswordOperation) {
    return identity !== null && operation.generation === generation && operation.id === operationId;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setIdentity(next: string | null, freshAuthentication = false) {
      if (identity === next && !freshAuthentication) return;
      identity = next;
      generation++;
      publish({ phase: "ready", blockedUntil: 0, resendUntil: 0 });
    },
    begin(confirm: boolean): PasswordOperation | null {
      if (identity === null || snapshot.phase !== "ready" || snapshot.blockedUntil > Date.now() || (!confirm && snapshot.resendUntil > Date.now())) return null;
      const operation = { generation, id: ++operationId };
      publish({ ...snapshot, phase: confirm ? "confirming" : "requesting" });
      return operation;
    },
    isCurrent,
    settle(operation: PasswordOperation, uncertain = false, blockedUntil = 0, resendUntil = 0) {
      if (!isCurrent(operation)) return false;
      publish({ phase: uncertain ? "reconciliation" : "ready", blockedUntil: Math.max(snapshot.blockedUntil, blockedUntil), resendUntil: Math.max(snapshot.resendUntil, resendUntil) });
      return true;
    },
  };
}

export type PasswordChangeSession = ReturnType<typeof createPasswordChangeSession>;
