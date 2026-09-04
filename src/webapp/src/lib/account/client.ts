import { apiRequest, initializeCsrf } from "@/lib/api";
import type {
  CustomerAccountResponse,
  CustomerPasswordPayload,
  CustomerProfileMutationResponse,
  CustomerProfilePayload,
} from "@/lib/account/types";

const accountPath = "/api/v1/customer/account";

export function fetchCustomerAccount(signal?: AbortSignal) {
  return apiRequest<CustomerAccountResponse>(accountPath, {
    cache: "no-store",
    signal,
  });
}

export async function updateCustomerProfile(payload: CustomerProfilePayload) {
  await initializeCsrf();

  return apiRequest<CustomerProfileMutationResponse>(`${accountPath}/profile`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomerPassword(payload: CustomerPasswordPayload) {
  await initializeCsrf();

  return apiRequest<{ message: string }>(`${accountPath}/password`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
