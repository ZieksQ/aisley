export type LinehaulTrip = {
  id: string
  direction: 'outbound' | 'return'
  status: 'pending_acceptance' | 'scheduled' | 'rejected' | 'cancelled' | 'in_transfer' | 'receiving' | 'received'
  revision: number
  courier_can_depart: boolean
  courier_can_report_arrival: boolean
  released_for_departure_at: string | null
  courier_arrived_at: string | null
  from_hub: { name: string | null }
  to_hub: { name: string | null }
  truck: { plate_number: string | null; make: string | null; model: string | null }
  scheduled_for: string | null
  parcel_count: number
  references: string[]
  empty_return: boolean
  lane_blocked: boolean
  rejection_reason: string | null
  departed_at: string | null
  arrived_at: string | null
  unloading_closed_at: string | null
  unloading_outcome: string | null
}

export type LinehaulHub = {
  kind: 'origin' | 'destination'
  name: string
  address: string
  latitude: number | null
  longitude: number | null
}

export type LinehaulRoute = {
  status: 'ready' | 'unavailable'
  reason: string | null
  hubs: LinehaulHub[]
  summary: { distance_metres: number; duration_seconds: number } | null
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null
}
