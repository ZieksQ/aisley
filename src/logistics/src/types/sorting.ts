export type SortingLane = {
  id: string
  code: string
  name: string
  type: 'standard' | 'exception'
  is_active: boolean
  position: number
  revision: number
  label_payload: string
  label_url: string
}

export type SortingPlanLane = {
  id: string
  postal_code: string
  position: number
  lane: SortingLane | null
}

export type SortingPlan = {
  id: string
  name: string
  is_active: boolean
  revision: number
  created_at: string | null
  updated_at: string | null
  lanes: SortingPlanLane[]
}

export type SortingPlansOverview = {
  context: { organization_id: string; hub_id: string; hub_name: string }
  active_plan_id: string | null
  plans: SortingPlan[]
  lanes: SortingLane[]
}

export type SortingItem = {
  id: string
  shipment_id: string
  reference: string
  tracking_id: string | null
  order_reference: string | null
  status: 'pending' | 'sorted' | 'exception'
  expected_revision: number
  shipment_revision: number
  can_move: boolean
  lane_id: string | null
  exception_code: string | null
  exception_reason: string | null
  completed_at: string | null
  automatic_routing: {
    postal_code: string | null
    sort_plan_id: string | null
    sort_plan_name: string | null
    lane: SortingLane | null
    reason: string
  }
  destination: {
    barangay: string | null
    city_municipality: string | null
    province: string | null
    region: string | null
    postal_code: string | null
  }
}

export type SortingSession = {
  id: string
  reference: string
  status: 'open' | 'closed'
  expected_count: number
  revision: number
  opened_at: string
  closed_at: string | null
  counts: { pending: number; sorted: number; exception: number }
  items: SortingItem[]
}

export type SortingOverview = {
  context: { organization_id: string; hub_id: string; hub_name: string }
  lanes: SortingLane[]
  automatic_sorting: {
    enabled: boolean
    active_plan: SortingPlan | null
    exception_lane: SortingLane | null
  }
  session: SortingSession | null
  waiting_received: number
  session_limit: number
}

export type SortingBatchResponse = {
  data: Array<{
    client_id: string
    reference: string
    status: 'sorted' | 'exception' | 'failed'
    code?: string
    message?: string
  }>
  summary: { sorted: number; exception: number; failed: number }
}
