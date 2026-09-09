import { apiRequest } from './api'

export type LogisticsOption = {
  id: string
  business_name: string
  hub: {
    id: string
    name: string
    area: { city_municipality: string; province: string; region: string; country: string }
  }
  available: boolean
  match_tier: string
  recommendation_reason: string
  distance_km: number | null
  status: string
  recommended: boolean
}

export type LogisticsOptions = {
  data: LogisticsOption[]
  meta: { attribution: string[] }
}

type CachedOptions = {
  expiresAt: number
  response?: LogisticsOptions
  request?: Promise<LogisticsOptions>
}

const cache = new Map<string, CachedOptions>()
const cacheLifetimeMs = 60_000

export function getSellerLogisticsOptions(sellerId: string, force = false): Promise<LogisticsOptions> {
  const cached = cache.get(sellerId)

  if (cached?.request) return cached.request
  if (!force && cached?.response && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.response)
  }

  const request = apiRequest<LogisticsOptions>('/api/v1/seller/logistics-options')
    .then((response) => {
      cache.set(sellerId, { response, expiresAt: Date.now() + cacheLifetimeMs })

      return response
    })
    .catch((error: unknown) => {
      cache.delete(sellerId)
      throw error
    })

  cache.set(sellerId, { request, expiresAt: 0 })

  return request
}
