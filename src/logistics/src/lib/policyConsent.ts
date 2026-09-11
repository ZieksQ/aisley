import { request } from './api'
import type { PolicyAcceptanceResponse, PolicyConsentStatusResponse, PolicyDocumentResponse, PolicyType } from '../types/policyConsent'

export function fetchPolicyConsentStatus() {
  return request<PolicyConsentStatusResponse>('/api/v1/policy-consent/status')
}

export function fetchCurrentPolicy(type: PolicyType) {
  return request<PolicyDocumentResponse>(`/api/v1/platform/policies/${type}`)
}

export function acceptPolicy(type: PolicyType, version: number) {
  return request<PolicyAcceptanceResponse>(`/api/v1/policy-consent/${type}/versions/${version}/accept`, {
    method: 'POST',
    body: JSON.stringify({ confirmation: true }),
  })
}
