export type FulfillmentCourier = { id: string; name: string; email: string }

export type FulfillmentOffer = {
  id: string
  status: string
  courier_id: string
  courier?: FulfillmentCourier | null
  sequence: number
  offered_at: string | null
  responded_at: string | null
  rejection_reason: string | null
}

export type FulfillmentEvidence = {
  id: string
  purpose: 'hub_pickup' | 'delivery_proof' | string
  type: string
  safe_reference: string | null
  status: 'submitted' | 'awaiting_validation' | 'validated' | 'rejected' | 'unavailable' | string
  courier_id: string
  submitted_at: string | null
  validated_at: string | null
  rejection_reason: string | null
}

export type FulfillmentCompletionIntent = {
  id: string
  evidence_id: string
  courier_id: string
  expected_revision: number
  status: string
  confirmed_at: string | null
  validated_at: string | null
}

export type FulfillmentTask = {
  task_id: string
  leg: 'first_mile' | 'final_mile' | string
  status: string
  revision: number
  courier_id: string | null
  courier?: FulfillmentCourier | null
  accepted_at: string | null
  picked_up_at: string | null
  in_transit_at: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
  offer: FulfillmentOffer | null
  offer_history?: FulfillmentOffer[]
  order: { id: string; reference: string; status: string } | null
  waybill: { id: string; reference: string } | null
  parcel: { id: string; reference: string; item_count: number } | null
  pickup_area: FulfillmentArea
  destination_area: FulfillmentArea
  evidence_status: string
  evidence_id?: string
  completion_status: string | null
  evidence?: FulfillmentEvidence[]
  hub_pickup_evidence?: FulfillmentEvidence | null
  delivery_proof?: FulfillmentEvidence | null
  completion_intents?: FulfillmentCompletionIntent[]
}

export type FulfillmentArea = {
  city_municipality: string | null
  province: string | null
  region: string | null
  postal_code: string | null
}

export type FulfillmentShipment = {
  shipment_id: string
  status: string
  revision: number
  last_activity_at: string | null
  parcel: {
    id: string
    reference: string
    order_id: string
    order_reference: string | null
    waybill_reference: string | null
    item_count: number
  } | null
  tasks: FulfillmentTask[]
  allowed_transitions: string[]
}

export type FulfillmentQueueResponse = {
  data: FulfillmentShipment[]
  summary: {
    total: number
    by_status: Record<string, number>
    pending_evidence: number
    pending_completion: number
  }
  meta: { current_page: number; last_page: number; per_page: number; total: number }
  freshness: { generated_at: string; state: 'authoritative' | string }
}

export type FulfillmentRecordResponse = { data: FulfillmentShipment }

export type FulfillmentCandidatesResponse = {
  data: Array<{
    courier_id: string
    name: string
    email: string
    distance_km: number | null
    estimated_duration_minutes: number | null
    route_status: string
  }>
}

export type FulfillmentOfferResponse = {
  data: { task: FulfillmentTask; offer: FulfillmentOffer }
}
