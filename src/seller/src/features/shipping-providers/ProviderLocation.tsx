import type { ProviderRow } from './useShippingProviders'

export function ProviderLocation({ provider }: { provider: ProviderRow }) {
  const ranking = provider.ranking
  if (!ranking)
    return (
      <span className="portal-secondary">Location ranking unavailable</span>
    )
  const area = ranking.hub.area
  return (
    <span className="provider-location">
      <span>
        {[area.city_municipality, area.province, area.region]
          .filter(Boolean)
          .join(', ')}
      </span>
      <span className="portal-table-meta">
        {ranking.distance_km === null
          ? 'Road distance unavailable'
          : `${ranking.distance_km.toFixed(1)} km by road`}
      </span>
    </span>
  )
}
