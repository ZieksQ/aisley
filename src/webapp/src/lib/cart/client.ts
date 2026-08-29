import { apiRequest, initializeCsrf } from "@/lib/api";

import type {
  AddCartItemPayload,
  CustomerCart,
  UpdateCartItemPayload,
} from "./types";

const cartPath = "/api/v1/customer/cart";

type CartResponse = { data: CustomerCart };

export async function fetchCart(signal?: AbortSignal) {
  const response = await apiRequest<CartResponse>(cartPath, { signal });
  return response.data;
}

export async function addCartItem(payload: AddCartItemPayload) {
  await initializeCsrf();
  const response = await apiRequest<CartResponse>(`${cartPath}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateCartItem(
  itemId: string,
  payload: UpdateCartItemPayload,
) {
  await initializeCsrf();
  const response = await apiRequest<CartResponse>(
    `${cartPath}/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

export async function deleteCartItem(itemId: string) {
  await initializeCsrf();
  const response = await apiRequest<CartResponse>(
    `${cartPath}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
  );
  return response.data;
}
