import type { AuthState } from "../auth/types";
import type { HomepageData } from "./types";

export type DiscoveryOwner = "guest" | `customer:${string}`;

export function discoveryOwner(auth: AuthState): DiscoveryOwner | null {
  if (auth.status === "loading") return null;
  return auth.status === "authenticated" ? `customer:${auth.customer.id}` : "guest";
}

export function publicHomepageData(initialData: HomepageData): HomepageData {
  return {
    ...initialData,
    viewer: {
      isAuthenticated: false,
      displayName: null,
      email: null,
      deliveryLocation: null,
      cartItemCount: 0,
    },
    recentlyViewed: [],
    recommendations: initialData.viewer.isAuthenticated
      ? { items: [], nextCursor: null, pageSize: initialData.recommendations.pageSize }
      : initialData.recommendations,
  };
}

// Cancellation saves work; the revision/sequence checks also reject responses
// from transports that have already completed or do not honor abort signals.
export function createHomepageRequestGuard(
  revision: number,
  currentRevision: () => number,
) {
  let sequence = 0;
  let active: AbortController | null = null;

  function cancel() {
    sequence += 1;
    active?.abort();
    active = null;
  }

  return {
    cancel,
    pending: () => active !== null && currentRevision() === revision,
    start: () => {
      if (currentRevision() !== revision) return null;
      cancel();
      const controller = new AbortController();
      const requestSequence = sequence;
      active = controller;
      return {
        signal: controller.signal,
        isCurrent: () => !controller.signal.aborted
          && sequence === requestSequence && currentRevision() === revision,
        finish: () => {
          if (active === controller) active = null;
        },
      };
    },
  };
}
