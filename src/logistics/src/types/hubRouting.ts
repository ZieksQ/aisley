export type HubSummary = { id: string; name: string }

export type HubRoute = {
  id: string
  status: 'local' | 'planned' | 'unresolved' | 'unavailable' | 'completed'
  failure_code: string | null
  origin_hub: HubSummary | null
  destination_hub: HubSummary | null
  current_hub: HubSummary | null
  next_hub: HubSummary | null
  distance_meters: number | null
  duration_seconds: number | null
  attribution: string
  hops: Array<{
    id: string
    sequence: number
    status: 'pending' | 'in_transfer' | 'arrived'
    revision: number
    from_hub: HubSummary | null
    to_hub: HubSummary | null
    distance_meters: number | null
    duration_seconds: number | null
    departed_at: string | null
    arrived_at: string | null
  }>
}

export type HubRouteRecord = {
  shipment_id: string
  revision: number
  status: string
  route: HubRoute | null
}
