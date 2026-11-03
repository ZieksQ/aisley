import type { ConsentSelection } from '@aisley/ui/policy-consent'
import { apiRequest } from './api'
import type { PolicyAcceptanceResponse, PolicyConsentStatusResponse, PolicyDocumentResponse, PolicyType } from '../types/policyConsent'

export function fetchPolicyConsentStatus() {
  return apiRequest<PolicyConsentStatusResponse>('/api/v1/policy-consent/status', { cache: 'no-store' })
}

export function fetchCurrentPolicy(type: PolicyType) {
  return apiRequest<PolicyDocumentResponse>(`/api/v1/platform/policies/${type}`, { cache: 'no-store' })
}

export function acceptPolicy(type: PolicyType, version: number) {
  return apiRequest<PolicyAcceptanceResponse>(`/api/v1/policy-consent/${type}/versions/${version}/accept`, { method: 'POST', body: JSON.stringify({ confirmation: true }) })
}

export function acceptPolicies(acceptances: ConsentSelection[]) {
  return apiRequest<{ data: { acceptances: PolicyAcceptanceResponse['data'][]; status: PolicyConsentStatusResponse['data'] } }>('/api/v1/policy-consent/accept', {
    method: 'POST', body: JSON.stringify({ acceptances }),
  })
}
