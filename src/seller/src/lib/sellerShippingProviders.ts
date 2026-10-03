import { apiRequest, initializeCsrf } from './api'

export type ShippingProviderSetting = {
  organization_id: string
  business_name: string
  hub: { id: string; name: string }
  is_enabled: boolean
  revision: number | null
}

type ShippingProviderUpdate = {
  logistics_organization_id: string
  is_enabled: boolean
  revision: number
}

export function getShippingProviders() {
  return apiRequest<{ data: ShippingProviderSetting[] }>('/api/v1/seller/shipping-providers')
}

export async function updateShippingProvider(provider: ShippingProviderSetting, isEnabled: boolean) {
  await initializeCsrf()

  return apiRequest<{ data: ShippingProviderUpdate }>(
    `/api/v1/seller/shipping-providers/${encodeURIComponent(provider.organization_id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        is_enabled: isEnabled,
        ...(provider.revision === null ? {} : { expected_revision: provider.revision }),
      }),
    },
  )
}
