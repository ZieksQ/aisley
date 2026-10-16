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

export function getShippingProviders(signal?: AbortSignal) {
  return apiRequest<{ data: ShippingProviderSetting[] }>(
    '/api/v1/seller/shipping-providers',
    { signal },
  )
}

export async function updateShippingProvider(
  provider: ShippingProviderSetting,
  isEnabled: boolean,
  signal?: AbortSignal,
) {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  const timer = globalThis.setTimeout(() => controller.abort(), 15000)
  try {
    await initializeCsrf(controller.signal)
    return await apiRequest<{ data: ShippingProviderUpdate }>(
      `/api/v1/seller/shipping-providers/${encodeURIComponent(provider.organization_id)}`,
      {
        method: 'PUT',
        signal: controller.signal,
        body: JSON.stringify({
          is_enabled: isEnabled,
          ...(provider.revision === null
            ? {}
            : { expected_revision: provider.revision }),
        }),
      },
    )
  } finally {
    globalThis.clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
