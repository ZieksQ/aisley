import type { AuthState, AuthenticatedCustomer } from "./types";

export function createSessionController(
  loadCustomer: () => Promise<AuthenticatedCustomer>,
  isInvalid: (error: unknown) => boolean,
  onSessionChange: () => void,
) {
  let state: AuthState = { status: "loading" };
  let started = false;
  let generation = 0;
  let pending: Promise<AuthState> | null = null;
  const listeners = new Set<() => void>();

  function publish(next: AuthState) {
    state = next;
    listeners.forEach((listener) => listener());
  }

  function replace(next: AuthState) {
    generation += 1;
    pending = null;
    onSessionChange();
    publish(next);
  }

  function setCustomer(customer: AuthenticatedCustomer) {
    replace(customer.role === "customer" && customer.status === "active"
      ? { status: "authenticated", customer } : { status: "guest" });
  }

  function refresh(): Promise<AuthState> {
    if (pending) return pending;
    const requestGeneration = generation;
    const request = loadCustomer()
      .then((customer) => {
        if (generation === requestGeneration) setCustomer(customer);
        return state;
      })
      .catch((error: unknown) => {
        if (generation === requestGeneration) {
          if (isInvalid(error)) replace({ status: "guest" });
          else if (state.status !== "authenticated") publish({
            status: "loading",
            error: "We could not check your session. Check your connection and try again.",
          });
        }
        return state;
      })
      .finally(() => { if (pending === request) pending = null; });
    pending = request;
    return request;
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start: () => {
      if (started) return pending ?? Promise.resolve(state);
      started = true;
      return refresh();
    },
    refresh,
    setCustomer,
    clear: () => replace({ status: "guest" }),
    reset: () => replace({ status: "loading" }),
  };
}
