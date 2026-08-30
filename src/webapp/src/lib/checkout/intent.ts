import type { CheckoutIntent, CheckoutRequestPayload } from "./types";

const checkoutIntentKey = "aisley:checkout-intent";

export function saveCheckoutIntent(intent: CheckoutIntent) {
  sessionStorage.setItem(checkoutIntentKey, JSON.stringify(intent));
}

export function readCheckoutIntent(): CheckoutIntent | null {
  try {
    const stored = sessionStorage.getItem(checkoutIntentKey);
    if (!stored) return null;

    const value = JSON.parse(stored) as Partial<CheckoutIntent>;
    if (
      value.mode === "cart" &&
      Array.isArray(value.cartItemIds) &&
      value.cartItemIds.length > 0 &&
      value.cartItemIds.every((id) => typeof id === "string")
    ) {
      return { mode: "cart", cartItemIds: [...new Set(value.cartItemIds)] };
    }

    if (
      value.mode === "buy_now" &&
      typeof value.productId === "string" &&
      (typeof value.variantId === "string" || value.variantId === null) &&
      Number.isSafeInteger(value.quantity) &&
      Number(value.quantity) > 0
    ) {
      return {
        mode: "buy_now",
        productId: value.productId,
        variantId: value.variantId,
        quantity: Number(value.quantity),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function checkoutPayloadForIntent(
  intent: CheckoutIntent,
  addressId: string,
): Omit<CheckoutRequestPayload, "vouchers"> {
  if (intent.mode === "cart") {
    return {
      mode: "cart",
      cart_item_ids: intent.cartItemIds,
      address_id: addressId,
      payment_method: "cod",
    };
  }

  return {
    mode: "buy_now",
    buy_now: {
      product_id: intent.productId,
      variant_id: intent.variantId,
      quantity: intent.quantity,
    },
    address_id: addressId,
    payment_method: "cod",
  };
}

export function clearCheckoutIntent() {
  sessionStorage.removeItem(checkoutIntentKey);
}
