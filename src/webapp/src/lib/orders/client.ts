import { apiRequest, initializeCsrf } from "@/lib/api";

import type {
  CustomerOrderGroup,
  OrderDetail,
  OrderAddressQuote,
  OrderListResponse,
  OrderTrackingResponse,
} from "./types";

type DataResponse<T> = { data: T };

export async function fetchOrders(
  group: CustomerOrderGroup | null,
  page: number,
  signal?: AbortSignal,
) {
  const parameters = new URLSearchParams({
    page: String(page),
    per_page: "10",
  });

  if (group) {
    parameters.set("group", group);
  }

  return apiRequest<OrderListResponse>(
    `/api/v1/customer/orders?${parameters.toString()}`,
    { signal },
  );
}

export async function fetchOrder(orderId: string, signal?: AbortSignal) {
  const response = await apiRequest<DataResponse<OrderDetail>>(
    `/api/v1/customer/orders/${encodeURIComponent(orderId)}`,
    { signal },
  );

  return response.data;
}

export async function fetchOrderTracking(
  orderId: string,
  page: number,
  signal?: AbortSignal,
) {
  return apiRequest<OrderTrackingResponse>(
    `/api/v1/customer/orders/${encodeURIComponent(orderId)}/tracking?page=${page}&per_page=25`,
    { signal },
  );
}

export function orderMutationKey(): string {
  return crypto.randomUUID();
}

export async function cancelOrder(
  orderId: string,
  idempotencyKey: string,
  reason?: string,
) {
  await initializeCsrf();
  const response = await apiRequest<DataResponse<OrderDetail>>(
    `/api/v1/customer/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );

  return response.data;
}

export async function modifyOrderAddress(
  orderId: string,
  addressId: string,
  idempotencyKey: string,
  expectedRevision?: number,
  quoteId?: string,
) {
  await initializeCsrf();
  const response = await apiRequest<DataResponse<OrderDetail>>(
    `/api/v1/customer/orders/${encodeURIComponent(orderId)}/modification`,
    {
      method: "PATCH",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        address_id: addressId,
        ...(quoteId ? { quote_id: quoteId } : {}),
        ...(expectedRevision === undefined
          ? {}
          : { expected_revision: expectedRevision }),
      }),
    },
  );

  return response.data;
}

export async function quoteOrderAddress(orderId: string, addressId: string, revision: number) {
  await initializeCsrf();
  const response = await apiRequest<DataResponse<OrderAddressQuote>>(
    `/api/v1/customer/orders/${encodeURIComponent(orderId)}/modification/quote`,
    { method: "POST", body: JSON.stringify({ address_id: addressId, expected_revision: revision }) },
  );
  return response.data;
}
