export interface FinalMileTask {
  task_id: string
  leg: 'final_mile'
  status: string
  revision: number
  accepted_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  offer: { status: string; responded_at: string | null; rejection_reason: string | null } | null
  order: { reference: string; status: string } | null
  waybill: { reference: string; tracking_id: string } | null
  parcel: { reference: string; item_count: number; price: string | null; currency: string | null } | null
  pickup_area: Area | null
  destination_area: Area | null
  evidence_id: string | null
  evidence_status: string
  completion_status: string | null
  failed_attempt_count: number
  failed_attempts: { id: string; reason: string; note: string | null; attempted_at: string }[]
}

export interface FinalMileBatch {
  id: string
  reference: string
  scheduled_for: string
  parcel_count: number
  status: 'offered' | 'accepted' | 'in_progress'
  tasks: FinalMileTask[]
}

export interface FinalMileRoute {
  status: 'ready' | 'unavailable'
  reason: string | null
  summary: { stop_count: number; distance_metres: number; duration_seconds: number } | null
  stops: { sequence: number; kind: 'hub' | 'delivery'; task_id: string | null; label: string; longitude: number; latitude: number }[]
  geojson: {
    type: 'FeatureCollection'
    features: Array<{
      type: 'Feature'
      geometry: { type: 'LineString' | 'Point'; coordinates: number[][] | number[] }
      properties: Record<string, string | number | boolean>
    }>
  } | null
  map: { style_url: string; attribution: string[] } | null
}

export interface Area {
  city_municipality?: string | null
  province?: string | null
  region?: string | null
}

export interface Address extends Area {
  address_line_1?: string | null
  address_line_2?: string | null
  barangay?: string | null
  postal_code?: string | null
  contact_number?: string | null
}

export interface DeliveryContext extends FinalMileTask {
  pickup_hub: { name: string; address: Address | null } | null
  destination: Address | null
  delivery_instructions: string | null
}

export interface Completion {
  task_id: string
  intent_id: string | null
  intent_evidence_id: string | null
  task_status: string
  order_status: string
  evidence_id: string | null
  evidence_status: string
  proof_failed_attempt_count: number | null
  completion_status: string | null
  delivered_at: string | null
  revision: number
}

export interface EvidenceReceipt {
  task_id: string
  evidence_id?: string
  proof_id?: string
  evidence_status: string
  custody_state: string
  submitted_at: string
}
