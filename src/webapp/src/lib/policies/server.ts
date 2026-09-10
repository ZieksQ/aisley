import "server-only";

import type {
  PolicyDocumentResponse,
  PolicyHistoryResponse,
  PublicPolicyType,
} from "./types";

export type PublicPolicyResult<T> =
  | { status: "success"; data: T }
  | { status: "not_found" }
  | { status: "error" };

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

async function request<T>(path: string, revalidate: number): Promise<PublicPolicyResult<T>> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      next: { revalidate },
    });

    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) return { status: "error" };

    return { status: "success", data: (await response.json()) as T };
  } catch {
    return { status: "error" };
  }
}

export function isPublicPolicyType(value: string): value is PublicPolicyType {
  return value === "terms_of_service" || value === "privacy_policy";
}

export function policyPath(type: PublicPolicyType) {
  return `/policies/${type}`;
}

export function policyLabel(type: PublicPolicyType) {
  return type === "terms_of_service" ? "Terms of Service" : "Privacy Policy";
}

export function getPublicPolicy(type: PublicPolicyType) {
  return request<PolicyDocumentResponse>(`/api/v1/platform/policies/${type}`, 300);
}

export function getPublicPolicyHistory(type: PublicPolicyType) {
  return request<PolicyHistoryResponse>(`/api/v1/platform/policies/${type}/history`, 60);
}

export function getPublicPolicyHistoryVersion(type: PublicPolicyType, version: number) {
  return request<PolicyDocumentResponse>(`/api/v1/platform/policies/${type}/history/${version}`, 300);
}
