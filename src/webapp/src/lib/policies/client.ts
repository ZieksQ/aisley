import { apiRequest } from "@/lib/api";

import type {
  PolicyAcceptanceResponse,
  PolicyDocumentResponse,
  PolicyConsentStatusResponse,
  PublicPolicyType,
} from "./types";

export function fetchPolicyConsentStatus(signal?: AbortSignal) {
  return apiRequest<PolicyConsentStatusResponse>("/api/v1/policy-consent/status", {
    cache: "no-store",
    signal,
  });
}

export function fetchCurrentPolicy(type: PublicPolicyType, signal?: AbortSignal) {
  return apiRequest<PolicyDocumentResponse>(`/api/v1/platform/policies/${type}`, {
    cache: "no-store",
    signal,
  });
}

export function acceptPolicy(type: PublicPolicyType, version: number) {
  return apiRequest<PolicyAcceptanceResponse>(`/api/v1/policy-consent/${type}/versions/${version}/accept`, {
    method: "POST",
    body: JSON.stringify({ confirmation: true }),
  });
}
