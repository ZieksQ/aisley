import type { CheckoutBatch, CheckoutIntent, CheckoutRequestPayload } from "./types";

type PlacementPayload = CheckoutRequestPayload & { quote_id: string };
export type PendingPlacement = {
  customerId: string;
  key: string;
  intent: CheckoutIntent;
  payload: PlacementPayload;
};
const storageKey = "aisley:pending-checkout";
const refreshableCodes = new Set(["QUOTE_EXPIRED", "QUOTE_INPUT_CHANGED", "QUOTE_STALE"]);

// One controller survives route changes. Storage contains IDs/quantities only, no address snapshot.
export function createPlacementController(storage: () => Storage) {
  let running: Promise<CheckoutBatch> | null = null;
  let revision = 0;
  return {
    read(customerId: string): PendingPlacement | null {
      const raw = storage().getItem(storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as PendingPlacement;
      if (value.customerId !== customerId) {
        this.clear();
        return null;
      }
      if (!value.key || !value.payload?.quote_id || !value.intent) {
        throw new Error("Checkout recovery data could not be read. Check your orders before starting again.");
      }
      return value;
    },
    clear() {
      revision += 1;
      running = null;
      storage().removeItem(storageKey);
    },
    submit(
      customerId: string,
      draft: { intent: CheckoutIntent; payload: PlacementPayload } | null,
      send: (payload: PlacementPayload, key: string) => Promise<CheckoutBatch>,
    ): Promise<CheckoutBatch> {
      const existing = this.read(customerId);
      if (running) return running;
      const pending = existing ?? (draft ? {
        customerId,
        key: crypto.randomUUID(),
        ...structuredClone(draft),
      } : null);
      if (!pending) throw new Error("No checkout request is available to retry.");
      // Persist before sending; unavailable storage must never produce an unrecorded purchase.
      storage().setItem(storageKey, JSON.stringify(pending));
      const started = revision;
      running = Promise.resolve().then(async () => {
        if (started !== revision) throw new Error("The checkout session changed.");
        const batch = await send(pending.payload, pending.key);
        if (!batch || typeof batch.id !== "string" || !batch.id) {
          throw new Error("The server did not return an order confirmation.");
        }
        return batch;
      }).catch((error: unknown) => {
        const failure = error as { status?: number; code?: string } | null;
        if (started === revision && failure?.status === 409 && refreshableCodes.has(failure.code ?? "")) {
          this.clear();
        }
        throw error;
      }).finally(() => {
        if (started === revision) running = null;
      });
      return running;
    },
  };
}

export const checkoutPlacement = createPlacementController(() => sessionStorage);
export function clearCheckoutPlacement() {
  try {
    checkoutPlacement.clear();
  } catch {
    // Storage may be disabled.
  }
}
