export type SortingLane = {
  id: string
  code: string
  name: string
  type: 'standard' | 'exception'
  is_active: boolean
  operational_state: 'open' | 'paused' | 'held'
  blocking_reason: string | null
  position: number
  revision: number
  label_payload: string
  label_url: string
}

export type SortingPlanLane = {
  id: string
  postal_code: string | null
  destination_type: 'postal_code' | 'hub'
  destination_hub_id: string | null
  position: number
  lane: SortingLane | null
}

export type SortingAssignment = {
  legacy_reconstructed: boolean
  version_id: string | null
  version_number: number | null
  plan_name: string | null
  lane: { id: string; code: string | null; name: string | null; revision?: number }
  destination_type?: 'postal_code' | 'hub'
  postal_code?: string | null
  next_hub_id?: string | null
  next_hub_name?: string | null
}

export type SortingPlanVersion = {
  id: string; number: number; name: string; published_by: string; published_at: string
  mappings: Array<{ id: string; sorting_lane_id: string; destination_type: 'postal_code' | 'hub'; postal_code: string | null; destination_hub_id: string | null; position: number }>
  differences: Record<string, unknown>
}

export type SortingPlan = {
  id: string
  name: string
  is_active: boolean
  revision: number
  active_version_id: string | null
  draft_dirty: boolean
  archived_at: string | null
  versions: SortingPlanVersion[]
  activations: Array<{ id: string; sorting_plan_version_id: string; status: string; requested_by: string; scheduled_for: string; completed_at: string | null; failure_reason: string | null }>
  created_at: string | null
  updated_at: string | null
  lanes: SortingPlanLane[]
}

export type SortingPlansOverview = {
  context: { organization_id: string; hub_id: string; hub_name: string }
  next_hubs: Array<{ id: string; name: string }>
  active_plan_id: string | null
  plans: SortingPlan[]
  lanes: SortingLane[]
}

export type SortingItem = {
  route: import('./hubRouting').HubRoute | null
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
  sorting_assignment: SortingAssignment | null
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
    lane?: { id: string; code: string | null; name: string | null } | null
    sorting_assignment?: SortingAssignment | null
    message?: string
  }>
  summary: { sorted: number; exception: number; failed: number }
}
