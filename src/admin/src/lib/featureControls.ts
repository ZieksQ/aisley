import { apiRequest } from './api'
import type { FeatureControl, FeatureControlResponse } from '../types/featureControls'

export function fetchFeatureControls(signal?: AbortSignal) {
  return apiRequest<FeatureControlResponse>('/api/v1/admin/platform-settings/feature-controls', { signal })
}

export function updateFeatureControl(key: string, enabled: boolean, revision: number) {
  return apiRequest<{ data: FeatureControl }>(`/api/v1/admin/platform-settings/feature-controls/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled, revision }),
  })
}
