import { apiRequest } from "@/lib/api";

import type {
  CustomerOrderGroup,
  OrderDetail,
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
