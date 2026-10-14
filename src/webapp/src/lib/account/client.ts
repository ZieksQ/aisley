import type { PasswordDraft, PasswordChallenge, VerifiedPassword, PasswordRequestContext } from "@aisley/ui/password-change";
import { apiRequest, apiUploadRequest, initializeCsrf } from "@/lib/api";
import type {
  CustomerAccountResponse,
  CustomerPhotoMutationResponse,
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

export async function updateCustomerPassword(payload: VerifiedPassword, context?: PasswordRequestContext) {
  await initializeCsrf(context?.signal);

  if (context && (!context.isCurrent() || context.signal.aborted)) throw new Error("This password request is no longer current.");
  return apiRequest<{ message: string }>(`${accountPath}/password`, {
    method: "PATCH",
    signal: context?.signal, body: JSON.stringify(payload),
  });
}

export function uploadCustomerProfilePhoto(
  photo: File,
  onProgress?: (percent: number) => void,
) {
  const body = new FormData();
  body.append("photo", photo);

  return apiUploadRequest<CustomerPhotoMutationResponse>(
    `${accountPath}/profile-photo`,
    body,
    onProgress,
  );
}

export async function removeCustomerProfilePhoto() {
  await initializeCsrf();

  return apiRequest<CustomerPhotoMutationResponse>(`${accountPath}/profile-photo`, {
    method: "DELETE",
  });
}

export async function requestCustomerPasswordCode(payload: PasswordDraft, context?: PasswordRequestContext) {
  await initializeCsrf(context?.signal);
  if (context && (!context.isCurrent() || context.signal.aborted)) throw new Error("This password request is no longer current.");
  return apiRequest<{ data: PasswordChallenge }>(`${accountPath}/password/verification-code`, {
    method: "POST", signal: context?.signal, body: JSON.stringify(payload), cache: "no-store",
  });
}
