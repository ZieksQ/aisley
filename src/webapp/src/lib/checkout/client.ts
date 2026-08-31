import { apiRequest, initializeCsrf } from "@/lib/api";

import type {
  CheckoutBatch,
  CheckoutQuote,
  CheckoutRequestPayload,
  AddressPayload,
  CreateAddressPayload,
  CustomerAddress,
} from "./types";

type DataResponse<T> = { data: T };

export async function fetchAddresses(signal?: AbortSignal) {
  const response = await apiRequest<DataResponse<CustomerAddress[]>>(
    "/api/v1/customer/addresses",
    { signal },
  );
  return response.data;
}

export async function createAddress(payload: CreateAddressPayload) {
  await initializeCsrf();
  const response = await apiRequest<DataResponse<CustomerAddress>>(
    "/api/v1/customer/addresses",
    { method: "POST", body: JSON.stringify(payload) },
  );
  return response.data;
}

export async function updateAddress(addressId: string, payload: AddressPayload) {
  await initializeCsrf();
  const response = await apiRequest<DataResponse<CustomerAddress>>(
    `/api/v1/customer/addresses/${encodeURIComponent(addressId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return response.data;
}

export async function deleteAddress(addressId: string) {
  await initializeCsrf();
  await apiRequest<null>(
    `/api/v1/customer/addresses/${encodeURIComponent(addressId)}`,
    { method: "DELETE" },
  );
}

export async function quoteCheckout(payload: CheckoutRequestPayload) {
  await initializeCsrf();
  const response = await apiRequest<DataResponse<CheckoutQuote>>(
    "/api/v1/customer/checkout/quote",
    { method: "POST", body: JSON.stringify(payload) },
  );
  return response.data;
}

export async function placeCheckout(
  payload: CheckoutRequestPayload & { quote_id: string },
  idempotencyKey: string,
) {
  await initializeCsrf();
  const response = await apiRequest<DataResponse<CheckoutBatch>>(
    "/api/v1/customer/checkout/place",
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    },
  );
  return response.data;
}

export async function fetchCheckoutBatch(
  batchId: string,
  signal?: AbortSignal,
) {
  const response = await apiRequest<DataResponse<CheckoutBatch>>(
    `/api/v1/customer/checkout/${encodeURIComponent(batchId)}`,
    { signal },
  );
  return response.data;
}
